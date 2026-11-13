import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { getSchemaVersion } from "../src/index.ts";

export type TempDataEnv = {
  dataDir: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => void;
};

export function createTempDataEnv(): TempDataEnv {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-data-"));
  return {
    dataDir,
    env: { BOOKSKILL_DATA_DIR: dataDir },
    cleanup() {
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export type TableDump = {
  version: number;
  columns: Record<string, unknown[]>;
  rows: Record<string, unknown[]>;
};

export function dumpDatabase(db: DatabaseSync): TableDump {
  const tables = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as Array<{ name: string }>;

  const columns: Record<string, unknown[]> = {};
  const rows: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    columns[name] = db.prepare(`PRAGMA table_info(${quoteIdent(name)})`).all() as unknown[];
    const orderCol = name === "schema_migrations" ? "version" : "rowid";
    rows[name] = db
      .prepare(`SELECT * FROM ${quoteIdent(name)} ORDER BY ${orderCol}`)
      .all() as unknown[];
  }

  return { version: getSchemaVersion(db), columns, rows };
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`Unexpected identifier: ${name}`);
  }
  return `"${name}"`;
}

export function tableNames(db: DatabaseSync): string[] {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    )
    .all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

export function columnNames(db: DatabaseSync, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

export function primaryKeyColumn(db: DatabaseSync, table: string): { name: string; type: string } {
  const rows = db.prepare(`PRAGMA table_info(${quoteIdent(table)})`).all() as Array<{
    name: string;
    type: string;
    pk: number;
  }>;
  const pk = rows.filter((row) => row.pk > 0);
  if (pk.length !== 1 || !pk[0]) {
    throw new Error(`Expected a single-column primary key on ${table}`);
  }
  return { name: pk[0].name, type: pk[0].type };
}

