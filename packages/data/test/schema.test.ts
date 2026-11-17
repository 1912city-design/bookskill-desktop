import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  CORE_TABLES,
  SCHEMA_VERSION_CURRENT,
  createBusinessId,
  openBusinessDatabase,
} from "../src/index.ts";
import {
  columnNames,
  createTempDataEnv,
  primaryKeyColumn,
  tableNames,
  type TempDataEnv,
} from "./helpers.ts";

const temps: TempDataEnv[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

describe("core schema", () => {
  it("creates every contract 3.1 table with a UUID text primary key named id", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const opened = openBusinessDatabase({ env: env.env, platform: "linux" });
    try {
      assert.equal(opened.schemaVersion, SCHEMA_VERSION_CURRENT);
      const names = tableNames(opened.db);
      for (const table of CORE_TABLES) {
        assert.ok(names.includes(table), `missing table ${table}`);
        const pk = primaryKeyColumn(opened.db, table);
        assert.equal(pk.name, "id");
        assert.equal(pk.type.toUpperCase(), "TEXT");
        const ddl = opened.db
          .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`)
          .get(table) as { sql: string };
        assert.match(ddl.sql, /PRIMARY KEY/);
        assert.match(ddl.sql, /length\(id\) = 36/);
        assert.match(ddl.sql, /GLOB '\?\?\?\?\?\?\?\?-\?\?\?\?-\?\?\?\?-\?\?\?\?-\?\?\?\?\?\?\?\?\?\?\?\?'/);
      }

      assert.throws(
        () =>
          opened.db
            .prepare(
              `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              "not-a-uuid",
              "Bad",
              "Tester",
              "md",
              "/tmp/bad.md",
              "hash",
              "pending",
              "2026-11-13T09:00:00.000Z",
              "2026-11-13T09:00:00.000Z",
            ),
        /CHECK constraint failed/i,
      );
    } finally {
      opened.close();
    }
  });

  it("exposes the contract 3.1 columns on each core table", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const opened = openBusinessDatabase({ env: env.env, platform: "linux" });
    try {
      const expected: Record<string, string[]> = {
        books: [
          "id",
          "title",
          "author",
          "format",
          "file_path",
          "content_hash",
          "parse_status",
          "created_at",
          "updated_at",
        ],
        source_chunks: [
          "id",
          "book_id",
          "chapter",
          "page",
          "location_json",
          "text",
          "content_hash",
          "ordinal",
        ],
        annotations: ["id", "source_chunk_id", "type", "body", "created_at", "updated_at"],
        knowledge_cards: [
          "id",
          "title",
          "type",
          "content",
          "conditions",
          "limitations",
          "status",
          "created_at",
          "updated_at",
        ],
        knowledge_card_revisions: [
          "id",
          "card_id",
          "revision",
          "title",
          "type",
          "content",
          "conditions",
          "limitations",
          "status",
          "created_at",
        ],
        knowledge_sources: ["id", "knowledge_card_id", "source_chunk_id", "relation_type"],
        knowledge_relations: ["id", "from_card_id", "to_card_id", "relation_type", "status"],
        skills: [
          "id",
          "name",
          "domain",
          "purpose",
          "status",
          "current_version_id",
          "created_at",
          "updated_at",
        ],
        skill_versions: [
          "id",
          "skill_id",
          "version",
          "inputs_json",
          "steps_json",
          "rules_json",
          "output_schema_json",
          "permissions_json",
          "created_at",
        ],
        skill_sources: ["id", "skill_version_id", "knowledge_card_id", "step_id"],
        conversations: ["id", "title", "mode", "created_at", "updated_at", "deleted_at"],
        conversation_turns: ["id", "conversation_id", "role", "content", "created_at", "status"],
        conversation_skill_bindings: [
          "id",
          "conversation_id",
          "skill_id",
          "skill_version_id",
          "selection_method",
        ],
        evidence_refs: ["id", "turn_id", "source_chunk_id", "knowledge_card_id", "claim_id"],
        skill_runs: [
          "id",
          "conversation_id",
          "skill_version_id",
          "inputs_json",
          "result_json",
          "status",
          "created_at",
        ],
        feedback: ["id", "skill_run_id", "rating", "reason", "created_at"],
      };

      for (const [table, columns] of Object.entries(expected)) {
        const actual = columnNames(opened.db, table);
        for (const column of columns) {
          assert.ok(actual.includes(column), `${table} missing column ${column}`);
        }
      }
    } finally {
      opened.close();
    }
  });

  it("accepts a related row for every core table and rejects a broken foreign key", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const opened = openBusinessDatabase({ env: env.env, platform: "linux" });
    try {
      const { db } = opened;
      const now = "2026-11-13T09:00:00.000Z";
      const ids = {
        book: createBusinessId(),
        chunk: createBusinessId(),
        annotation: createBusinessId(),
        card: createBusinessId(),
        card2: createBusinessId(),
        revision: createBusinessId(),
        knowledgeSource: createBusinessId(),
        relation: createBusinessId(),
        skill: createBusinessId(),
        skillVersion: createBusinessId(),
        skillSource: createBusinessId(),
        conversation: createBusinessId(),
        turn: createBusinessId(),
        binding: createBusinessId(),
        evidence: createBusinessId(),
        run: createBusinessId(),
        feedback: createBusinessId(),
      };

      db.prepare(
        `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.book, "Primer", "Tester", "md", "/tmp/primer.md", "hash-book", "parsed", now, now);

      db.prepare(
        `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash, ordinal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.chunk, ids.book, "1", 1, '{"anchor":"P1.3"}', "A licensed paragraph.", "hash-chunk", 0);

      db.prepare(
        `INSERT INTO annotations(id, source_chunk_id, type, body, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(ids.annotation, ids.chunk, "note", "Remember this.", now, now);

      db.prepare(
        `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.card, "Card A", "claim", "A claim", "when x", "not y", "draft", now, now);
      db.prepare(
        `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.card2, "Card B", "claim", "B claim", null, null, "draft", now, now);

      db.prepare(
        `INSERT INTO knowledge_card_revisions(id, card_id, revision, title, type, content, conditions, limitations, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.revision, ids.card, 1, "Card A", "claim", "A claim", "when x", "not y", "draft", now);

      db.prepare(
        `INSERT INTO knowledge_sources(id, knowledge_card_id, source_chunk_id, relation_type)
         VALUES (?, ?, ?, ?)`,
      ).run(ids.knowledgeSource, ids.card, ids.chunk, "derived_from");

      db.prepare(
        `INSERT INTO knowledge_relations(id, from_card_id, to_card_id, relation_type, status)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(ids.relation, ids.card, ids.card2, "supports", "confirmed");

      db.exec("BEGIN;");
      db.prepare(
        `INSERT INTO skills(id, name, domain, purpose, status, current_version_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.skill, "Daily plan", "daily", "Plan a day", "draft", ids.skillVersion, now, now);
      db.prepare(
        `INSERT INTO skill_versions(id, skill_id, version, inputs_json, steps_json, rules_json, output_schema_json, permissions_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        ids.skillVersion,
        ids.skill,
        "1.0.0",
        "[]",
        "[]",
        "[]",
        "{}",
        "{}",
        now,
      );
      db.exec("COMMIT;");

      db.prepare(
        `INSERT INTO skill_sources(id, skill_version_id, knowledge_card_id, step_id)
         VALUES (?, ?, ?, ?)`,
      ).run(ids.skillSource, ids.skillVersion, ids.card, "step-1");

      db.prepare(
        `INSERT INTO conversations(id, title, mode, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(ids.conversation, "Slice chat", "skill", now, now, null);

      db.prepare(
        `INSERT INTO conversation_turns(id, conversation_id, role, content, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(ids.turn, ids.conversation, "assistant", "An answer with evidence.", now, "complete");

      db.prepare(
        `INSERT INTO conversation_skill_bindings(id, conversation_id, skill_id, skill_version_id, selection_method)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(ids.binding, ids.conversation, ids.skill, ids.skillVersion, "manual");

      db.prepare(
        `INSERT INTO evidence_refs(id, turn_id, source_chunk_id, knowledge_card_id, claim_id)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(ids.evidence, ids.turn, ids.chunk, ids.card, "claim-1");

      db.prepare(
        `INSERT INTO skill_runs(id, conversation_id, skill_version_id, inputs_json, result_json, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(ids.run, ids.conversation, ids.skillVersion, "{}", "{}", "succeeded", now);

      db.prepare(
        `INSERT INTO feedback(id, skill_run_id, rating, reason, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(ids.feedback, ids.run, 5, "helpful", now);

      const book = db.prepare("SELECT title FROM books WHERE id = ?").get(ids.book) as {
        title: string;
      };
      assert.equal(book.title, "Primer");
      const count = db.prepare("SELECT COUNT(*) AS n FROM feedback").get() as { n: number };
      assert.equal(count.n, 1);

      const revisionCount = db.prepare("SELECT COUNT(*) AS n FROM knowledge_card_revisions").get() as {
        n: number;
      };
      assert.equal(revisionCount.n, 1);

      assert.throws(
        () =>
          db
            .prepare(
              `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash, ordinal)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(createBusinessId(), createBusinessId(), "1", 1, null, "orphan", "h", 1),
        /FOREIGN KEY constraint failed/i,
      );

      assert.throws(
        () =>
          db
            .prepare(
              `INSERT INTO knowledge_card_revisions(id, card_id, revision, title, type, content, conditions, limitations, status, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              createBusinessId(),
              createBusinessId(),
              1,
              "Orphan",
              "claim",
              "no such card",
              null,
              null,
              "draft",
              now,
            ),
        /FOREIGN KEY constraint failed/i,
      );
    } finally {
      opened.close();
    }
  });
});
