import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  BUSINESS_DB_BACKUP_DIRNAME,
  SCHEMA_VERSION_CURRENT,
} from "./constants.ts";
import { BUILTIN_MIGRATIONS, type Migration } from "./migrations.ts";
import {
  assertBusinessDbPath,
  resolveBusinessDbPath,
  type ResolveDataDirOptions,
} from "./paths.ts";

export type MigrateDatabaseOptions = ResolveDataDirOptions & {
  /** Override migration list (used to inject a failing migration in tests). */
  migrations?: readonly Migration[];
  /** Stop after this version (inclusive). Defaults to the last provided migration. */
  untilVersion?: number;
};

export type MigrationResult = {
  dbPath: string;
  fromVersion: number;
  toVersion: number;
  backupPath: string | null;
};

export class MigrationError extends Error {
  readonly dbPath: string;
  readonly backupPath: string | null;
  readonly fromVersion: number;

  constructor(
    message: string,
    options: {
      dbPath: string;
      backupPath: string | null;
      fromVersion: number;
      cause?: unknown;
    },
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "MigrationError";
    this.dbPath = options.dbPath;
    this.backupPath = options.backupPath;
    this.fromVersion = options.fromVersion;
  }
}

export type BusinessDatabase = {
  readonly path: string;
  readonly db: DatabaseSync;
  readonly schemaVersion: number;
  close(): void;
};

function nowIso(): string {
  return new Date().toISOString();
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
}

export function getSchemaVersion(db: DatabaseSync): number {
  const table = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'`,
    )
    .get() as { name: string } | undefined;
  if (!table) {
    return 0;
  }
  const row = db
    .prepare(`SELECT MAX(version) AS version FROM schema_migrations`)
    .get() as { version: number | null } | undefined;
  return row?.version ?? 0;
}

function openSqlite(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: true });
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA journal_mode = DELETE;");
  return db;
}

function sidecarPaths(dbPath: string): string[] {
  return [`${dbPath}-wal`, `${dbPath}-shm`, `${dbPath}-journal`];
}

function writeBackup(db: DatabaseSync, dbPath: string, fromVersion: number, toVersion: number): string {
  const backupDir = path.join(path.dirname(dbPath), BUSINESS_DB_BACKUP_DIRNAME);
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = nowIso().replaceAll(":", "").replaceAll(".", "");
  const backupPath = path.join(
    backupDir,
    `bookskill.pre-migrate-v${fromVersion}-to-v${toVersion}.${stamp}.sqlite`,
  );
  db.exec(`VACUUM INTO ${sqlLiteral(backupPath)}`);
  return backupPath;
}

function removeDbFiles(dbPath: string): void {
  for (const file of [dbPath, ...sidecarPaths(dbPath)]) {
    fs.rmSync(file, { force: true });
  }
}

function restoreBackup(dbPath: string, backupPath: string | null, existedBefore: boolean): void {
  removeDbFiles(dbPath);
  if (backupPath && fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, dbPath);
    return;
  }
  if (existedBefore) {
    throw new Error(`Migration failed and no backup was available to restore at ${dbPath}`);
  }
  // Fresh database: leave it absent so a later open can start cleanly.
}

function pendingMigrations(
  migrations: readonly Migration[],
  fromVersion: number,
  untilVersion: number,
): Migration[] {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 0; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (!current) continue;
    if (i > 0) {
      const previous = sorted[i - 1];
      if (previous && current.version !== previous.version + 1) {
        throw new Error(
          `Migration versions must be consecutive; found ${previous.version} then ${current.version}`,
        );
      }
    }
  }
  return sorted.filter((m) => m.version > fromVersion && m.version <= untilVersion);
}

/**
 * Apply pending migrations to the business database under the BookSkill data dir.
 * Before applying, a file-level backup is taken. On failure the backup is restored
 * so on-disk data matches the pre-migration state.
 */
export function migrateBusinessDatabase(
  options: MigrateDatabaseOptions = {},
): MigrationResult {
  const dbPath = resolveBusinessDbPath(options);
  assertBusinessDbPath(dbPath, options);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const migrations = options.migrations ?? BUILTIN_MIGRATIONS;
  const untilVersion = options.untilVersion ?? Math.max(...migrations.map((m) => m.version));
  const existedBefore = fs.existsSync(dbPath);

  let db = openSqlite(dbPath);
  try {
    ensureMigrationsTable(db);
    const fromVersion = getSchemaVersion(db);
    const pending = pendingMigrations(migrations, fromVersion, untilVersion);
    if (pending.length === 0) {
      db.close();
      return { dbPath, fromVersion, toVersion: fromVersion, backupPath: null };
    }

    const targetVersion = pending[pending.length - 1]!.version;
    const backupPath = existedBefore ? writeBackup(db, dbPath, fromVersion, targetVersion) : null;

    try {
      for (const migration of pending) {
        db.exec("BEGIN IMMEDIATE;");
        try {
          migration.up(db);
          db.prepare(
            `INSERT INTO schema_migrations(version, name, applied_at) VALUES (?, ?, ?)`,
          ).run(migration.version, migration.name, nowIso());
          db.exec("COMMIT;");
        } catch (cause) {
          try {
            db.exec("ROLLBACK;");
          } catch {
            // The connection may already have rolled back or left the txn.
          }
          throw cause;
        }
      }
      const toVersion = getSchemaVersion(db);
      db.close();
      return { dbPath, fromVersion, toVersion, backupPath };
    } catch (cause) {
      try {
        db.close();
      } catch {
        // Ignore close errors so restore can proceed.
      }
      restoreBackup(dbPath, backupPath, existedBefore);
      throw new MigrationError(
        `Migration failed; database restored to version ${fromVersion}`,
        { dbPath, backupPath, fromVersion, cause },
      );
    }
  } catch (error) {
    try {
      db.close();
    } catch {
      // Already closed, or never usable.
    }
    throw error;
  }
}

/** Open the business database, applying built-in migrations as needed. */
export function openBusinessDatabase(
  options: MigrateDatabaseOptions = {},
): BusinessDatabase {
  const result = migrateBusinessDatabase(options);
  const db = openSqlite(result.dbPath);
  return {
    path: result.dbPath,
    db,
    schemaVersion: getSchemaVersion(db),
    close() {
      db.close();
    },
  };
}

export { SCHEMA_VERSION_CURRENT };
