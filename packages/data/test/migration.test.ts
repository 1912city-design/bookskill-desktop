import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  SCHEMA_VERSION_CURRENT,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  createBusinessId,
  getSchemaVersion,
  migrateBusinessDatabase,
  openBusinessDatabase,
} from "../src/index.ts";
import {
  columnNames,
  createTempDataEnv,
  type TempDataEnv,
} from "./helpers.ts";

const temps: TempDataEnv[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function insertV1BookAndChunk(
  db: DatabaseSync,
  ids: { book: string; chunk: string },
): void {
  const now = "2026-11-13T09:00:00.000Z";
  db.prepare(
    `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ids.book,
    "Legacy Primer",
    "Tester",
    "pdf",
    "/tmp/legacy-primer.pdf",
    "hash-legacy-book",
    "parsed",
    now,
    now,
  );
  db.prepare(
    `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    ids.chunk,
    ids.book,
    "Two",
    2,
    '{"anchor":"P2.2"}',
    "A paragraph written before the ordinal column existed.",
    "hash-legacy-chunk",
  );
}

describe("schema migration N to N+1", () => {
  it("migrates v1 data to v2 and keeps old books and chunks readable", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const options = { env: env.env, platform: "linux" as const };

    const first = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V1 });
    assert.equal(first.fromVersion, 0);
    assert.equal(first.toVersion, SCHEMA_VERSION_V1);

    const ids = { book: createBusinessId(), chunk: createBusinessId() };
    const dbV1 = new DatabaseSync(first.dbPath, { enableForeignKeyConstraints: true });
    try {
      assert.equal(getSchemaVersion(dbV1), SCHEMA_VERSION_V1);
      assert.equal(columnNames(dbV1, "source_chunks").includes("ordinal"), false);
      insertV1BookAndChunk(dbV1, ids);
    } finally {
      dbV1.close();
    }

    const second = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V2 });
    assert.equal(second.fromVersion, SCHEMA_VERSION_V1);
    assert.equal(second.toVersion, SCHEMA_VERSION_V2);
    assert.equal(SCHEMA_VERSION_V2, SCHEMA_VERSION_V1 + 1);
    assert.equal(second.toVersion, SCHEMA_VERSION_CURRENT);

    const opened = openBusinessDatabase(options);
    try {
      assert.equal(opened.schemaVersion, SCHEMA_VERSION_V2);
      assert.ok(columnNames(opened.db, "source_chunks").includes("ordinal"));

      const book = opened.db
        .prepare(`SELECT id, title, format, content_hash FROM books WHERE id = ?`)
        .get(ids.book) as {
        id: string;
        title: string;
        format: string;
        content_hash: string;
      };
      assert.equal(book.title, "Legacy Primer");
      assert.equal(book.format, "pdf");
      assert.equal(book.content_hash, "hash-legacy-book");

      const chunk = opened.db
        .prepare(
          `SELECT id, book_id, chapter, page, text, content_hash, ordinal
           FROM source_chunks WHERE id = ?`,
        )
        .get(ids.chunk) as {
        id: string;
        book_id: string;
        chapter: string;
        page: number;
        text: string;
        content_hash: string;
        ordinal: number;
      };
      assert.equal(chunk.book_id, ids.book);
      assert.equal(chunk.chapter, "Two");
      assert.equal(chunk.page, 2);
      assert.equal(
        chunk.text,
        "A paragraph written before the ordinal column existed.",
      );
      assert.equal(chunk.content_hash, "hash-legacy-chunk");
      assert.equal(chunk.ordinal, 0);

      const laterChunk = createBusinessId();
      opened.db
        .prepare(
          `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash, ordinal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          laterChunk,
          ids.book,
          "Two",
          3,
          '{"anchor":"P2.3"}',
          "A paragraph written after the upgrade.",
          "hash-new-chunk",
          1,
        );

      const ordered = opened.db
        .prepare(
          `SELECT id, ordinal FROM source_chunks WHERE book_id = ? ORDER BY ordinal`,
        )
        .all(ids.book) as Array<{ id: string; ordinal: number }>;
      assert.deepEqual(
        ordered.map((row) => ({ id: row.id, ordinal: row.ordinal })),
        [
          { id: ids.chunk, ordinal: 0 },
          { id: laterChunk, ordinal: 1 },
        ],
      );
    } finally {
      opened.close();
    }
  });
});
