import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  ALLOWED_RELATION_TYPES,
  HOLLOW_ECHO_PARAGRAPH_ID,
  KNOWLEDGE_CARD_TYPE_CASE,
  KNOWLEDGE_CARD_TYPE_PRINCIPLE,
  PRINCIPLE_PARAGRAPH_ID,
  RELATION_STATUS_REJECTED,
  RELATION_STATUS_SUGGESTED,
  RELATION_STATUS_VERIFIED,
  RELATION_TYPE_CONTRADICTS,
  RELATION_TYPE_EXAMPLE_OF,
  RELATION_TYPE_RELATED_TO,
  RELATION_TYPE_SUPPORTS,
  confirmRelation,
  listConfirmedRelations,
  listSuggestedRelations,
  loadRelation,
  proposeRelationType,
  rejectRelation,
  suggestRelation,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];
const RELATIONS_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/relations.ts");
const KNOWLEDGE_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/knowledge.ts");

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function countRelations(db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown } }, relationId?: string): number {
  if (relationId) {
    return (
      db.prepare(`SELECT COUNT(*) AS n FROM knowledge_relations WHERE id = ?`).get(relationId) as { n: number }
    ).n;
  }
  return (db.prepare(`SELECT COUNT(*) AS n FROM knowledge_relations`).get() as { n: number }).n;
}

describe("REL-001 knowledge relation suggest, confirm, and reject", () => {
  it("creates a suggestion that does not appear in the confirmed-relations list", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const fromCard = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const toCard = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");

      const suggested = suggestRelation({
        db: workspace.db,
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        relationType: RELATION_TYPE_SUPPORTS,
      });
      assert.equal(suggested.status, RELATION_STATUS_SUGGESTED);
      assert.equal(suggested.relationType, RELATION_TYPE_SUPPORTS);
      assert.equal(suggested.fromCardId, fromCard.id);
      assert.equal(suggested.toCardId, toCard.id);

      const suggestedList = listSuggestedRelations(workspace.db);
      assert.equal(suggestedList.length, 1);
      assert.equal(suggestedList[0]?.id, suggested.id);
      assert.equal(suggestedList[0]?.status, RELATION_STATUS_SUGGESTED);

      const confirmedList = listConfirmedRelations(workspace.db);
      assert.equal(confirmedList.length, 0, "a suggestion must not appear in the confirmed-relations list");
      assert.equal(
        confirmedList.some((relation) => relation.id === suggested.id),
        false,
      );
    } finally {
      workspace.close();
    }
  });

  it("stores a formal relation after user confirm with an allowed relation_type", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const fromCard = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const toCard = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      const suggested = suggestRelation({
        db: workspace.db,
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        relationType: RELATION_TYPE_RELATED_TO,
      });

      const listedBeforeConfirm = listSuggestedRelations(workspace.db);
      assert.equal(listedBeforeConfirm.length, 1);
      assert.equal(listConfirmedRelations(workspace.db).length, 0, "listing must not auto-promote a suggestion");
      assert.equal(loadRelation(workspace.db, suggested.id).status, RELATION_STATUS_SUGGESTED);

      const confirmed = confirmRelation({ db: workspace.db, relationId: suggested.id });
      assert.equal(confirmed.status, RELATION_STATUS_VERIFIED);
      assert.equal(confirmed.relationType, RELATION_TYPE_RELATED_TO);
      assert.ok(ALLOWED_RELATION_TYPES.includes(confirmed.relationType as (typeof ALLOWED_RELATION_TYPES)[number]));

      const row = workspace.db
        .prepare(`SELECT relation_type, status FROM knowledge_relations WHERE id = ?`)
        .get(suggested.id) as { relation_type: string; status: string };
      assert.equal(row.status, "verified_by_user");
      assert.equal(row.relation_type, "related_to");

      assert.equal(listSuggestedRelations(workspace.db).length, 0);
      const confirmedList = listConfirmedRelations(workspace.db);
      assert.equal(confirmedList.length, 1);
      assert.equal(confirmedList[0]?.id, suggested.id);
      assert.equal(confirmedList[0]?.status, RELATION_STATUS_VERIFIED);
    } finally {
      workspace.close();
    }
  });

  it("rejects a suggestion so it does not remain as a formal relation", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const fromCard = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const toCard = workspace.draftKnowledgeCardFromLocator(book.id, HOLLOW_ECHO_PARAGRAPH_ID);
      const suggested = suggestRelation({
        db: workspace.db,
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        relationType: RELATION_TYPE_CONTRADICTS,
      });

      const rejected = rejectRelation({ db: workspace.db, relationId: suggested.id });
      assert.equal(rejected.status, RELATION_STATUS_REJECTED);
      assert.notEqual(rejected.status, RELATION_STATUS_VERIFIED);
      assert.equal(loadRelation(workspace.db, suggested.id).status, RELATION_STATUS_REJECTED);

      assert.equal(listSuggestedRelations(workspace.db).length, 0);
      assert.equal(
        listConfirmedRelations(workspace.db).some((relation) => relation.id === suggested.id),
        false,
        "a rejected suggestion must not appear as a formal relation",
      );
    } finally {
      workspace.close();
    }
  });

  it("rejects an illegal self-loop before writing a row", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const card = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      assert.throws(
        () =>
          suggestRelation({
            db: workspace.db,
            fromCardId: card.id,
            toCardId: card.id,
            relationType: RELATION_TYPE_RELATED_TO,
          }),
        /Cannot suggest a relation from a knowledge card to itself/,
      );
      assert.equal(countRelations(workspace.db), 0);
    } finally {
      workspace.close();
    }
  });

  it("cleans up suggested and confirmed relations when either end card is deleted", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const cardA = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const cardB = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      const cardC = workspace.draftKnowledgeCardFromLocator(book.id, "P2.4");
      const cardD = workspace.draftKnowledgeCardFromLocator(book.id, "P2.5");

      const suggestedFromA = suggestRelation({
        db: workspace.db,
        fromCardId: cardA.id,
        toCardId: cardB.id,
        relationType: RELATION_TYPE_SUPPORTS,
      });
      const confirmedToC = confirmRelation({
        db: workspace.db,
        relationId: suggestRelation({
          db: workspace.db,
          fromCardId: cardB.id,
          toCardId: cardC.id,
          relationType: RELATION_TYPE_EXAMPLE_OF,
        }).id,
      });
      const suggestedToD = suggestRelation({
        db: workspace.db,
        fromCardId: cardC.id,
        toCardId: cardD.id,
        relationType: RELATION_TYPE_RELATED_TO,
      });
      const confirmedFromD = confirmRelation({
        db: workspace.db,
        relationId: suggestRelation({
          db: workspace.db,
          fromCardId: cardD.id,
          toCardId: cardA.id,
          relationType: RELATION_TYPE_CONTRADICTS,
        }).id,
      });
      assert.equal(countRelations(workspace.db), 4);

      workspace.deleteKnowledgeCard(cardA.id);
      assert.equal(countRelations(workspace.db, suggestedFromA.id), 0);
      assert.equal(countRelations(workspace.db, confirmedFromD.id), 0);
      assert.equal(countRelations(workspace.db, confirmedToC.id), 1);
      assert.equal(countRelations(workspace.db, suggestedToD.id), 1);
      assert.throws(() => loadRelation(workspace.db, suggestedFromA.id), /not found/);

      workspace.deleteKnowledgeCard(cardC.id);
      assert.equal(countRelations(workspace.db, confirmedToC.id), 0);
      assert.equal(countRelations(workspace.db, suggestedToD.id), 0);
      assert.equal(countRelations(workspace.db), 0);

      const reloaded = workspace.loadBook(book.id);
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === "P1.5"));
    } finally {
      workspace.close();
    }
  });

  it("rejects unsupported types and missing cards, and only confirmRelation may formalize a relation", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const fromCard = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const toCard = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");

      assert.throws(
        () =>
          suggestRelation({
            db: workspace.db,
            fromCardId: fromCard.id,
            toCardId: toCard.id,
            relationType: "derived_from",
          }),
        /Unsupported relation type/,
      );
      assert.throws(
        () =>
          suggestRelation({
            db: workspace.db,
            fromCardId: fromCard.id,
            toCardId: "00000000-0000-4000-8000-000000000000",
            relationType: RELATION_TYPE_RELATED_TO,
          }),
        /Knowledge card not found/,
      );

      const suggested = suggestRelation({
        db: workspace.db,
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        relationType: RELATION_TYPE_SUPPORTS,
      });
      assert.throws(
        () => rejectRelation({ db: workspace.db, relationId: suggested.id }) && confirmRelation({ db: workspace.db, relationId: suggested.id }),
        /Only a suggested relation can be confirmed/,
      );

      const other = suggestRelation({
        db: workspace.db,
        fromCardId: toCard.id,
        toCardId: fromCard.id,
        relationType: RELATION_TYPE_RELATED_TO,
      });
      confirmRelation({ db: workspace.db, relationId: other.id });
      assert.throws(
        () => rejectRelation({ db: workspace.db, relationId: other.id }),
        /cannot be rejected/,
      );
    } finally {
      workspace.close();
    }
  });

  it("proposes a relation type from card content without writing a row", () => {
    assert.equal(
      proposeRelationType({ type: KNOWLEDGE_CARD_TYPE_CASE, title: "案例" }, { type: KNOWLEDGE_CARD_TYPE_PRINCIPLE, title: "原则" }),
      RELATION_TYPE_EXAMPLE_OF,
    );
    assert.equal(
      proposeRelationType({ type: KNOWLEDGE_CARD_TYPE_PRINCIPLE }, { type: KNOWLEDGE_CARD_TYPE_CASE }),
      RELATION_TYPE_SUPPORTS,
    );
    assert.equal(
      proposeRelationType(
        { type: KNOWLEDGE_CARD_TYPE_PRINCIPLE, content: "A knowledge card needs a source." },
        { type: KNOWLEDGE_CARD_TYPE_PRINCIPLE, title: "空洞回声", content: "Cedar trees sing." },
      ),
      RELATION_TYPE_CONTRADICTS,
    );
    assert.equal(
      proposeRelationType({ type: KNOWLEDGE_CARD_TYPE_PRINCIPLE, title: "A" }, { type: KNOWLEDGE_CARD_TYPE_PRINCIPLE, title: "B" }),
      RELATION_TYPE_RELATED_TO,
    );
  });

  it("only confirmRelation may assign verified_by_user in the relations module, and knowledge.ts merge still does not insert relations", () => {
    const source = fs.readFileSync(RELATIONS_SOURCE, "utf8");
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const confirmStart = withoutComments.indexOf("export function confirmRelation");
    const confirmEnd = withoutComments.indexOf("export function rejectRelation");
    assert.ok(confirmStart >= 0 && confirmEnd > confirmStart);
    const confirmBody = withoutComments.slice(confirmStart, confirmEnd);
    assert.match(confirmBody, /RELATION_STATUS_VERIFIED/);
    const elsewhere = withoutComments.slice(0, confirmStart) + withoutComments.slice(confirmEnd);
    assert.doesNotMatch(
      elsewhere,
      /SET status = \?[\s\S]{0,80}RELATION_STATUS_VERIFIED|RELATION_STATUS_VERIFIED[\s\S]{0,80}UPDATE knowledge_relations/,
      "suggest and reject must not assign verified_by_user",
    );
    const suggestStart = withoutComments.indexOf("export function suggestRelation");
    const suggestEnd = withoutComments.indexOf("export function confirmRelation");
    assert.ok(suggestStart >= 0 && suggestEnd > suggestStart);
    const suggestBody = withoutComments.slice(suggestStart, suggestEnd);
    assert.match(suggestBody, /INSERT INTO knowledge_relations[\s\S]*RELATION_STATUS_SUGGESTED/);
    assert.doesNotMatch(suggestBody, /RELATION_STATUS_VERIFIED/);
    const rejectStart = withoutComments.indexOf("export function rejectRelation");
    const rejectEnd = withoutComments.indexOf("export function listRelations");
    assert.ok(rejectStart >= 0 && rejectEnd > rejectStart);
    assert.doesNotMatch(withoutComments.slice(rejectStart, rejectEnd), /RELATION_STATUS_VERIFIED[\s\S]{0,40}\.run/);

    const knowledge = fs.readFileSync(KNOWLEDGE_SOURCE, "utf8");
    assert.doesNotMatch(
      knowledge,
      /INSERT INTO knowledge_relations/,
      "P-012: merge/delete must not insert knowledge_relations rows",
    );
    assert.match(
      knowledge,
      /DELETE FROM knowledge_relations WHERE from_card_id = \? OR to_card_id = \?/,
    );
  });
});
