import type { DatabaseSync } from "node:sqlite";
import {
  SCHEMA_VERSION_V1,
  SCHEMA_VERSION_V2,
  SCHEMA_VERSION_V3,
  UUID_ID_CHECK_SQL,
} from "./constants.ts";
import { createBusinessId } from "./uuid.ts";

export type Migration = {
  version: number;
  name: string;
  up: (db: DatabaseSync) => void;
};

function exec(db: DatabaseSync, sql: string): void {
  db.exec(sql);
}

/**
 * V1: all contract 3.1 business objects with UUID primary keys and FKs.
 * This is the first applied version (N).
 */
export const migrationV1: Migration = {
  version: SCHEMA_VERSION_V1,
  name: "create_core_tables",
  up(db) {
    exec(
      db,
      `
      CREATE TABLE books (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        title TEXT NOT NULL,
        author TEXT,
        format TEXT NOT NULL,
        file_path TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        parse_status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE source_chunks (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        book_id TEXT NOT NULL,
        chapter TEXT,
        page INTEGER,
        location_json TEXT,
        text TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        FOREIGN KEY (book_id) REFERENCES books(id)
      );

      CREATE INDEX idx_source_chunks_book_id ON source_chunks(book_id);

      CREATE TABLE annotations (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        source_chunk_id TEXT NOT NULL,
        type TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (source_chunk_id) REFERENCES source_chunks(id)
      );

      CREATE INDEX idx_annotations_source_chunk_id ON annotations(source_chunk_id);

      CREATE TABLE knowledge_cards (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        conditions TEXT,
        limitations TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE knowledge_sources (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        knowledge_card_id TEXT NOT NULL,
        source_chunk_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        FOREIGN KEY (knowledge_card_id) REFERENCES knowledge_cards(id),
        FOREIGN KEY (source_chunk_id) REFERENCES source_chunks(id)
      );

      CREATE INDEX idx_knowledge_sources_card_id ON knowledge_sources(knowledge_card_id);
      CREATE INDEX idx_knowledge_sources_chunk_id ON knowledge_sources(source_chunk_id);

      CREATE TABLE knowledge_relations (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        from_card_id TEXT NOT NULL,
        to_card_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        status TEXT NOT NULL,
        CHECK (from_card_id <> to_card_id),
        FOREIGN KEY (from_card_id) REFERENCES knowledge_cards(id),
        FOREIGN KEY (to_card_id) REFERENCES knowledge_cards(id)
      );

      CREATE TABLE skills (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        purpose TEXT NOT NULL,
        status TEXT NOT NULL,
        current_version_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (current_version_id) REFERENCES skill_versions(id) DEFERRABLE INITIALLY DEFERRED
      );

      CREATE TABLE skill_versions (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        skill_id TEXT NOT NULL,
        version TEXT NOT NULL,
        inputs_json TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        rules_json TEXT NOT NULL,
        output_schema_json TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (skill_id, version),
        FOREIGN KEY (skill_id) REFERENCES skills(id)
      );

      CREATE INDEX idx_skill_versions_skill_id ON skill_versions(skill_id);

      CREATE TABLE skill_sources (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        skill_version_id TEXT NOT NULL,
        knowledge_card_id TEXT NOT NULL,
        step_id TEXT,
        FOREIGN KEY (skill_version_id) REFERENCES skill_versions(id),
        FOREIGN KEY (knowledge_card_id) REFERENCES knowledge_cards(id)
      );

      CREATE TABLE conversations (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        title TEXT NOT NULL,
        mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE conversation_turns (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );

      CREATE INDEX idx_conversation_turns_conversation_id
        ON conversation_turns(conversation_id);

      CREATE TABLE conversation_skill_bindings (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        conversation_id TEXT NOT NULL,
        skill_id TEXT NOT NULL,
        skill_version_id TEXT NOT NULL,
        selection_method TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (skill_id) REFERENCES skills(id),
        FOREIGN KEY (skill_version_id) REFERENCES skill_versions(id)
      );

      CREATE TABLE evidence_refs (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        turn_id TEXT NOT NULL,
        source_chunk_id TEXT,
        knowledge_card_id TEXT,
        claim_id TEXT,
        FOREIGN KEY (turn_id) REFERENCES conversation_turns(id),
        FOREIGN KEY (source_chunk_id) REFERENCES source_chunks(id),
        FOREIGN KEY (knowledge_card_id) REFERENCES knowledge_cards(id)
      );

      CREATE INDEX idx_evidence_refs_turn_id ON evidence_refs(turn_id);

      CREATE TABLE skill_runs (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        conversation_id TEXT NOT NULL,
        skill_version_id TEXT NOT NULL,
        inputs_json TEXT NOT NULL,
        result_json TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (skill_version_id) REFERENCES skill_versions(id)
      );

      CREATE INDEX idx_skill_runs_conversation_id ON skill_runs(conversation_id);

      CREATE TABLE feedback (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        skill_run_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        reason TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (skill_run_id) REFERENCES skill_runs(id)
      );

      CREATE INDEX idx_feedback_skill_run_id ON feedback(skill_run_id);
      `,
    );
  },
};

/**
 * V2 (N+1): real column + index used for reading order.
 * Existing source_chunks rows remain readable; ordinal defaults to 0.
 */
export const migrationV2: Migration = {
  version: SCHEMA_VERSION_V2,
  name: "add_source_chunks_ordinal",
  up(db) {
    exec(
      db,
      `
      ALTER TABLE source_chunks
        ADD COLUMN ordinal INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX idx_source_chunks_book_ordinal
        ON source_chunks(book_id, ordinal);
      `,
    );
  },
};

/**
 * V3: knowledge card revision history.
 * Existing knowledge_cards rows remain readable and receive a revision=1 baseline snapshot.
 */
export const migrationV3: Migration = {
  version: SCHEMA_VERSION_V3,
  name: "create_knowledge_card_revisions",
  up(db) {
    exec(
      db,
      `
      CREATE TABLE knowledge_card_revisions (
        id TEXT PRIMARY KEY CHECK ${UUID_ID_CHECK_SQL},
        card_id TEXT NOT NULL,
        revision INTEGER NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        conditions TEXT,
        limitations TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (card_id, revision),
        FOREIGN KEY (card_id) REFERENCES knowledge_cards(id)
      );
      CREATE INDEX idx_knowledge_card_revisions_card_id
        ON knowledge_card_revisions(card_id);
      CREATE INDEX idx_knowledge_card_revisions_card_revision
        ON knowledge_card_revisions(card_id, revision);
      `,
    );

    const cards = db
      .prepare(
        `SELECT id, title, type, content, conditions, limitations, status, created_at
         FROM knowledge_cards`,
      )
      .all() as Array<{
      id: string;
      title: string;
      type: string;
      content: string;
      conditions: string | null;
      limitations: string | null;
      status: string;
      created_at: string;
    }>;
    const insert = db.prepare(
      `INSERT INTO knowledge_card_revisions(
         id, card_id, revision, title, type, content, conditions, limitations, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const card of cards) {
      insert.run(
        createBusinessId(),
        card.id,
        1,
        card.title,
        card.type,
        card.content,
        card.conditions,
        card.limitations,
        card.status,
        card.created_at,
      );
    }
  },
};

export const BUILTIN_MIGRATIONS: readonly Migration[] = [migrationV1, migrationV2, migrationV3];
