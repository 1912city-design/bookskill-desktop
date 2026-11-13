import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  mergeKnowledgeCards,
  openSliceWorkspace,
  updateKnowledgeCard,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { NAV_ITEMS } from "../src/shared/navigation.ts";
import {
  deleteKnowledgeCardAndKeepBooks,
  listKnowledgeBooks,
  listKnowledgeCardViews,
} from "../src/renderer/knowledge/catalog.ts";
import { knowledgeStatusLabel, type KnowledgeUiState } from "../src/renderer/knowledge/types.ts";
import { renderKnowledgeRoute } from "../src/renderer/knowledge/view.ts";

const leftovers: string[] = [];
const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures",
);
const EPUB_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.epub");

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-know-"));
  leftovers.push(dataDir);
  initializeDataDir({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
  return dataDir;
}

function routeState(overrides: Partial<KnowledgeUiState> = {}): KnowledgeUiState {
  return {
    loaded: true,
    cards: [],
    books: [],
    selectedCardId: null,
    mergeTargetId: "",
    draftBookId: "",
    draftParagraphId: "",
    editTitle: "",
    editContent: "",
    editConditions: "",
    editLimitations: "",
    statusMessage: null,
    locatorProof: [],
    error: null,
    ...overrides,
  };
}

describe("KNOW-001 knowledge base route", () => {
  it("keeps status labels aligned with the draft / verified_by_user contract", () => {
    assert.equal(knowledgeStatusLabel("draft"), "草稿");
    assert.equal(knowledgeStatusLabel("verified_by_user"), "已确认");
    assert.equal(KNOWLEDGE_CARD_STATUS_DRAFT, "draft");
    assert.equal(KNOWLEDGE_CARD_STATUS_VERIFIED, "verified_by_user");
  });

  it("updates only the knowledge nav description and does not add a new top-level entry", () => {
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.label),
      ["问题对话", "书库", "知识库", "Skills", "设置与数据"],
    );
    const knowledge = NAV_ITEMS.find((item) => item.id === "knowledge");
    assert.ok(knowledge);
    assert.match(knowledge.description, /确认、编辑、合并或删除/);
    assert.doesNotMatch(knowledge.description, /完整知识库仍待后续任务/);
    const library = NAV_ITEMS.find((item) => item.id === "library");
    assert.ok(library);
    assert.match(library.description, /已导入的书籍可在此打开阅读器/);
  });

  it("renders draft and confirmed cards with sources, and has no auto-confirm or auto-publish controls", () => {
    const html = renderKnowledgeRoute(
      routeState({
        books: [{ id: "book-1", title: "BookSkill Test Primer", parseStatus: "parsed" }],
        cards: [
          {
            id: "card-draft",
            title: "草稿原则卡",
            type: "原则",
            content: PRINCIPLE_SENTENCE,
            conditions: null,
            limitations: null,
            status: KNOWLEDGE_CARD_STATUS_DRAFT,
            createdAt: "2026-11-14T00:00:00.000Z",
            updatedAt: "2026-11-14T00:00:00.000Z",
            sources: [
              {
                id: "source-1",
                knowledgeCardId: "card-draft",
                sourceChunkId: "chunk-1",
                relationType: "derived_from",
                paragraphId: PRINCIPLE_PARAGRAPH_ID,
                bookId: "book-1",
                bookTitle: "BookSkill Test Primer",
              },
            ],
          },
          {
            id: "card-verified",
            title: "已确认原则卡",
            type: "原则",
            content: PRINCIPLE_SENTENCE,
            conditions: null,
            limitations: null,
            status: KNOWLEDGE_CARD_STATUS_VERIFIED,
            createdAt: "2026-11-14T00:00:00.000Z",
            updatedAt: "2026-11-14T00:00:00.000Z",
            sources: [
              {
                id: "source-2",
                knowledgeCardId: "card-verified",
                sourceChunkId: "chunk-2",
                relationType: "derived_from",
                paragraphId: "P1.5",
                bookId: "book-1",
                bookTitle: "BookSkill Test Primer",
              },
            ],
          },
        ],
        selectedCardId: "card-draft",
        editTitle: "草稿原则卡",
        editContent: PRINCIPLE_SENTENCE,
      }),
    );
    assert.match(html, /data-testid="knowledge-surface"/);
    assert.match(html, /data-testid="card-status-code">draft/);
    assert.match(html, /data-testid="card-status-code">verified_by_user/);
    assert.match(html, />草稿</);
    assert.match(html, />已确认</);
    assert.match(html, /BookSkill Test Primer · P1\.3/);
    assert.match(html, /data-testid="confirm-card"/);
    assert.match(html, /data-testid="save-card"/);
    assert.match(html, /data-testid="merge-submit"/);
    assert.match(html, /data-testid="delete-card"/);
    assert.match(html, /data-testid="draft-submit"/);
    assert.doesNotMatch(html, /data-testid="auto-confirm"/);
    assert.doesNotMatch(html, /data-testid="auto-publish"/);
    assert.doesNotMatch(html, /data-testid="publish-skill"/);
  });

  it("lists imported books and cards drafted from a licensed EPUB as draft", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(draft.status, KNOWLEDGE_CARD_STATUS_DRAFT);

      const books = listKnowledgeBooks(workspace.db);
      assert.equal(books.length, 1);
      assert.equal(books[0]?.id, book.id);
      assert.doesNotMatch(dataDir, /anythingllm|mintplex/i);

      const cards = listKnowledgeCardViews(workspace.db);
      assert.equal(cards.length, 1);
      assert.equal(cards[0]?.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(cards[0]?.sources[0]?.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(cards[0]?.sources[0]?.bookTitle, "BookSkill Test Primer");

      const html = renderKnowledgeRoute(
        routeState({
          books,
          cards,
          selectedCardId: cards[0]?.id ?? null,
          editTitle: cards[0]?.title ?? "",
          editContent: cards[0]?.content ?? "",
        }),
      );
      assert.match(html, /data-status="draft"/);
      assert.match(html, /P1\.3/);
    } finally {
      workspace.close();
    }
  });

  it("saves edits without confirming, then confirms without dropping sources", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const before = draft.sources.map((source) => ({
        sourceChunkId: source.sourceChunkId,
        paragraphId: source.paragraphId,
        relationType: source.relationType,
      }));

      const edited = updateKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
        title: "编辑后的草稿",
        content: "仍待用户确认。",
      });
      assert.equal(edited.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(edited.title, "编辑后的草稿");

      const confirmed = workspace.confirmKnowledgeCard({
        cardId: draft.id,
        title: "确认后的原则卡",
        content: PRINCIPLE_SENTENCE,
      });
      assert.equal(confirmed.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.deepEqual(
        confirmed.sources.map((source) => ({
          sourceChunkId: source.sourceChunkId,
          paragraphId: source.paragraphId,
          relationType: source.relationType,
        })),
        before,
      );
    } finally {
      workspace.close();
    }
  });

  it("merges and deletes cards while proving book locators remain", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const surviving = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const absorbed = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      const merged = mergeKnowledgeCards({
        db: workspace.db,
        survivingCardId: surviving.id,
        absorbedCardId: absorbed.id,
      });
      assert.equal(merged.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(merged.sources.length, 2);

      const extra = workspace.draftKnowledgeCardFromLocator(book.id, "P2.4");
      const deleted = deleteKnowledgeCardAndKeepBooks(workspace.db, extra.id);
      assert.equal(deleted.deletedCardId, extra.id);
      assert.ok(deleted.locatorProof.length >= 1);
      assert.equal(deleted.locatorProof[0]?.bookPresent, true);
      assert.equal(deleted.locatorProof[0]?.locatorUsable, true);
      assert.equal(deleted.locatorProof[0]?.bookTitle, "BookSkill Test Primer");
      assert.equal(deleted.locatorProof[0]?.paragraphId, "P2.4");

      const reloaded = workspace.loadBook(book.id);
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === "P1.5"));
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === "P2.4"));

      const html = renderKnowledgeRoute(
        routeState({
          cards: listKnowledgeCardViews(workspace.db),
          locatorProof: deleted.locatorProof,
          statusMessage: "知识卡已删除。原书仍在，书中定位仍可用。",
        }),
      );
      assert.match(html, /data-testid="locator-proof"/);
      assert.match(html, /BookSkill Test Primer · P2\.4 仍可用/);
      assert.doesNotMatch(html, /data-card-id="${extra.id}"/);
    } finally {
      workspace.close();
    }
  });
});
