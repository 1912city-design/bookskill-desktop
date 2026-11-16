import type { DatabaseSync } from "node:sqlite";
import { KNOWLEDGE_CARD_TYPE_CASE, KNOWLEDGE_CARD_TYPE_PRINCIPLE } from "./constants.ts";
import { listKnowledgeCards } from "./knowledge.ts";
import type { KnowledgeCardRecord } from "./types.ts";
import { newId, withTransaction } from "./util.ts";

/** Formal / confirmed relation status. Same token as knowledge card confirmation (D-017). */
export const RELATION_STATUS_SUGGESTED = "suggested";
export const RELATION_STATUS_VERIFIED = "verified_by_user";
/** Rejected suggestions are marked, not deleted, so they cannot later appear as formal relations. */
export const RELATION_STATUS_REJECTED = "rejected";

export const RELATION_TYPE_SUPPORTS = "supports";
export const RELATION_TYPE_CONTRADICTS = "contradicts";
export const RELATION_TYPE_EXAMPLE_OF = "example_of";
export const RELATION_TYPE_RELATED_TO = "related_to";

export const ALLOWED_RELATION_TYPES = [
  RELATION_TYPE_SUPPORTS,
  RELATION_TYPE_CONTRADICTS,
  RELATION_TYPE_EXAMPLE_OF,
  RELATION_TYPE_RELATED_TO,
] as const;

export type AllowedRelationType = (typeof ALLOWED_RELATION_TYPES)[number];

export type KnowledgeRelationRecord = {
  id: string;
  fromCardId: string;
  toCardId: string;
  relationType: string;
  status: string;
};

export type SuggestRelationOptions = {
  db: DatabaseSync;
  fromCardId: string;
  toCardId: string;
  relationType: string;
};

export type ConfirmRelationOptions = {
  db: DatabaseSync;
  relationId: string;
};

export type RejectRelationOptions = {
  db: DatabaseSync;
  relationId: string;
};

export type ListRelationsFilter = {
  status?: string;
};

export const DISCOVERY_REASON_SHARED_SOURCE = "shared_source";
export const DISCOVERY_REASON_TEXT_OVERLAP = "text_overlap";
export const DISCOVERY_REASON_TYPE_RULE = "type_rule";

export const DISCOVERY_REASONS = [
  DISCOVERY_REASON_SHARED_SOURCE,
  DISCOVERY_REASON_TEXT_OVERLAP,
  DISCOVERY_REASON_TYPE_RULE,
] as const;

export type DiscoveryReason = (typeof DISCOVERY_REASONS)[number];

/**
 * Jaccard similarity threshold on title+body tokens (Latin words length>=2,
 * Han characters and adjacent Han bigrams). Documented in REL-002-REPORT.
 * Tests use fixed synthetic text that scores clearly above or below this cut.
 */
export const TEXT_OVERLAP_THRESHOLD = 0.45;

export type DiscoveryProposal = {
  reason: DiscoveryReason;
  relationType: AllowedRelationType;
};

export type DiscoveredKnowledgeRelation = KnowledgeRelationRecord & {
  reason: DiscoveryReason;
};

export type DiscoverKnowledgeRelationsOptions = {
  db: DatabaseSync;
};

type RelationRow = {
  id: string;
  from_card_id: string;
  to_card_id: string;
  relation_type: string;
  status: string;
};

export function isAllowedRelationType(value: string): value is AllowedRelationType {
  return (ALLOWED_RELATION_TYPES as readonly string[]).includes(value);
}

/**
 * Rule-based type proposal for tests and UI defaults. This never writes a row.
 * Callers must still pass an explicit type to suggestRelation.
 */
export function proposeRelationType(
  fromCard: { type: string; title?: string; content?: string },
  toCard: { type: string; title?: string; content?: string },
): AllowedRelationType {
  if (fromCard.type === KNOWLEDGE_CARD_TYPE_CASE && toCard.type === KNOWLEDGE_CARD_TYPE_PRINCIPLE) {
    return RELATION_TYPE_EXAMPLE_OF;
  }
  if (fromCard.type === KNOWLEDGE_CARD_TYPE_PRINCIPLE && toCard.type === KNOWLEDGE_CARD_TYPE_CASE) {
    return RELATION_TYPE_SUPPORTS;
  }
  const fromText = `${fromCard.title ?? ""} ${fromCard.content ?? ""}`;
  const toText = `${toCard.title ?? ""} ${toCard.content ?? ""}`;
  if (/contradict|冲突|反驳|空洞回声/i.test(fromText) || /contradict|冲突|反驳|空洞回声/i.test(toText)) {
    return RELATION_TYPE_CONTRADICTS;
  }
  return RELATION_TYPE_RELATED_TO;
}

export function loadRelation(db: DatabaseSync, relationId: string): KnowledgeRelationRecord {
  const row = db
    .prepare(
      `SELECT id, from_card_id, to_card_id, relation_type, status
       FROM knowledge_relations WHERE id = ?`,
    )
    .get(relationId) as RelationRow | undefined;
  if (!row) {
    throw new Error(`Knowledge relation not found: ${relationId}`);
  }
  return mapRelation(row);
}

/**
 * Write a suggested relation. Both cards must already exist. This never writes
 * a formal (verified_by_user) row; only confirmRelation may do that.
 */
export function suggestRelation(options: SuggestRelationOptions): KnowledgeRelationRecord {
  if (options.fromCardId === options.toCardId) {
    throw new Error("Cannot suggest a relation from a knowledge card to itself");
  }
  if (!isAllowedRelationType(options.relationType)) {
    throw new Error(
      `Unsupported relation type: ${options.relationType}. Allowed types: ${ALLOWED_RELATION_TYPES.join(", ")}`,
    );
  }
  assertCardExists(options.db, options.fromCardId);
  assertCardExists(options.db, options.toCardId);

  const id = newId();
  options.db
    .prepare(
      `INSERT INTO knowledge_relations(id, from_card_id, to_card_id, relation_type, status)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(id, options.fromCardId, options.toCardId, options.relationType, RELATION_STATUS_SUGGESTED);
  return loadRelation(options.db, id);
}

/**
 * Promote a suggested relation to a formal one. Listing or suggesting must not
 * call this; only an explicit user-confirm API call may.
 */
export function confirmRelation(options: ConfirmRelationOptions): KnowledgeRelationRecord {
  const existing = loadRelation(options.db, options.relationId);
  if (existing.status === RELATION_STATUS_VERIFIED) {
    return existing;
  }
  if (existing.status !== RELATION_STATUS_SUGGESTED) {
    throw new Error(`Only a suggested relation can be confirmed (status is ${existing.status})`);
  }
  options.db
    .prepare(`UPDATE knowledge_relations SET status = ? WHERE id = ?`)
    .run(RELATION_STATUS_VERIFIED, options.relationId);
  return loadRelation(options.db, options.relationId);
}

/**
 * Reject a suggestion by marking it `rejected` (not deleted). Rejected rows are
 * excluded from both the suggested and confirmed lists, and can never remain formal.
 */
export function rejectRelation(options: RejectRelationOptions): KnowledgeRelationRecord {
  const existing = loadRelation(options.db, options.relationId);
  if (existing.status === RELATION_STATUS_VERIFIED) {
    throw new Error("A confirmed formal relation cannot be rejected by this API");
  }
  if (existing.status === RELATION_STATUS_REJECTED) {
    return existing;
  }
  if (existing.status !== RELATION_STATUS_SUGGESTED) {
    throw new Error(`Only a suggested relation can be rejected (status is ${existing.status})`);
  }
  options.db
    .prepare(`UPDATE knowledge_relations SET status = ? WHERE id = ?`)
    .run(RELATION_STATUS_REJECTED, options.relationId);
  const rejected = loadRelation(options.db, options.relationId);
  if (rejected.status === RELATION_STATUS_VERIFIED) {
    throw new Error("Rejecting a relation must not leave it as a formal relation");
  }
  return rejected;
}

export function listRelations(db: DatabaseSync, filter: ListRelationsFilter = {}): KnowledgeRelationRecord[] {
  const rows = (
    filter.status
      ? (db
          .prepare(
            `SELECT id, from_card_id, to_card_id, relation_type, status
             FROM knowledge_relations
             WHERE status = ?
             ORDER BY rowid, id`,
          )
          .all(filter.status) as RelationRow[])
      : (db
          .prepare(
            `SELECT id, from_card_id, to_card_id, relation_type, status
             FROM knowledge_relations
             ORDER BY rowid, id`,
          )
          .all() as RelationRow[])
  );
  return rows.map(mapRelation);
}

export function listSuggestedRelations(db: DatabaseSync): KnowledgeRelationRecord[] {
  return listRelations(db, { status: RELATION_STATUS_SUGGESTED });
}

export function listConfirmedRelations(db: DatabaseSync): KnowledgeRelationRecord[] {
  return listRelations(db, { status: RELATION_STATUS_VERIFIED });
}

function mapRelation(row: RelationRow): KnowledgeRelationRecord {
  return {
    id: row.id,
    fromCardId: row.from_card_id,
    toCardId: row.to_card_id,
    relationType: row.relation_type,
    status: row.status,
  };
}

function assertCardExists(db: DatabaseSync, cardId: string): void {
  const row = db.prepare(`SELECT id FROM knowledge_cards WHERE id = ?`).get(cardId) as { id: string } | undefined;
  if (!row) {
    throw new Error(`Knowledge card not found: ${cardId}`);
  }
}


export function isDiscoveryReason(value: string): value is DiscoveryReason {
  return (DISCOVERY_REASONS as readonly string[]).includes(value);
}

/**
 * Token Jaccard similarity of two strings. Local and deterministic; no
 * embeddings or external services.
 */
export function textOverlapScore(left: string, right: string): number {
  const leftTokens = tokenizeForOverlap(left);
  const rightTokens = tokenizeForOverlap(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1;
    }
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

/**
 * Explain why a directed card pair would be suggested, without writing a row.
 * Priority: shared_source > type_rule > text_overlap. Returns null when no
 * discovery rule matches (including self-loops).
 */
export function explainDiscoveryProposal(
  fromCard: KnowledgeCardRecord,
  toCard: KnowledgeCardRecord,
): DiscoveryProposal | null {
  if (fromCard.id === toCard.id) {
    return null;
  }
  const relationType = proposeRelationType(fromCard, toCard);
  if (cardsShareSource(fromCard, toCard)) {
    return { reason: DISCOVERY_REASON_SHARED_SOURCE, relationType };
  }
  if (hasTypeRule(fromCard, toCard)) {
    return { reason: DISCOVERY_REASON_TYPE_RULE, relationType };
  }
  if (textOverlapScore(cardSearchText(fromCard), cardSearchText(toCard)) >= TEXT_OVERLAP_THRESHOLD) {
    return { reason: DISCOVERY_REASON_TEXT_OVERLAP, relationType };
  }
  return null;
}

/**
 * Scan the library and write missing hidden links as status=suggested only.
 * Never writes verified_by_user. Idempotent for the same (from, to, type):
 * existing suggested rows are reused; confirmed rows are left untouched;
 * rejected same pair+type is not re-inserted.
 */
export function discoverKnowledgeRelations(
  options: DiscoverKnowledgeRelationsOptions,
): DiscoveredKnowledgeRelation[] {
  const cards = listKnowledgeCards(options.db);
  const cardsById = new Map(cards.map((card) => [card.id, card] as const));
  const existingByKey = indexExistingRelations(options.db);

  withTransaction(options.db, () => {
    for (const fromCard of cards) {
      for (const toCard of cards) {
        const proposal = explainDiscoveryProposal(fromCard, toCard);
        if (!proposal) {
          continue;
        }
        const key = relationKey(fromCard.id, toCard.id, proposal.relationType);
        if (existingByKey.has(key)) {
          continue;
        }
        const created = suggestRelation({
          db: options.db,
          fromCardId: fromCard.id,
          toCardId: toCard.id,
          relationType: proposal.relationType,
        });
        existingByKey.set(key, created);
      }
    }
  });

  const discoveries: DiscoveredKnowledgeRelation[] = [];
  for (const relation of listSuggestedRelations(options.db)) {
    const fromCard = cardsById.get(relation.fromCardId);
    const toCard = cardsById.get(relation.toCardId);
    if (!fromCard || !toCard) {
      continue;
    }
    const proposal = explainDiscoveryProposal(fromCard, toCard);
    if (!proposal || proposal.relationType !== relation.relationType) {
      continue;
    }
    if (relation.status !== RELATION_STATUS_SUGGESTED) {
      throw new Error("Discovery must only return suggested relations");
    }
    discoveries.push({ ...relation, reason: proposal.reason });
  }
  return discoveries;
}

function tokenizeForOverlap(text: string): Set<string> {
  const tokens = new Set<string>();
  const normalized = text.toLowerCase();
  for (const match of normalized.matchAll(/[a-z0-9]+/g)) {
    if (match[0].length >= 2) {
      tokens.add(match[0]);
    }
  }
  for (const match of normalized.matchAll(/[\u3400-\u9fff]+/g)) {
    const run = match[0];
    for (const character of run) {
      tokens.add(character);
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.add(run.slice(index, index + 2));
    }
  }
  return tokens;
}

function cardSearchText(card: { title?: string; content?: string }): string {
  return `${card.title ?? ""} ${card.content ?? ""}`;
}

function cardsShareSource(fromCard: KnowledgeCardRecord, toCard: KnowledgeCardRecord): boolean {
  const fromChunks = new Set(fromCard.sources.map((source) => source.sourceChunkId));
  for (const source of toCard.sources) {
    if (fromChunks.has(source.sourceChunkId)) {
      return true;
    }
  }
  const fromLocators = new Set(
    fromCard.sources.map((source) => source.paragraphId).filter((value): value is string => Boolean(value)),
  );
  for (const source of toCard.sources) {
    if (source.paragraphId && fromLocators.has(source.paragraphId)) {
      return true;
    }
  }
  return false;
}

function hasTypeRule(
  fromCard: { type: string },
  toCard: { type: string },
): boolean {
  return (
    (fromCard.type === KNOWLEDGE_CARD_TYPE_CASE && toCard.type === KNOWLEDGE_CARD_TYPE_PRINCIPLE) ||
    (fromCard.type === KNOWLEDGE_CARD_TYPE_PRINCIPLE && toCard.type === KNOWLEDGE_CARD_TYPE_CASE)
  );
}

function relationKey(fromCardId: string, toCardId: string, relationType: string): string {
  return `${fromCardId}\t${toCardId}\t${relationType}`;
}

function indexExistingRelations(db: DatabaseSync): Map<string, KnowledgeRelationRecord> {
  const index = new Map<string, KnowledgeRelationRecord>();
  for (const relation of listRelations(db)) {
    const key = relationKey(relation.fromCardId, relation.toCardId, relation.relationType);
    if (!index.has(key)) {
      index.set(key, relation);
    }
  }
  return index;
}
