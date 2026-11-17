import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  SCHEMA_VERSION_CURRENT,
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_V3,
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
    assert.notEqual(SCHEMA_VERSION_V2, SCHEMA_VERSION_CURRENT);

    const opened = openBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V2 });
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

    const third = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V3 });
    assert.equal(third.fromVersion, SCHEMA_VERSION_V2);
    assert.equal(third.toVersion, SCHEMA_VERSION_V3);
    assert.equal(third.toVersion, SCHEMA_VERSION_CURRENT);

    const openedV3 = openBusinessDatabase(options);
    try {
      assert.equal(openedV3.schemaVersion, SCHEMA_VERSION_V3);
      const book = openedV3.db
        .prepare(`SELECT id, title, content_hash FROM books WHERE id = ?`)
        .get(ids.book) as { id: string; title: string; content_hash: string };
      assert.equal(book.title, "Legacy Primer");
      assert.equal(book.content_hash, "hash-legacy-book");
      const chunk = openedV3.db
        .prepare(`SELECT id, text, ordinal FROM source_chunks WHERE id = ?`)
        .get(ids.chunk) as { id: string; text: string; ordinal: number };
      assert.equal(chunk.text, "A paragraph written before the ordinal column existed.");
      assert.equal(chunk.ordinal, 0);
    } finally {
      openedV3.close();
    }
  });

  it("migrates a v2 library with knowledge cards to v3 and backfills revision=1 baselines", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const options = { env: env.env, platform: "linux" as const };

    const v2 = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V2 });
    assert.equal(v2.toVersion, SCHEMA_VERSION_V2);

    const now = "2026-11-13T09:00:00.000Z";
    const cardId = createBusinessId();
    const bookId = createBusinessId();
    const chunkId = createBusinessId();
    const dbV2 = new DatabaseSync(v2.dbPath, { enableForeignKeyConstraints: true });
    try {
      dbV2
        .prepare(
          `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(bookId, "V2 Primer", "Tester", "md", "/tmp/v2-primer.md", "hash-v2-book", "parsed", now, now);
      dbV2
        .prepare(
          `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash, ordinal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(chunkId, bookId, "1", 1, '{"anchor":"P1.3"}', "A licensed paragraph.", "hash-v2-chunk", 0);
      dbV2
        .prepare(
          `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          cardId,
          "Card From V2",
          "原则",
          "A claim written on schema v2.",
          "when migrating",
          "do not invent history",
          "draft",
          now,
          now,
        );
    } finally {
      dbV2.close();
    }

    const v3 = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V3 });
    assert.equal(v3.fromVersion, SCHEMA_VERSION_V2);
    assert.equal(v3.toVersion, SCHEMA_VERSION_V3);

    const opened = openBusinessDatabase(options);
    try {
      assert.equal(opened.schemaVersion, SCHEMA_VERSION_CURRENT);
      assert.ok(columnNames(opened.db, "knowledge_card_revisions").includes("revision"));

      const card = opened.db
        .prepare(
          `SELECT id, title, type, content, conditions, limitations, status
           FROM knowledge_cards WHERE id = ?`,
        )
        .get(cardId) as {
        id: string;
        title: string;
        type: string;
        content: string;
        conditions: string;
        limitations: string;
        status: string;
      };
      assert.equal(card.title, "Card From V2");
      assert.equal(card.type, "原则");
      assert.equal(card.content, "A claim written on schema v2.");
      assert.equal(card.conditions, "when migrating");
      assert.equal(card.limitations, "do not invent history");
      assert.equal(card.status, "draft");

      const book = opened.db
        .prepare(`SELECT title FROM books WHERE id = ?`)
        .get(bookId) as { title: string };
      assert.equal(book.title, "V2 Primer");
      const chunk = opened.db
        .prepare(`SELECT text, ordinal FROM source_chunks WHERE id = ?`)
        .get(chunkId) as { text: string; ordinal: number };
      assert.equal(chunk.text, "A licensed paragraph.");
      assert.equal(chunk.ordinal, 0);

      const revisions = opened.db
        .prepare(
          `SELECT id, card_id, revision, title, type, content, conditions, limitations, status, created_at
           FROM knowledge_card_revisions WHERE card_id = ? ORDER BY revision`,
        )
        .all(cardId) as Array<{
        id: string;
        card_id: string;
        revision: number;
        title: string;
        type: string;
        content: string;
        conditions: string;
        limitations: string;
        status: string;
        created_at: string;
      }>;
      assert.equal(revisions.length, 1);
      assert.equal(revisions[0]?.card_id, cardId);
      assert.equal(revisions[0]?.revision, 1);
      assert.equal(revisions[0]?.title, card.title);
      assert.equal(revisions[0]?.type, card.type);
      assert.equal(revisions[0]?.content, card.content);
      assert.equal(revisions[0]?.conditions, card.conditions);
      assert.equal(revisions[0]?.limitations, card.limitations);
      assert.equal(revisions[0]?.status, card.status);
      assert.equal(revisions[0]?.created_at, now);
      assert.match(revisions[0]?.id ?? "", /^[0-9a-f-]{36}$/i);
    } finally {
      opened.close();
    }
  });

  it("upgrades a v2 database with no knowledge cards to v3 cleanly", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const options = { env: env.env, platform: "linux" as const };

    const v2 = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V2 });
    assert.equal(v2.toVersion, SCHEMA_VERSION_V2);

    const v3 = migrateBusinessDatabase({ ...options, untilVersion: SCHEMA_VERSION_V3 });
    assert.equal(v3.fromVersion, SCHEMA_VERSION_V2);
    assert.equal(v3.toVersion, SCHEMA_VERSION_V3);

    const opened = openBusinessDatabase(options);
    try {
      assert.equal(opened.schemaVersion, SCHEMA_VERSION_CURRENT);
      assert.ok(columnNames(opened.db, "knowledge_card_revisions").includes("card_id"));
      const cardCount = opened.db.prepare(`SELECT COUNT(*) AS n FROM knowledge_cards`).get() as { n: number };
      const revisionCount = opened.db
        .prepare(`SELECT COUNT(*) AS n FROM knowledge_card_revisions`)
        .get() as { n: number };
      assert.equal(cardCount.n, 0);
      assert.equal(revisionCount.n, 0);
    } finally {
      opened.close();
    }
  });
});
