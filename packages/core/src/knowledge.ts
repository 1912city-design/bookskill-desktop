import type { DatabaseSync } from "node:sqlite";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  KNOWLEDGE_CARD_TYPE_PRINCIPLE,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  RELATION_DERIVED_FROM,
} from "./constants.ts";
import { findChunkByParagraphId, loadBook } from "./import-book.ts";
import type { ImportedChunk, KnowledgeCardRecord, KnowledgeSourceRecord } from "./types.ts";
import { newId, nowIso, withTransaction } from "./util.ts";

export type DraftCardOptions = {
  db: DatabaseSync;
  bookId: string;
  paragraphId: string;
  now?: Date;
};

export type ConfirmCardOptions = {
  db: DatabaseSync;
  cardId: string;
  title?: string;
  content?: string;
  conditions?: string | null;
  limitations?: string | null;
  now?: Date;
};

export type UpdateKnowledgeCardOptions = {
  db: DatabaseSync;
  cardId: string;
  title?: string;
  content?: string;
  conditions?: string | null;
  limitations?: string | null;
  now?: Date;
};

export type MergeKnowledgeCardsOptions = {
  db: DatabaseSync;
  survivingCardId: string;
  absorbedCardId: string;
  now?: Date;
};

export function draftKnowledgeCardFromLocator(options: DraftCardOptions): KnowledgeCardRecord {
  const book = loadBook(options.db, options.bookId);
  const chunk = findChunkByParagraphId(book, options.paragraphId);
  const stamp = nowIso(options.now);
  const id = newId();
  const draft = describeChunk(chunk, options.paragraphId);
  withTransaction(options.db, () => {
    options.db
      .prepare(
        `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        draft.title,
        draft.type,
        draft.content,
        draft.conditions,
        draft.limitations,
        KNOWLEDGE_CARD_STATUS_DRAFT,
        stamp,
        stamp,
      );
    options.db
      .prepare(
        `INSERT INTO knowledge_sources(id, knowledge_card_id, source_chunk_id, relation_type)
         VALUES (?, ?, ?, ?)`,
      )
      .run(newId(), id, chunk.id, RELATION_DERIVED_FROM);
  });
  return loadKnowledgeCard(options.db, id);
}

export function confirmKnowledgeCard(options: ConfirmCardOptions): KnowledgeCardRecord {
  const existing = loadKnowledgeCard(options.db, options.cardId);
  const stamp = nowIso(options.now);
  options.db
    .prepare(
      `UPDATE knowledge_cards
       SET title = ?, content = ?, conditions = ?, limitations = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      options.title ?? existing.title,
      options.content ?? existing.content,
      options.conditions === undefined ? existing.conditions : options.conditions,
      options.limitations === undefined ? existing.limitations : options.limitations,
      KNOWLEDGE_CARD_STATUS_VERIFIED,
      stamp,
      options.cardId,
    );
  return loadKnowledgeCard(options.db, options.cardId);
}

/**
 * Delete a knowledge card and its source links. Books and source chunks stay put.
 */
export function deleteKnowledgeCard(db: DatabaseSync, cardId: string): void {
  const existing = db.prepare(`SELECT id FROM knowledge_cards WHERE id = ?`).get(cardId) as { id: string } | undefined;
  if (!existing) {
    throw new Error(`Knowledge card not found: ${cardId}`);
  }
  withTransaction(db, () => {
    db.prepare(`DELETE FROM knowledge_relations WHERE from_card_id = ? OR to_card_id = ?`).run(cardId, cardId);
    db.prepare(`DELETE FROM knowledge_sources WHERE knowledge_card_id = ?`).run(cardId);
    db.prepare(`DELETE FROM skill_sources WHERE knowledge_card_id = ?`).run(cardId);
    db.prepare(`UPDATE evidence_refs SET knowledge_card_id = NULL WHERE knowledge_card_id = ?`).run(cardId);
    db.prepare(`DELETE FROM knowledge_cards WHERE id = ?`).run(cardId);
  });
}

export function loadKnowledgeCard(db: DatabaseSync, cardId: string): KnowledgeCardRecord {
  const row = db
    .prepare(
      `SELECT id, title, type, content, conditions, limitations, status, created_at, updated_at
       FROM knowledge_cards WHERE id = ?`,
    )
    .get(cardId) as
    | {
        id: string;
        title: string;
        type: string;
        content: string;
        conditions: string | null;
        limitations: string | null;
        status: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`Knowledge card not found: ${cardId}`);
  }
  const sources = db
    .prepare(
      `SELECT ks.id, ks.knowledge_card_id, ks.source_chunk_id, ks.relation_type, sc.location_json
       FROM knowledge_sources ks
       JOIN source_chunks sc ON sc.id = ks.source_chunk_id
       WHERE ks.knowledge_card_id = ?
       ORDER BY ks.rowid`,
    )
    .all(cardId) as Array<{
    id: string;
    knowledge_card_id: string;
    source_chunk_id: string;
    relation_type: string;
    location_json: string;
  }>;
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    content: row.content,
    conditions: row.conditions,
    limitations: row.limitations,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    sources: sources.map((source) => {
      const location = JSON.parse(source.location_json) as { paragraphId?: string | null };
      return {
        id: source.id,
        knowledgeCardId: source.knowledge_card_id,
        sourceChunkId: source.source_chunk_id,
        relationType: source.relation_type,
        paragraphId: location.paragraphId ?? null,
      } satisfies KnowledgeSourceRecord;
    }),
  };
}

export function updateKnowledgeCard(options: UpdateKnowledgeCardOptions): KnowledgeCardRecord {
  const existing = loadKnowledgeCard(options.db, options.cardId);
  const stamp = nowIso(options.now);
  options.db
    .prepare(
      `UPDATE knowledge_cards
       SET title = ?, content = ?, conditions = ?, limitations = ?, updated_at = ?
       WHERE id = ?`,
    )
    .run(
      options.title ?? existing.title,
      options.content ?? existing.content,
      options.conditions === undefined ? existing.conditions : options.conditions,
      options.limitations === undefined ? existing.limitations : options.limitations,
      stamp,
      options.cardId,
    );
  const updated = loadKnowledgeCard(options.db, options.cardId);
  if (updated.status !== existing.status) {
    throw new Error("Editing a knowledge card must not change its status");
  }
  return updated;
}

export function listKnowledgeCards(db: DatabaseSync): KnowledgeCardRecord[] {
  const rows = db
    .prepare(
      `SELECT id FROM knowledge_cards
       ORDER BY updated_at DESC, created_at DESC, id`,
    )
    .all() as Array<{ id: string }>;
  return rows.map((row) => loadKnowledgeCard(db, row.id));
}

/**
 * Merge by moving or deduplicating sources onto the surviving card, then
 * deleting the absorbed card. Books and source chunks stay put.
 *
 * knowledge_relations has foreign keys to knowledge_cards, and
 * deleteKnowledgeCard already removes relations involving the absorbed card.
 * A merge relation that pointed at the absorbed card would dangle (or be
 * deleted immediately), so this function does not record one.
 *
 * Status is left unchanged: a draft survivor stays draft.
 */
export function mergeKnowledgeCards(options: MergeKnowledgeCardsOptions): KnowledgeCardRecord {
  if (options.survivingCardId === options.absorbedCardId) {
    throw new Error("Cannot merge a knowledge card with itself");
  }
  const surviving = loadKnowledgeCard(options.db, options.survivingCardId);
  const absorbed = loadKnowledgeCard(options.db, options.absorbedCardId);
  const stamp = nowIso(options.now);
  const existingChunkIds = new Set(surviving.sources.map((source) => source.sourceChunkId));

  withTransaction(options.db, () => {
    for (const source of absorbed.sources) {
      if (existingChunkIds.has(source.sourceChunkId)) {
        continue;
      }
      options.db
        .prepare(`UPDATE knowledge_sources SET knowledge_card_id = ? WHERE id = ?`)
        .run(options.survivingCardId, source.id);
      existingChunkIds.add(source.sourceChunkId);
    }
    options.db
      .prepare(`UPDATE knowledge_cards SET updated_at = ? WHERE id = ?`)
      .run(stamp, options.survivingCardId);
    // Inline the delete contract so merge and cleanup share one transaction.
    // Do not insert a knowledge_relations row that would dangle after this delete.
    options.db
      .prepare(`DELETE FROM knowledge_relations WHERE from_card_id = ? OR to_card_id = ?`)
      .run(options.absorbedCardId, options.absorbedCardId);
    options.db.prepare(`DELETE FROM knowledge_sources WHERE knowledge_card_id = ?`).run(options.absorbedCardId);
    options.db.prepare(`DELETE FROM skill_sources WHERE knowledge_card_id = ?`).run(options.absorbedCardId);
    options.db
      .prepare(`UPDATE evidence_refs SET knowledge_card_id = NULL WHERE knowledge_card_id = ?`)
      .run(options.absorbedCardId);
    options.db.prepare(`DELETE FROM knowledge_cards WHERE id = ?`).run(options.absorbedCardId);
  });

  const merged = loadKnowledgeCard(options.db, options.survivingCardId);
  if (merged.status !== surviving.status) {
    throw new Error("Merging knowledge cards must not change the surviving card status");
  }
  return merged;
}

function describeChunk(chunk: ImportedChunk, paragraphId: string): {
  title: string;
  type: string;
  content: string;
  conditions: string;
  limitations: string;
} {
  const normalized = paragraphId.replace(/^\[/, "").replace(/\]$/, "");
  if (normalized === PRINCIPLE_PARAGRAPH_ID) {
    return {
      title: "知识卡必须引用段落定位符",
      type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
      content: PRINCIPLE_SENTENCE,
      conditions: "从书籍生成或保存知识卡、以及在对话中给出书中结论时适用。",
      limitations: "不能把没有来源的句子或空洞回声当作书中结论。",
    };
  }
  return {
    title: chunk.location.chapterTitle ?? `来自 ${normalized} 的知识卡`,
    type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
    content: chunk.text,
    conditions: "仅在能定位到来源段落时适用。",
    limitations: "来源定位未确认的段落不得伪装成精确引用。",
  };
}
