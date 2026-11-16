import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  DISCOVERY_REASON_SHARED_SOURCE,
  DISCOVERY_REASON_TEXT_OVERLAP,
  DISCOVERY_REASON_TYPE_RULE,
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_TYPE_CASE,
  KNOWLEDGE_CARD_TYPE_PRINCIPLE,
  PRINCIPLE_PARAGRAPH_ID,
  RELATION_STATUS_REJECTED,
  RELATION_STATUS_SUGGESTED,
  RELATION_STATUS_VERIFIED,
  RELATION_TYPE_EXAMPLE_OF,
  RELATION_TYPE_RELATED_TO,
  RELATION_TYPE_SUPPORTS,
  TEXT_OVERLAP_THRESHOLD,
  confirmRelation,
  deleteKnowledgeCard,
  discoverKnowledgeRelations,
  explainDiscoveryProposal,
  listConfirmedRelations,
  listRelations,
  listSuggestedRelations,
  loadKnowledgeCard,
  loadRelation,
  rejectRelation,
  suggestRelation,
  textOverlapScore,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";
import type { DatabaseSync } from "node:sqlite";

const temps: TempWorkspace[] = [];
const RELATIONS_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/relations.ts");
const KNOWLEDGE_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/knowledge.ts");

const OVERLAP_TEXT_A =
  "Local similarity fixture: knowledge cards need paragraph identifiers from the source document when they record a claim.";
const OVERLAP_TEXT_B =
  "Local similarity fixture: knowledge cards need paragraph identifiers from the source document when they record a claim, plus a short rider.";
const DISTINCT_CASE_TEXT = "A harbor workshop filed a delayed shipment report with no overlapping vocabulary.";
const DISTINCT_PRINCIPLE_TEXT = "Always rest the decision on a written checklist before approving a change.";

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function countRelations(
  db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[] } },
  filter?: { fromCardId?: string; toCardId?: string; relationType?: string; status?: string },
): number {
  if (!filter) {
    return (db.prepare(`SELECT COUNT(*) AS n FROM knowledge_relations`).get() as { n: number }).n;
  }
  const clauses: string[] = [];
  const values: string[] = [];
  if (filter.fromCardId) {
    clauses.push("from_card_id = ?");
    values.push(filter.fromCardId);
  }
  if (filter.toCardId) {
    clauses.push("to_card_id = ?");
    values.push(filter.toCardId);
  }
  if (filter.relationType) {
    clauses.push("relation_type = ?");
    values.push(filter.relationType);
  }
  if (filter.status) {
    clauses.push("status = ?");
    values.push(filter.status);
  }
  const sql = `SELECT COUNT(*) AS n FROM knowledge_relations${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}`;
  return (db.prepare(sql).get(...values) as { n: number }).n;
}

function insertCard(
  db: DatabaseSync,
  input: { title: string; type: string; content: string },
): string {
  const id = randomUUID();
  const stamp = "2026-11-16T14:00:00.000Z";
  db.prepare(
    `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.title, input.type, input.content, null, null, KNOWLEDGE_CARD_STATUS_DRAFT, stamp, stamp);
  return id;
}

function linkCardToChunk(db: DatabaseSync, cardId: string, chunkId: string): void {
  db.prepare(
    `INSERT INTO knowledge_sources(id, knowledge_card_id, source_chunk_id, relation_type)
     VALUES (?, ?, ?, ?)`,
  ).run(randomUUID(), cardId, chunkId, "derived_from");
}

describe("REL-002 local discovery of hidden knowledge relations", () => {
  it("discovers a shared source_chunk_id or paragraph locator as a suggested link with reason shared_source", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const sameChunkA = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const sameChunkB = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(sameChunkA.sources[0]?.sourceChunkId, sameChunkB.sources[0]?.sourceChunkId);

      const first = discoverKnowledgeRelations({ db: workspace.db });
      const sharedChunk = first.find(
        (relation) =>
          (relation.fromCardId === sameChunkA.id && relation.toCardId === sameChunkB.id) ||
          (relation.fromCardId === sameChunkB.id && relation.toCardId === sameChunkA.id),
      );
      assert.ok(sharedChunk, "cards that share a source chunk must be suggested");
      assert.equal(sharedChunk.reason, DISCOVERY_REASON_SHARED_SOURCE);
      assert.equal(sharedChunk.status, RELATION_STATUS_SUGGESTED);
      assert.equal(
        listConfirmedRelations(workspace.db).some((relation) => relation.id === sharedChunk.id),
        false,
        "a discovered suggestion must not appear in the confirmed-relations list before confirm",
      );

      const locatorChunkA = book.chunks.find((chunk) => chunk.location.paragraphId === "P1.5");
      const locatorChunkB = book.chunks.find((chunk) => chunk.location.paragraphId === "P2.4");
      assert.ok(locatorChunkA && locatorChunkB);
      const sharedLocator = locatorChunkA.location.paragraphId;
      assert.ok(sharedLocator);
      workspace.db
        .prepare(`UPDATE source_chunks SET location_json = ? WHERE id = ?`)
        .run(
          JSON.stringify({
            ...locatorChunkB.location,
            paragraphId: sharedLocator,
          }),
          locatorChunkB.id,
        );
      const locatorCardA = insertCard(workspace.db, {
        title: "Locator card A",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: "Alpha locator body uses an uncommon phrase about tidal ledgers.",
      });
      const locatorCardB = insertCard(workspace.db, {
        title: "Locator card B",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: "Beta locator body mentions orchard invoices instead of any shared wording.",
      });
      linkCardToChunk(workspace.db, locatorCardA, locatorChunkA.id);
      linkCardToChunk(workspace.db, locatorCardB, locatorChunkB.id);
      const reloadedA = loadKnowledgeCard(workspace.db, locatorCardA);
      const reloadedB = loadKnowledgeCard(workspace.db, locatorCardB);
      assert.notEqual(reloadedA.sources[0]?.sourceChunkId, reloadedB.sources[0]?.sourceChunkId);
      assert.equal(reloadedA.sources[0]?.paragraphId, reloadedB.sources[0]?.paragraphId);

      const second = discoverKnowledgeRelations({ db: workspace.db });
      const sharedLocatorHit = second.find(
        (relation) =>
          (relation.fromCardId === locatorCardA && relation.toCardId === locatorCardB) ||
          (relation.fromCardId === locatorCardB && relation.toCardId === locatorCardA),
      );
      assert.ok(sharedLocatorHit, "cards that share a paragraph locator must be suggested");
      assert.equal(sharedLocatorHit.reason, DISCOVERY_REASON_SHARED_SOURCE);
      assert.equal(sharedLocatorHit.status, RELATION_STATUS_SUGGESTED);
      assert.equal(listConfirmedRelations(workspace.db).some((relation) => relation.id === sharedLocatorHit.id), false);
    } finally {
      workspace.close();
    }
  });

  it("discovers reproducible title/body overlap above the documented threshold", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const overlap = textOverlapScore(OVERLAP_TEXT_A, OVERLAP_TEXT_B);
      const distinct = textOverlapScore(OVERLAP_TEXT_A, DISTINCT_CASE_TEXT);
      assert.ok(overlap >= TEXT_OVERLAP_THRESHOLD, `expected overlap ${overlap} >= ${TEXT_OVERLAP_THRESHOLD}`);
      assert.ok(distinct < TEXT_OVERLAP_THRESHOLD, `expected distinct ${distinct} < ${TEXT_OVERLAP_THRESHOLD}`);

      const fromId = insertCard(workspace.db, {
        title: "Overlap principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: OVERLAP_TEXT_A,
      });
      const toId = insertCard(workspace.db, {
        title: "Overlap companion",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: OVERLAP_TEXT_B,
      });
      const unrelatedId = insertCard(workspace.db, {
        title: "Unrelated note",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: DISTINCT_CASE_TEXT,
      });

      const discovered = discoverKnowledgeRelations({ db: workspace.db });
      const overlapHit = discovered.find(
        (relation) =>
          (relation.fromCardId === fromId && relation.toCardId === toId) ||
          (relation.fromCardId === toId && relation.toCardId === fromId),
      );
      assert.ok(overlapHit);
      assert.equal(overlapHit.reason, DISCOVERY_REASON_TEXT_OVERLAP);
      assert.equal(overlapHit.status, RELATION_STATUS_SUGGESTED);
      assert.equal(overlapHit.relationType, RELATION_TYPE_RELATED_TO);
      assert.equal(
        discovered.some(
          (relation) =>
            (relation.fromCardId === fromId && relation.toCardId === unrelatedId) ||
            (relation.fromCardId === unrelatedId && relation.toCardId === fromId),
        ),
        false,
      );
      assert.equal(listConfirmedRelations(workspace.db).length, 0);
    } finally {
      workspace.close();
    }
  });

  it("discovers a case-to-principle type rule as example_of with reason type_rule", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const caseId = insertCard(workspace.db, {
        title: "Harbor delay case",
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content: DISTINCT_CASE_TEXT,
      });
      const principleId = insertCard(workspace.db, {
        title: "Checklist principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: DISTINCT_PRINCIPLE_TEXT,
      });
      const proposal = explainDiscoveryProposal(
        loadKnowledgeCard(workspace.db, caseId),
        loadKnowledgeCard(workspace.db, principleId),
      );
      assert.deepEqual(proposal, {
        reason: DISCOVERY_REASON_TYPE_RULE,
        relationType: RELATION_TYPE_EXAMPLE_OF,
      });

      const discovered = discoverKnowledgeRelations({ db: workspace.db });
      const example = discovered.find(
        (relation) => relation.fromCardId === caseId && relation.toCardId === principleId,
      );
      assert.ok(example);
      assert.equal(example.reason, DISCOVERY_REASON_TYPE_RULE);
      assert.equal(example.relationType, RELATION_TYPE_EXAMPLE_OF);
      assert.equal(example.status, RELATION_STATUS_SUGGESTED);

      const support = discovered.find(
        (relation) => relation.fromCardId === principleId && relation.toCardId === caseId,
      );
      assert.ok(support);
      assert.equal(support.reason, DISCOVERY_REASON_TYPE_RULE);
      assert.equal(support.relationType, RELATION_TYPE_SUPPORTS);
      assert.equal(listConfirmedRelations(workspace.db).length, 0);
      assert.ok(discovered.every((relation) => relation.status === RELATION_STATUS_SUGGESTED));
    } finally {
      workspace.close();
    }
  });

  it("never writes verified_by_user from discover itself (D-017)", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      insertCard(workspace.db, {
        title: "Harbor delay case",
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content: DISTINCT_CASE_TEXT,
      });
      insertCard(workspace.db, {
        title: "Checklist principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: DISTINCT_PRINCIPLE_TEXT,
      });
      const beforeVerified = countRelations(workspace.db, { status: RELATION_STATUS_VERIFIED });
      const discovered = discoverKnowledgeRelations({ db: workspace.db });
      assert.ok(discovered.length >= 1);
      assert.ok(discovered.every((relation) => relation.status === RELATION_STATUS_SUGGESTED));
      assert.equal(countRelations(workspace.db, { status: RELATION_STATUS_VERIFIED }), beforeVerified);
      for (const relation of listRelations(workspace.db)) {
        assert.notEqual(relation.status, RELATION_STATUS_VERIFIED);
        if (discovered.some((item) => item.id === relation.id)) {
          assert.equal(relation.status, RELATION_STATUS_SUGGESTED);
        }
      }
    } finally {
      workspace.close();
    }
  });

  it("is idempotent, does not resurrect confirmed or rejected pair+type, and skips self-loops", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const caseId = insertCard(workspace.db, {
        title: "Harbor delay case",
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content: DISTINCT_CASE_TEXT,
      });
      const principleId = insertCard(workspace.db, {
        title: "Checklist principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: DISTINCT_PRINCIPLE_TEXT,
      });
      const loneId = insertCard(workspace.db, {
        title: "Lone card",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: "Zebra xylophone quilt uniquely avoids accidental overlap with the other cards.",
      });

      const first = discoverKnowledgeRelations({ db: workspace.db });
      const example = first.find((relation) => relation.fromCardId === caseId && relation.toCardId === principleId);
      assert.ok(example);
      const firstCount = countRelations(workspace.db);
      const second = discoverKnowledgeRelations({ db: workspace.db });
      const exampleAgain = second.find((relation) => relation.fromCardId === caseId && relation.toCardId === principleId);
      assert.ok(exampleAgain);
      assert.equal(exampleAgain.id, example.id);
      assert.equal(countRelations(workspace.db), firstCount);
      assert.equal(
        countRelations(workspace.db, {
          fromCardId: caseId,
          toCardId: principleId,
          relationType: RELATION_TYPE_EXAMPLE_OF,
        }),
        1,
      );

      const confirmed = confirmRelation({ db: workspace.db, relationId: example.id });
      assert.equal(confirmed.status, RELATION_STATUS_VERIFIED);
      discoverKnowledgeRelations({ db: workspace.db });
      assert.equal(loadRelation(workspace.db, example.id).status, RELATION_STATUS_VERIFIED);
      assert.equal(
        countRelations(workspace.db, {
          fromCardId: caseId,
          toCardId: principleId,
          relationType: RELATION_TYPE_EXAMPLE_OF,
        }),
        1,
      );
      assert.equal(
        listSuggestedRelations(workspace.db).some((relation) => relation.id === example.id),
        false,
      );
      assert.equal(listConfirmedRelations(workspace.db).some((relation) => relation.id === example.id), true);

      const support = listSuggestedRelations(workspace.db).find(
        (relation) => relation.fromCardId === principleId && relation.toCardId === caseId,
      );
      assert.ok(support);
      const rejected = rejectRelation({ db: workspace.db, relationId: support.id });
      assert.equal(rejected.status, RELATION_STATUS_REJECTED);
      assert.notEqual(rejected.status, RELATION_STATUS_VERIFIED);
      discoverKnowledgeRelations({ db: workspace.db });
      assert.equal(loadRelation(workspace.db, support.id).status, RELATION_STATUS_REJECTED);
      assert.equal(
        countRelations(workspace.db, {
          fromCardId: principleId,
          toCardId: caseId,
          relationType: RELATION_TYPE_SUPPORTS,
        }),
        1,
      );
      assert.equal(listSuggestedRelations(workspace.db).some((relation) => relation.id === support.id), false);
      assert.equal(listConfirmedRelations(workspace.db).some((relation) => relation.id === support.id), false);

      assert.equal(
        explainDiscoveryProposal(loadKnowledgeCard(workspace.db, loneId), loadKnowledgeCard(workspace.db, loneId)),
        null,
      );
      assert.equal(
        listRelations(workspace.db).some((relation) => relation.fromCardId === relation.toCardId),
        false,
      );
      assert.throws(
        () =>
          suggestRelation({
            db: workspace.db,
            fromCardId: loneId,
            toCardId: loneId,
            relationType: RELATION_TYPE_RELATED_TO,
          }),
        /Cannot suggest a relation from a knowledge card to itself/,
      );
    } finally {
      workspace.close();
    }
  });

  it("confirms a discovered suggestion into a formal relation and rejects another so it does not remain formal", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const caseId = insertCard(workspace.db, {
        title: "Harbor delay case",
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content: DISTINCT_CASE_TEXT,
      });
      const principleId = insertCard(workspace.db, {
        title: "Checklist principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: DISTINCT_PRINCIPLE_TEXT,
      });
      const discovered = discoverKnowledgeRelations({ db: workspace.db });
      const example = discovered.find((relation) => relation.fromCardId === caseId && relation.toCardId === principleId);
      const support = discovered.find((relation) => relation.fromCardId === principleId && relation.toCardId === caseId);
      assert.ok(example && support);

      const confirmed = confirmRelation({ db: workspace.db, relationId: example.id });
      assert.equal(confirmed.status, RELATION_STATUS_VERIFIED);
      assert.equal(confirmed.relationType, RELATION_TYPE_EXAMPLE_OF);
      assert.equal(listConfirmedRelations(workspace.db).some((relation) => relation.id === example.id), true);
      assert.equal(listSuggestedRelations(workspace.db).some((relation) => relation.id === example.id), false);

      const rejected = rejectRelation({ db: workspace.db, relationId: support.id });
      assert.equal(rejected.status, RELATION_STATUS_REJECTED);
      assert.equal(listConfirmedRelations(workspace.db).some((relation) => relation.id === support.id), false);
      assert.equal(listSuggestedRelations(workspace.db).some((relation) => relation.id === support.id), false);
    } finally {
      workspace.close();
    }
  });

  it("still cleans up discovered relations when either end card is deleted", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const caseId = insertCard(workspace.db, {
        title: "Harbor delay case",
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content: DISTINCT_CASE_TEXT,
      });
      const principleId = insertCard(workspace.db, {
        title: "Checklist principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: DISTINCT_PRINCIPLE_TEXT,
      });
      const discovered = discoverKnowledgeRelations({ db: workspace.db });
      assert.ok(discovered.length >= 2);
      const ids = discovered.map((relation) => relation.id);
      confirmRelation({ db: workspace.db, relationId: discovered[0]!.id });

      deleteKnowledgeCard(workspace.db, caseId);
      for (const id of ids) {
        assert.equal(countRelations(workspace.db, { fromCardId: caseId }), 0);
        assert.throws(() => loadRelation(workspace.db, id), /not found/);
      }
      assert.equal(
        countRelations(workspace.db, { fromCardId: principleId }) +
          countRelations(workspace.db, { toCardId: principleId }),
        0,
      );
      loadKnowledgeCard(workspace.db, principleId);
    } finally {
      workspace.close();
    }
  });

  it("keeps discover from assigning verified_by_user in source, and leaves P-012 merge/delete contracts untouched", () => {
    const source = fs.readFileSync(RELATIONS_SOURCE, "utf8");
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const discoverStart = withoutComments.indexOf("export function discoverKnowledgeRelations");
    assert.ok(discoverStart >= 0);
    const discoverBody = withoutComments.slice(discoverStart);
    assert.match(discoverBody, /suggestRelation/);
    assert.doesNotMatch(discoverBody, /RELATION_STATUS_VERIFIED/);
    assert.doesNotMatch(discoverBody, /verified_by_user/);
    assert.doesNotMatch(
      discoverBody,
      /SET status = \?[\s\S]{0,80}RELATION_STATUS_VERIFIED|confirmRelation/,
    );

    const knowledge = fs.readFileSync(KNOWLEDGE_SOURCE, "utf8");
    assert.doesNotMatch(knowledge, /INSERT INTO knowledge_relations/);
    assert.match(knowledge, /DELETE FROM knowledge_relations WHERE from_card_id = \? OR to_card_id = \?/);
  });
});
