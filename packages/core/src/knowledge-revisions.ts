import type { DatabaseSync } from "node:sqlite";
import { loadKnowledgeCard } from "./knowledge.ts";
import type { KnowledgeCardRecord } from "./types.ts";
import { newId, nowIso, withTransaction } from "./util.ts";

export type KnowledgeCardRevisionRecord = {
  id: string;
  cardId: string;
  revision: number;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  createdAt: string;
};

export type RollbackKnowledgeCardToRevisionOptions = {
  db: DatabaseSync;
  cardId: string;
  revisionId: string;
  now?: Date;
};

export type KnowledgeCardRevisionDiffField =
  | "title"
  | "type"
  | "content"
  | "conditions"
  | "limitations";

const BODY_FIELDS: readonly KnowledgeCardRevisionDiffField[] = [
  "title",
  "type",
  "content",
  "conditions",
  "limitations",
];

type RevisionRow = {
  id: string;
  card_id: string;
  revision: number;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  created_at: string;
};

export type KnowledgeCardRevisionSnapshot = {
  cardId: string;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
};

function mapRevision(row: RevisionRow): KnowledgeCardRevisionRecord {
  return {
    id: row.id,
    cardId: row.card_id,
    revision: row.revision,
    title: row.title,
    type: row.type,
    content: row.content,
    conditions: row.conditions,
    limitations: row.limitations,
    status: row.status,
    createdAt: row.created_at,
  };
}

function nextRevisionNumber(db: DatabaseSync, cardId: string): number {
  const row = db
    .prepare(`SELECT MAX(revision) AS max_revision FROM knowledge_card_revisions WHERE card_id = ?`)
    .get(cardId) as { max_revision: number | null };
  return (row.max_revision ?? 0) + 1;
}

/** Append a new revision snapshot. Callers must invoke this in the same transaction as the card write. */
export function appendKnowledgeCardRevision(
  db: DatabaseSync,
  snapshot: KnowledgeCardRevisionSnapshot,
  createdAt: string,
): KnowledgeCardRevisionRecord {
  const id = newId();
  const revision = nextRevisionNumber(db, snapshot.cardId);
  db.prepare(
    `INSERT INTO knowledge_card_revisions(
       id, card_id, revision, title, type, content, conditions, limitations, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    snapshot.cardId,
    revision,
    snapshot.title,
    snapshot.type,
    snapshot.content,
    snapshot.conditions,
    snapshot.limitations,
    snapshot.status,
    createdAt,
  );
  return loadKnowledgeCardRevision(db, id);
}

export function deleteKnowledgeCardRevisions(db: DatabaseSync, cardId: string): void {
  db.prepare(`DELETE FROM knowledge_card_revisions WHERE card_id = ?`).run(cardId);
}

export function listKnowledgeCardRevisions(
  db: DatabaseSync,
  cardId: string,
): KnowledgeCardRevisionRecord[] {
  const rows = db
    .prepare(
      `SELECT id, card_id, revision, title, type, content, conditions, limitations, status, created_at
       FROM knowledge_card_revisions
       WHERE card_id = ?
       ORDER BY revision ASC, id ASC`,
    )
    .all(cardId) as RevisionRow[];
  return rows.map(mapRevision);
}

export function loadKnowledgeCardRevision(
  db: DatabaseSync,
  revisionId: string,
): KnowledgeCardRevisionRecord {
  const row = db
    .prepare(
      `SELECT id, card_id, revision, title, type, content, conditions, limitations, status, created_at
       FROM knowledge_card_revisions WHERE id = ?`,
    )
    .get(revisionId) as RevisionRow | undefined;
  if (!row) {
    throw new Error(`Knowledge card revision not found: ${revisionId}`);
  }
  return mapRevision(row);
}

/**
 * Restore body fields from a historical revision and append a new revision row.
 * D-017: status is left unchanged. Rollback never auto-confirms and never rewrites old rows.
 */
export function rollbackKnowledgeCardToRevision(
  options: RollbackKnowledgeCardToRevisionOptions,
): KnowledgeCardRecord {
  const existing = loadKnowledgeCard(options.db, options.cardId);
  const target = loadKnowledgeCardRevision(options.db, options.revisionId);
  if (target.cardId !== options.cardId) {
    throw new Error(`Revision ${options.revisionId} does not belong to knowledge card ${options.cardId}`);
  }
  const stamp = nowIso(options.now);
  withTransaction(options.db, () => {
    options.db
      .prepare(
        `UPDATE knowledge_cards
         SET title = ?, type = ?, content = ?, conditions = ?, limitations = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        target.title,
        target.type,
        target.content,
        target.conditions,
        target.limitations,
        stamp,
        options.cardId,
      );
    appendKnowledgeCardRevision(
      options.db,
      {
        cardId: options.cardId,
        title: target.title,
        type: target.type,
        content: target.content,
        conditions: target.conditions,
        limitations: target.limitations,
        status: existing.status,
      },
      stamp,
    );
  });
  const rolledBack = loadKnowledgeCard(options.db, options.cardId);
  if (rolledBack.status !== existing.status) {
    throw new Error("Rolling back a knowledge card must not change its status");
  }
  return rolledBack;
}

export function summarizeKnowledgeCardRevisionDiff(
  a: KnowledgeCardRevisionRecord,
  b: KnowledgeCardRevisionRecord,
): KnowledgeCardRevisionDiffField[] {
  return BODY_FIELDS.filter((field) => a[field] !== b[field]);
}
