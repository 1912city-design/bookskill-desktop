import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

describe("knowledge cards", () => {
  it("drafts a card from [P1.3], keeps sources on confirm, and does not delete the book", () => {
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
      const sourceChunkId = draft.sources[0]?.sourceChunkId;
      assert.ok(sourceChunkId);

      const confirmed = workspace.confirmKnowledgeCard({
        cardId: draft.id,
        title: "确认后的原则卡",
        content: PRINCIPLE_SENTENCE,
      });
      assert.equal(confirmed.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(confirmed.title, "确认后的原则卡");
      assert.deepEqual(
        confirmed.sources.map((source) => ({
          sourceChunkId: source.sourceChunkId,
          paragraphId: source.paragraphId,
          relationType: source.relationType,
        })),
        draft.sources.map((source) => ({
          sourceChunkId: source.sourceChunkId,
          paragraphId: source.paragraphId,
          relationType: source.relationType,
        })),
      );

      const extra = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      workspace.deleteKnowledgeCard(extra.id);
      assert.throws(() => workspace.loadKnowledgeCard(extra.id), /not found/);

      const reloaded = workspace.loadBook(book.id);
      assert.equal(reloaded.title, "BookSkill Test Primer");
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === "P1.5"));
      const stillConfirmed = workspace.loadKnowledgeCard(confirmed.id);
      assert.equal(stillConfirmed.sources[0]?.sourceChunkId, sourceChunkId);
    } finally {
      workspace.close();
    }
  });
});
