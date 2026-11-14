import assert from "node:assert/strict";
import fs from "node:fs";
import { afterEach, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  BUILTIN_MIGRATIONS,
  MigrationError,
  SCHEMA_VERSION_CURRENT,
  createBusinessId,
  getSchemaVersion,
  migrateBusinessDatabase,
  openBusinessDatabase,
  type Migration,
} from "../src/index.ts";
import {
  createTempDataEnv,
  dumpDatabase,
  type TempDataEnv,
} from "./helpers.ts";

const temps: TempDataEnv[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

describe("failed migration backup restore", () => {
  it("restores the pre-migration backup so data matches the failed-before state", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const options = { env: env.env, platform: "linux" as const };

    const opened = openBusinessDatabase(options);
    const now = "2026-11-13T09:00:00.000Z";
    const bookId = createBusinessId();
    opened.db
      .prepare(
        `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        bookId,
        "Keep me",
        "Tester",
        "txt",
        "/tmp/keep-me.txt",
        "hash-keep",
        "parsed",
        now,
        now,
      );
    const before = dumpDatabase(opened.db);
    assert.equal(before.version, SCHEMA_VERSION_CURRENT);
    opened.close();

    const failing: Migration = {
      version: SCHEMA_VERSION_CURRENT + 1,
      name: "fail_on_purpose",
      up(db) {
        db.exec("ALTER TABLE books ADD COLUMN scratch TEXT");
        db.exec("UPDATE books SET title = 'CORRUPTED'");
        throw new Error("intentional migration failure");
      },
    };

    assert.throws(
      () =>
        migrateBusinessDatabase({
          ...options,
          migrations: [...BUILTIN_MIGRATIONS, failing],
        }),
      (error: unknown) => {
        assert.ok(error instanceof MigrationError);
        assert.match(error.message, /restored to version/);
        assert.equal(error.fromVersion, SCHEMA_VERSION_CURRENT);
        assert.ok(error.backupPath);
        assert.ok(fs.existsSync(error.backupPath));
        assert.ok(error.cause instanceof Error);
        assert.match((error.cause as Error).message, /intentional migration failure/);
        return true;
      },
    );

    const afterOpen = openBusinessDatabase(options);
    try {
      const after = dumpDatabase(afterOpen.db);
      assert.deepEqual(after, before);
      assert.equal(after.version, SCHEMA_VERSION_CURRENT);
      assert.equal(
        columnNamesSafe(afterOpen.db, "books").includes("scratch"),
        false,
      );
      const book = afterOpen.db
        .prepare("SELECT title FROM books WHERE id = ?")
        .get(bookId) as { title: string };
      assert.equal(book.title, "Keep me");
      assert.equal(getSchemaVersion(afterOpen.db), SCHEMA_VERSION_CURRENT);
    } finally {
      afterOpen.close();
    }
  });
});

function columnNamesSafe(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info("${table}")`).all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}
