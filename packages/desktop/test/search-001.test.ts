import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  SEARCH_BACKEND_LOCAL,
  SEARCH_CONTENT_TYPE_AI_SUMMARY,
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
  SEARCH_CONTENT_TYPES,
  SEMANTIC_SEARCH_FALLBACK,
  openSliceWorkspace,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../src/shared/navigation.ts";
import { annotationsFilePath, createAnnotationStore } from "../src/renderer/read/annotations.ts";
import { createExcerptFromSelection } from "../src/renderer/read/locators.ts";
import { searchDesktopLibrary } from "../src/renderer/search/run.ts";
import { emptySearchUiState } from "../src/renderer/search/types.ts";
import { renderSearchPanel } from "../src/renderer/search/view.ts";

const leftovers: string[] = [];
const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const EPUB_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.epub");
const SEARCH_SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/renderer/search");

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-search-"));
  leftovers.push(dataDir);
  initializeDataDir({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
  return dataDir;
}

function hashTree(start: string): string {
  const hash = createHash("sha256");
  if (!fs.existsSync(start)) {
    return hash.update("missing").digest("hex");
  }
  const walk = (current: string): void => {
    const stat = fs.statSync(current);
    if (stat.isDirectory()) {
      for (const name of fs.readdirSync(current).sort()) {
        walk(path.join(current, name));
      }
      return;
    }
    hash.update(current);
    hash.update(fs.readFileSync(current));
  };
  walk(start);
  return hash.digest("hex");
}

function databaseFingerprint(workspace: ReturnType<typeof openSliceWorkspace>): string {
  const books = workspace.db
    .prepare(`SELECT id, title, content_hash, parse_status, updated_at FROM books ORDER BY id`)
    .all();
  const chunks = workspace.db
    .prepare(`SELECT id, book_id, content_hash, text, ordinal FROM source_chunks ORDER BY id`)
    .all();
  const cards = workspace.db
    .prepare(
      `SELECT id, title, content, conditions, limitations, status, created_at, updated_at FROM knowledge_cards ORDER BY id`,
    )
    .all();
  const annotations = workspace.db
    .prepare(`SELECT id, source_chunk_id, type, body, updated_at FROM annotations ORDER BY id`)
    .all();
  return createHash("sha256").update(JSON.stringify({ books, chunks, cards, annotations })).digest("hex");
}

describe("SEARCH-001 desktop search", () => {
  it("keeps the default route on chat and does not add a top-level nav entry", () => {
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.label),
      ["问题对话", "书库", "知识库", "Skills", "设置与数据"],
    );
    const html = renderSearchPanel(emptySearchUiState());
    assert.match(html, /data-testid="search-surface"/);
    assert.match(html, /data-testid="search-form"/);
    assert.doesNotMatch(html, /data-nav-id="search"/);
  });

  it("returns labeled, jumpable hits for a licensed book, including file excerpts and notes", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(draft.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      const excerpt = createExcerptFromSelection({
        book,
        selectedText: PRINCIPLE_SENTENCE,
        note: "I confirm this passage must cite a paragraph identifier.",
      });
      createAnnotationStore(dataDir).save(excerpt);

      const result = searchDesktopLibrary({
        db: workspace.db,
        dataDir,
        query: "paragraph identifier",
      });
      assert.ok(result.results.length > 0);
      assert.equal(result.backend, SEARCH_BACKEND_LOCAL);
      for (const hit of result.results) {
        assert.ok((SEARCH_CONTENT_TYPES as readonly string[]).includes(hit.contentType));
        assert.ok(hit.source.bookId);
        assert.equal(hit.source.bookTitle, "BookSkill Test Primer");
        assert.ok(hit.source.locator);
      }
      assert.ok(
        result.results.some(
          (hit) => hit.contentType === SEARCH_CONTENT_TYPE_ORIGINAL && hit.source.locator === PRINCIPLE_PARAGRAPH_ID,
        ),
      );
      assert.ok(
        result.results.some(
          (hit) => hit.contentType === SEARCH_CONTENT_TYPE_AI_SUMMARY && hit.recordId === draft.id,
        ),
      );
      const noteHit = result.results.find(
        (hit) => hit.contentType === SEARCH_CONTENT_TYPE_USER_JUDGMENT && hit.recordKind === "annotation",
      );
      assert.ok(noteHit);
      assert.equal(noteHit.source.locator, PRINCIPLE_PARAGRAPH_ID);
      assert.match(noteHit.snippet, /paragraph identifier/);

      const html = renderSearchPanel({
        query: "paragraph identifier",
        mode: "fulltext",
        results: result.results,
        fallback: result.fallback,
        searched: true,
        statusMessage: `共 ${result.results.length} 条结果。`,
        error: null,
      });
      assert.match(html, /data-testid="search-results"/);
      assert.match(html, /data-testid="search-content-type">原文/);
      assert.match(html, /data-testid="search-content-type">AI 归纳/);
      assert.match(html, /data-testid="search-content-type">用户判断/);
      assert.match(html, new RegExp(`data-testid="search-locator">BookSkill Test Primer · ${PRINCIPLE_PARAGRAPH_ID}`));
      assert.match(html, /data-testid="search-jump"/);
    } finally {
      workspace.close();
    }
  });

  it("returns an empty list when nothing matches, and renders an empty state", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      workspace.importBook(EPUB_FIXTURE);
      const result = searchDesktopLibrary({
        db: workspace.db,
        dataDir,
        query: "xyzzyplughqqq999",
      });
      assert.deepEqual(result.results, []);
      const html = renderSearchPanel({
        query: "xyzzyplughqqq999",
        mode: "fulltext",
        results: result.results,
        fallback: result.fallback,
        searched: true,
        statusMessage: "没有匹配结果。",
        error: null,
      });
      assert.match(html, /data-testid="search-empty">没有匹配结果/);
      assert.doesNotMatch(html, /data-testid="search-results"/);
    } finally {
      workspace.close();
    }
  });

  it("documents the local semantic fallback and does not invent a hosted vector backend", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      workspace.importBook(EPUB_FIXTURE);
      const result = searchDesktopLibrary({
        db: workspace.db,
        dataDir,
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
      });
      assert.equal(result.fallback, SEMANTIC_SEARCH_FALLBACK);
      assert.equal(result.backend, SEARCH_BACKEND_LOCAL);
      assert.ok(result.results.some((hit) => hit.source.locator === PRINCIPLE_PARAGRAPH_ID));
      const html = renderSearchPanel({
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
        results: result.results,
        fallback: result.fallback,
        searched: true,
        statusMessage: null,
        error: null,
      });
      assert.match(html, /data-testid="search-fallback-note"/);
      assert.match(html, /本机降级/);
      assert.match(html, /不会静默调用外部托管向量服务/);
    } finally {
      workspace.close();
    }
  });

  it("does not modify books, knowledge-card status, or annotation files", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const confirmed = workspace.confirmKnowledgeCard({
        cardId: workspace.draftKnowledgeCardFromLocator(book.id, "P2.4").id,
      });
      const excerpt = createExcerptFromSelection({
        book,
        selectedText: PRINCIPLE_SENTENCE,
        note: "检索不得改写这条批注。",
      });
      createAnnotationStore(dataDir).save(excerpt);
      const annotationPath = annotationsFilePath(dataDir, book.id);
      const beforeDb = databaseFingerprint(workspace);
      const beforeFiles = hashTree(path.join(dataDir, "library"));
      const beforeAnnotation = fs.readFileSync(annotationPath, "utf8");
      const beforeStatus = workspace.loadKnowledgeCard(draft.id).status;
      const beforeVerified = workspace.loadKnowledgeCard(confirmed.id).status;
      const beforeHash = book.contentHash;

      searchDesktopLibrary({ db: workspace.db, dataDir, query: "paragraph identifier" });
      searchDesktopLibrary({
        db: workspace.db,
        dataDir,
        query: "citation requirement for claims",
        mode: "semantic",
      });
      searchDesktopLibrary({ db: workspace.db, dataDir, query: "xyzzyplughqqq999" });

      assert.equal(databaseFingerprint(workspace), beforeDb);
      assert.equal(hashTree(path.join(dataDir, "library")), beforeFiles);
      assert.equal(fs.readFileSync(annotationPath, "utf8"), beforeAnnotation);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, beforeStatus);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(workspace.loadKnowledgeCard(confirmed.id).status, beforeVerified);
      assert.equal(workspace.loadKnowledgeCard(confirmed.id).status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(workspace.loadBook(book.id).contentHash, beforeHash);
    } finally {
      workspace.close();
    }
  });

  it("does not ship a hosted vector client in the desktop search module", () => {
    const files = fs.readdirSync(SEARCH_SRC_DIR).filter((name) => name.endsWith(".ts"));
    assert.ok(files.length > 0);
    for (const name of files) {
      const source = fs.readFileSync(path.join(SEARCH_SRC_DIR, name), "utf8");
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /from ["']node:https["']/);
      assert.doesNotMatch(source, /openai|anthropic|pinecone|weaviate|chromadb|qdrant|milvus/i);
    }
  });
});
