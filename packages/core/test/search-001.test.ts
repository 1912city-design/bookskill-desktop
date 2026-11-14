import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  SEARCH_BACKEND_LOCAL,
  SEARCH_CONTENT_TYPE_AI_SUMMARY,
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
  SEARCH_CONTENT_TYPES,
  SEMANTIC_SEARCH_FALLBACK,
  searchLibrary,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];
const SEARCH_SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/search");

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

type IntegritySnapshot = {
  books: unknown[];
  chunks: unknown[];
  cards: unknown[];
  annotations: unknown[];
  counts: { books: number; sourceChunks: number; knowledgeCards: number; annotations: number };
  digest: string;
};

function snapshot(workspace: ReturnType<TempWorkspace["open"]>): IntegritySnapshot {
  const books = workspace.db
    .prepare(`SELECT id, title, content_hash, parse_status, updated_at FROM books ORDER BY id`)
    .all();
  const chunks = workspace.db
    .prepare(`SELECT id, book_id, content_hash, text, ordinal FROM source_chunks ORDER BY id`)
    .all();
  const cards = workspace.db
    .prepare(
      `SELECT id, title, type, content, conditions, limitations, status, created_at, updated_at
       FROM knowledge_cards ORDER BY id`,
    )
    .all();
  const annotations = workspace.db
    .prepare(`SELECT id, source_chunk_id, type, body, created_at, updated_at FROM annotations ORDER BY id`)
    .all();
  const payload = { books, chunks, cards, annotations };
  return {
    books,
    chunks,
    cards,
    annotations,
    counts: {
      books: books.length,
      sourceChunks: chunks.length,
      knowledgeCards: cards.length,
      annotations: annotations.length,
    },
    digest: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}

function insertNote(workspace: ReturnType<TempWorkspace["open"]>, chunkId: string, body: string): string {
  const id = randomUUID();
  const stamp = "2026-11-14T12:00:00.000Z";
  workspace.db
    .prepare(
      `INSERT INTO annotations(id, source_chunk_id, type, body, created_at, updated_at)
       VALUES (?, ?, 'note', ?, ?, ?)`,
    )
    .run(id, chunkId, body, stamp, stamp);
  return id;
}

describe("SEARCH-001 full-text and local semantic search", () => {
  it("returns labeled, jumpable hits for a full-text query on an imported licensed book", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const verified = workspace.confirmKnowledgeCard({
        cardId: workspace.draftKnowledgeCardFromLocator(book.id, "P1.5").id,
        title: "分歧时必须同时引用两段",
        content: "If two passages disagree, the card must cite both passages and must not silently prefer one.",
      });
      const principleChunk = book.chunks.find((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(principleChunk);
      insertNote(workspace, principleChunk.id, "I believe every card needs a paragraph identifier to be valid.");

      const result = searchLibrary({
        db: workspace.db,
        query: "paragraph identifier",
      });
      assert.equal(result.mode, "fulltext");
      assert.equal(result.fallback, "none");
      assert.equal(result.backend, SEARCH_BACKEND_LOCAL);
      assert.ok(result.results.length > 0);

      for (const hit of result.results) {
        assert.ok((SEARCH_CONTENT_TYPES as readonly string[]).includes(hit.contentType));
        assert.equal(typeof hit.source.bookId, "string");
        assert.ok(hit.source.bookId.length > 0);
        assert.equal(hit.source.bookTitle, "BookSkill Test Primer");
        assert.equal(typeof hit.source.locator, "string");
        assert.ok(hit.source.locator.length > 0);
      }

      const original = result.results.find(
        (hit) => hit.contentType === SEARCH_CONTENT_TYPE_ORIGINAL && hit.recordKind === "source_chunk",
      );
      assert.ok(original);
      assert.equal(original.source.bookId, book.id);
      assert.equal(original.source.locator, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(original.source.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.match(original.snippet, /paragraph identifier/i);

      const aiDraft = result.results.find(
        (hit) => hit.contentType === SEARCH_CONTENT_TYPE_AI_SUMMARY && hit.recordId === draft.id,
      );
      assert.ok(aiDraft);
      assert.equal(draft.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(aiDraft.source.locator, PRINCIPLE_PARAGRAPH_ID);
      assert.match(aiDraft.snippet, new RegExp(PRINCIPLE_SENTENCE));

      const userNote = result.results.find(
        (hit) => hit.contentType === SEARCH_CONTENT_TYPE_USER_JUDGMENT && hit.recordKind === "annotation",
      );
      assert.ok(userNote);
      assert.equal(userNote.source.bookId, book.id);
      assert.equal(userNote.source.locator, PRINCIPLE_PARAGRAPH_ID);

      const confirmed = searchLibrary({
        db: workspace.db,
        query: "must cite both passages",
      });
      const userCard = confirmed.results.find(
        (hit) => hit.contentType === SEARCH_CONTENT_TYPE_USER_JUDGMENT && hit.recordId === verified.id,
      );
      assert.ok(userCard);
      assert.equal(verified.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(userCard.source.locator, "P1.5");
    } finally {
      workspace.close();
    }
  });

  it("returns an empty list for a query with no matches, and for a blank query", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      workspace.importBook(EPUB_FIXTURE);
      const missing = searchLibrary({
        db: workspace.db,
        query: "xyzzyplughqqq999",
      });
      assert.deepEqual(missing.results, []);
      assert.equal(missing.backend, SEARCH_BACKEND_LOCAL);
      assert.equal(missing.query, "xyzzyplughqqq999");

      const blank = searchLibrary({ db: workspace.db, query: "   " });
      assert.deepEqual(blank.results, []);
      assert.equal(blank.query, "");

      const semanticMissing = searchLibrary({
        db: workspace.db,
        query: "xyzzyplughqqq999",
        mode: "semantic",
      });
      assert.deepEqual(semanticMissing.results, []);
      assert.equal(semanticMissing.fallback, SEMANTIC_SEARCH_FALLBACK);
    } finally {
      workspace.close();
    }
  });

  it("uses a documented local keyword-expansion fallback for semantic queries", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const result = searchLibrary({
        db: workspace.db,
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
      });
      assert.equal(result.mode, "semantic");
      assert.equal(result.fallback, SEMANTIC_SEARCH_FALLBACK);
      assert.equal(result.backend, SEARCH_BACKEND_LOCAL);
      assert.ok(result.results.length > 0);
      const principle = result.results.find(
        (hit) => hit.source.paragraphId === PRINCIPLE_PARAGRAPH_ID && hit.source.bookId === book.id,
      );
      assert.ok(principle);
      assert.equal(principle.contentType, SEARCH_CONTENT_TYPE_ORIGINAL);
      assert.equal(principle.source.locator, PRINCIPLE_PARAGRAPH_ID);
    } finally {
      workspace.close();
    }
  });

  it("does not modify books, knowledge-card status, or annotation rows", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const chunk = book.chunks.find((entry) => entry.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(chunk);
      insertNote(workspace, chunk.id, "检索前写好的用户判断。");
      const before = snapshot(workspace);

      searchLibrary({ db: workspace.db, query: "paragraph identifier" });
      searchLibrary({
        db: workspace.db,
        query: "citation requirement for claims",
        mode: "semantic",
      });
      searchLibrary({ db: workspace.db, query: "xyzzyplughqqq999" });
      searchLibrary({ db: workspace.db, query: "   " });

      const after = snapshot(workspace);
      assert.deepEqual(after.counts, before.counts);
      assert.equal(after.digest, before.digest);
      assert.deepEqual(after.books, before.books);
      assert.deepEqual(after.chunks, before.chunks);
      assert.deepEqual(after.cards, before.cards);
      assert.deepEqual(after.annotations, before.annotations);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(workspace.loadBook(book.id).contentHash, book.contentHash);
    } finally {
      workspace.close();
    }
  });

  it("keeps the semantic implementation local and free of hosted vector clients", () => {
    const files = fs.readdirSync(SEARCH_SRC_DIR).filter((name) => name.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const name of files) {
      const source = fs.readFileSync(path.join(SEARCH_SRC_DIR, name), "utf8");
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /from ["']node:https["']/);
      assert.doesNotMatch(source, /from ["']node:http["']/);
      assert.doesNotMatch(source, /openai|anthropic|pinecone|weaviate|chromadb|qdrant|milvus|cohere/i);
    }
  });
});
