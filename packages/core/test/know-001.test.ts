import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  SKILL_STATUS_PUBLISHED,
  createRetrospectiveSkill,
  listKnowledgeCards,
  mergeKnowledgeCards,
  updateKnowledgeCard,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];
const KNOWLEDGE_SOURCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/knowledge.ts",
);

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function sourceFingerprint(card: { sources: Array<{ sourceChunkId: string; paragraphId: string | null; relationType: string }> }) {
  return card.sources.map((source) => ({
    sourceChunkId: source.sourceChunkId,
    paragraphId: source.paragraphId,
    relationType: source.relationType,
  }));
}

describe("KNOW-001 knowledge card draft, confirm, edit, merge, and delete", () => {
  it("starts a card generated from a source as draft", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(draft.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.match(draft.content, new RegExp(PRINCIPLE_SENTENCE));
      assert.equal(draft.sources.length, 1);
      assert.equal(draft.sources[0]?.paragraphId, PRINCIPLE_PARAGRAPH_ID);
    } finally {
      workspace.close();
    }
  });

  it("confirms a card as verified_by_user without changing source relationships", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const before = sourceFingerprint(draft);
      const confirmed = workspace.confirmKnowledgeCard({
        cardId: draft.id,
        title: "确认后的原则卡",
        content: PRINCIPLE_SENTENCE,
        conditions: "在引用书中结论时适用。",
        limitations: "不得把无来源句子当作书中结论。",
      });
      assert.equal(confirmed.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(confirmed.title, "确认后的原则卡");
      assert.deepEqual(sourceFingerprint(confirmed), before);
      assert.equal(confirmed.sources[0]?.sourceChunkId, draft.sources[0]?.sourceChunkId);
      assert.equal(confirmed.sources[0]?.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(confirmed.sources[0]?.relationType, draft.sources[0]?.relationType);
    } finally {
      workspace.close();
    }
  });

  it("edits a draft without confirming it, leaving status as draft", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const edited = updateKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
        title: "尚未确认的编辑",
        content: "编辑后的正文仍是草稿。",
        conditions: "仅在用户确认前作为草稿使用。",
        limitations: "不得把草稿当作已确认知识卡。",
      });
      assert.equal(edited.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(edited.title, "尚未确认的编辑");
      assert.equal(edited.content, "编辑后的正文仍是草稿。");
      assert.deepEqual(sourceFingerprint(edited), sourceFingerprint(draft));
      const reloaded = workspace.loadKnowledgeCard(draft.id);
      assert.equal(reloaded.status, KNOWLEDGE_CARD_STATUS_DRAFT);
    } finally {
      workspace.close();
    }
  });

  it("merges sources onto the surviving card without auto-verifying or deleting the book", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const survivingDraft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const absorbed = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      const sourceCountBefore = workspace.snapshot().sourceChunks;
      const bookChunkCount = book.chunks.length;

      const merged = mergeKnowledgeCards({
        db: workspace.db,
        survivingCardId: survivingDraft.id,
        absorbedCardId: absorbed.id,
      });
      assert.equal(merged.id, survivingDraft.id);
      assert.equal(merged.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(merged.sources.length, 2);
      const paragraphs = new Set(merged.sources.map((source) => source.paragraphId));
      assert.deepEqual(paragraphs, new Set([PRINCIPLE_PARAGRAPH_ID, "P1.5"]));
      assert.throws(() => workspace.loadKnowledgeCard(absorbed.id), /not found/);

      const relationCount = (
        workspace.db.prepare(`SELECT COUNT(*) AS n FROM knowledge_relations`).get() as { n: number }
      ).n;
      assert.equal(relationCount, 0, "merge must not record a relation that would dangle after deleting the absorbed card");

      const reloadedBook = workspace.loadBook(book.id);
      assert.equal(reloadedBook.title, "BookSkill Test Primer");
      assert.equal(reloadedBook.chunks.length, bookChunkCount);
      assert.ok(reloadedBook.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
      assert.ok(reloadedBook.chunks.some((chunk) => chunk.location.paragraphId === "P1.5"));
      assert.equal(workspace.snapshot().sourceChunks, sourceCountBefore);
    } finally {
      workspace.close();
    }
  });

  it("deduplicates sources by source_chunk_id when merging two cards from the same locator", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const first = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const second = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(first.sources[0]?.sourceChunkId, second.sources[0]?.sourceChunkId);

      const merged = mergeKnowledgeCards({
        db: workspace.db,
        survivingCardId: first.id,
        absorbedCardId: second.id,
      });
      assert.equal(merged.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(merged.sources.length, 1);
      assert.equal(merged.sources[0]?.sourceChunkId, first.sources[0]?.sourceChunkId);
      assert.equal(merged.sources[0]?.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.throws(() => workspace.loadKnowledgeCard(second.id), /not found/);
      const stillThere = workspace.loadBook(book.id);
      assert.ok(stillThere.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
    } finally {
      workspace.close();
    }
  });

  it("does not mark a verified surviving card as changed, and does not auto-verify a draft", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const verified = workspace.confirmKnowledgeCard({
        cardId: workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID).id,
      });
      const otherDraft = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      const mergedVerified = mergeKnowledgeCards({
        db: workspace.db,
        survivingCardId: verified.id,
        absorbedCardId: otherDraft.id,
      });
      assert.equal(mergedVerified.status, KNOWLEDGE_CARD_STATUS_VERIFIED);

      const draftSurvivor = workspace.draftKnowledgeCardFromLocator(book.id, "P2.4");
      const absorbedVerified = workspace.confirmKnowledgeCard({
        cardId: workspace.draftKnowledgeCardFromLocator(book.id, "P2.5").id,
      });
      const mergedDraft = mergeKnowledgeCards({
        db: workspace.db,
        survivingCardId: draftSurvivor.id,
        absorbedCardId: absorbedVerified.id,
      });
      assert.equal(mergedDraft.status, KNOWLEDGE_CARD_STATUS_DRAFT);
    } finally {
      workspace.close();
    }
  });

  it("deletes a card while leaving the original book and locators usable", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const card = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const sourceChunkId = card.sources[0]?.sourceChunkId;
      assert.ok(sourceChunkId);
      workspace.deleteKnowledgeCard(card.id);
      assert.throws(() => workspace.loadKnowledgeCard(card.id), /not found/);
      const reloaded = workspace.loadBook(book.id);
      assert.equal(reloaded.title, "BookSkill Test Primer");
      assert.ok(reloaded.chunks.some((chunk) => chunk.id === sourceChunkId));
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
      assert.ok(workspace.findChunkByParagraphId(reloaded, PRINCIPLE_PARAGRAPH_ID));
    } finally {
      workspace.close();
    }
  });

  it("lists cards and does not auto-publish a Skill from the knowledge flow", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const listed = listKnowledgeCards(workspace.db);
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.id, draft.id);
      assert.equal(listed[0]?.status, KNOWLEDGE_CARD_STATUS_DRAFT);

      const created = createRetrospectiveSkill(workspace.db, draft.id);
      assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, KNOWLEDGE_CARD_STATUS_DRAFT);
    } finally {
      workspace.close();
    }
  });

  it("only confirmKnowledgeCard may assign verified_by_user in the knowledge module", () => {
    const source = fs.readFileSync(KNOWLEDGE_SOURCE, "utf8");
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const assignments = [...withoutComments.matchAll(/KNOWLEDGE_CARD_STATUS_VERIFIED/g)];
    assert.ok(assignments.length >= 1);
    const confirmStart = withoutComments.indexOf("export function confirmKnowledgeCard");
    const confirmEnd = withoutComments.indexOf("export function deleteKnowledgeCard");
    assert.ok(confirmStart >= 0 && confirmEnd > confirmStart);
    const confirmBody = withoutComments.slice(confirmStart, confirmEnd);
    assert.match(confirmBody, /KNOWLEDGE_CARD_STATUS_VERIFIED/);
    const elsewhere = (withoutComments.slice(0, confirmStart) + withoutComments.slice(confirmEnd)).replace(
      /import\s*\{[\s\S]*?\}\s*from\s*"[^"]+";/g,
      "",
    );
    assert.doesNotMatch(
      elsewhere,
      /KNOWLEDGE_CARD_STATUS_VERIFIED/,
      "draft, edit, merge, and delete must not set verified_by_user",
    );
  });
});
