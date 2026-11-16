import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  SEARCH_BACKEND_LOCAL,
  SEARCH_CONTENT_TYPE_AI_SUMMARY,
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
  SEMANTIC_SEARCH_FALLBACK,
  openSliceWorkspace,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../src/shared/navigation.ts";
import { annotationsFilePath, createAnnotationStore } from "../src/renderer/read/annotations.ts";
import { createExcerptFromSelection } from "../src/renderer/read/locators.ts";
import { flattenGroupedHits, groupSearchHits } from "../src/renderer/search/group.ts";
import { highlightSnippet } from "../src/renderer/search/highlight.ts";
import { applySearchKeyboard } from "../src/renderer/search/keyboard.ts";
import { searchDesktopLibrary } from "../src/renderer/search/run.ts";
import { emptySearchUiState } from "../src/renderer/search/types.ts";
import { renderSearchPanel } from "../src/renderer/search/view.ts";

const leftovers: string[] = [];
const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const EPUB_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.epub");
const SEARCH_SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/renderer/search");
const CHINESE_NOTE = "每张知识卡都必须写上段落定位符，才能回跳到来源。";

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-search-002-"));
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

function insertNote(workspace: ReturnType<typeof openSliceWorkspace>, chunkId: string, body: string): void {
  const stamp = "2026-11-16T14:00:00.000Z";
  workspace.db
    .prepare(
      `INSERT INTO annotations(id, source_chunk_id, type, body, created_at, updated_at)
       VALUES (?, ?, 'note', ?, ?, ?)`,
    )
    .run(randomUUID(), chunkId, body, stamp, stamp);
}

describe("SEARCH-002 desktop presentation, keyboard, and fuzzy match", () => {
  it("keeps the default route on chat and groups, highlights, and keyboard-selects results", () => {
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.label),
      ["问题对话", "书库", "知识库", "Skills", "设置与数据"],
    );

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

      const typo = searchDesktopLibrary({ db: workspace.db, dataDir, query: "identifer" });
      assert.ok(typo.results.length > 0);
      assert.ok(typo.results.some((hit) => hit.source.locator === PRINCIPLE_PARAGRAPH_ID));

      const chineseNotePath = annotationsFilePath(dataDir, book.id);
      assert.ok(fs.existsSync(chineseNotePath));

      const prefix = searchDesktopLibrary({ db: workspace.db, dataDir, query: "identif" });
      assert.ok(prefix.results.some((hit) => hit.source.locator === PRINCIPLE_PARAGRAPH_ID));

      const result = searchDesktopLibrary({ db: workspace.db, dataDir, query: "paragraph identifier" });
      assert.ok(result.results.length > 0);
      assert.equal(result.backend, SEARCH_BACKEND_LOCAL);
      assert.ok(result.results.some((hit) => hit.contentType === SEARCH_CONTENT_TYPE_ORIGINAL));
      assert.ok(result.results.some((hit) => hit.contentType === SEARCH_CONTENT_TYPE_AI_SUMMARY && hit.recordId === draft.id));
      assert.ok(result.results.some((hit) => hit.contentType === SEARCH_CONTENT_TYPE_USER_JUDGMENT));

      const groups = groupSearchHits(result.results);
      assert.deepEqual(
        groups.map((group) => group.contentType),
        ["原文", "AI 归纳", "用户判断"].filter((type) => result.results.some((hit) => hit.contentType === type)),
      );

      const html = renderSearchPanel({
        query: "paragraph identifier",
        mode: "fulltext",
        results: result.results,
        fallback: result.fallback,
        searched: true,
        statusMessage: `共 ${result.results.length} 条结果。`,
        error: null,
        selectedIndex: 0,
        keyboardActive: false,
      });
      assert.match(html, /data-testid="search-results"/);
      assert.match(html, /data-testid="search-group"/);
      assert.match(html, /data-testid="search-group-heading">原文/);
      assert.match(html, /data-testid="search-group-heading">AI 归纳/);
      assert.match(html, /data-testid="search-group-heading">用户判断/);
      assert.match(html, /<mark>/);
      assert.match(html, /data-testid="search-jump"/);
      const originalIndex = html.indexOf('data-testid="search-group-heading">原文');
      const aiIndex = html.indexOf('data-testid="search-group-heading">AI 归纳');
      const userIndex = html.indexOf('data-testid="search-group-heading">用户判断');
      assert.ok(originalIndex >= 0 && aiIndex > originalIndex && userIndex > aiIndex);
      assert.match(html, /data-hit-index="0"[^>]*data-selected="true"/);

      const highlighted = highlightSnippet("A knowledge card cites a paragraph identifier.", ["paragraph identifier"]);
      assert.match(highlighted, /<mark>paragraph identifier<\/mark>/);

      const flat = flattenGroupedHits(result.results);
      assert.ok(flat.length >= 2);
      const down = applySearchKeyboard(
        {
          ...emptySearchUiState(),
          query: "paragraph identifier",
          results: result.results,
          searched: true,
          selectedIndex: 0,
          keyboardActive: false,
        },
        "ArrowDown",
      );
      assert.equal(down.handled, true);
      assert.equal(down.action, "none");
      assert.equal(down.state.selectedIndex, 1);
      assert.equal(down.state.keyboardActive, true);
      assert.equal(down.selectedHit?.id, flat[1]?.id);

      const up = applySearchKeyboard(down.state, "ArrowUp");
      assert.equal(up.state.selectedIndex, 0);

      const enter = applySearchKeyboard(up.state, "Enter");
      assert.equal(enter.handled, true);
      assert.equal(enter.action, "jump");
      assert.equal(enter.selectedHit?.id, flat[0]?.id);
      assert.ok(enter.selectedHit?.source.locator);

      const submitEnter = applySearchKeyboard(
        { ...up.state, keyboardActive: false, selectedIndex: 0 },
        "Enter",
      );
      assert.equal(submitEnter.handled, false);
      assert.equal(submitEnter.action, "none");

      const selectedHtml = renderSearchPanel({
        query: "paragraph identifier",
        mode: "fulltext",
        results: result.results,
        fallback: result.fallback,
        searched: true,
        statusMessage: null,
        error: null,
        selectedIndex: 1,
        keyboardActive: true,
      });
      assert.match(selectedHtml, /data-hit-index="1"[^>]*data-selected="true"/);
      assert.match(selectedHtml, /data-hit-index="0"[^>]*data-selected="false"/);
    } finally {
      workspace.close();
    }
  });

  it("returns Chinese partial matches and an empty list for a miss, and remains read-only", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const excerpt = createExcerptFromSelection({
        book,
        selectedText: PRINCIPLE_SENTENCE,
        note: CHINESE_NOTE,
      });
      createAnnotationStore(dataDir).save(excerpt);
      const principleChunk = book.chunks.find((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(principleChunk);
      insertNote(workspace, principleChunk.id, CHINESE_NOTE);

      const chinese = searchDesktopLibrary({ db: workspace.db, dataDir, query: "段落定位" });
      assert.ok(chinese.results.length > 0);
      assert.ok(chinese.results.some((hit) => hit.contentType === SEARCH_CONTENT_TYPE_USER_JUDGMENT));
      assert.ok(chinese.results.every((hit) => hit.source.bookId && hit.source.locator));
      const chineseHtml = renderSearchPanel({
        query: "段落定位",
        mode: "fulltext",
        results: chinese.results,
        fallback: chinese.fallback,
        searched: true,
        statusMessage: null,
        error: null,
        selectedIndex: 0,
      });
      assert.match(chineseHtml, /<mark>/);
      assert.match(chineseHtml, /段落定位/);

      const missing = searchDesktopLibrary({ db: workspace.db, dataDir, query: "xyzzyplughqqq999" });
      assert.deepEqual(missing.results, []);
      const emptyHtml = renderSearchPanel({
        query: "xyzzyplughqqq999",
        mode: "fulltext",
        results: missing.results,
        fallback: missing.fallback,
        searched: true,
        statusMessage: "没有匹配结果。",
        error: null,
      });
      assert.match(emptyHtml, /data-testid="search-empty">没有匹配结果/);
      assert.doesNotMatch(emptyHtml, /data-testid="search-results"/);

      const annotationPath = annotationsFilePath(dataDir, book.id);
      const beforeDb = databaseFingerprint(workspace);
      const beforeFiles = hashTree(path.join(dataDir, "library"));
      const beforeAnnotation = fs.readFileSync(annotationPath, "utf8");
      const beforeStatus = workspace.loadKnowledgeCard(draft.id).status;
      const beforeHash = book.contentHash;

      searchDesktopLibrary({ db: workspace.db, dataDir, query: "identifer" });
      searchDesktopLibrary({ db: workspace.db, dataDir, query: "段落定位" });
      searchDesktopLibrary({
        db: workspace.db,
        dataDir,
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
      });
      searchDesktopLibrary({ db: workspace.db, dataDir, query: "xyzzyplughqqq999" });

      assert.equal(databaseFingerprint(workspace), beforeDb);
      assert.equal(hashTree(path.join(dataDir, "library")), beforeFiles);
      assert.equal(fs.readFileSync(annotationPath, "utf8"), beforeAnnotation);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, beforeStatus);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(workspace.loadBook(book.id).contentHash, beforeHash);
    } finally {
      workspace.close();
    }
  });

  it("warms the in-process index for typical desktop queries and keeps the semantic fallback local", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const chunk = book.chunks.find((entry) => entry.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(chunk);
      for (let index = 0; index < 200; index += 1) {
        insertNote(workspace, chunk.id, `Synthetic desktop note ${index} zzrow${index} about workshop shelves and lamps.`);
      }

      const firstStart = performance.now();
      const first = searchDesktopLibrary({ db: workspace.db, dataDir, query: "paragraph identifier" });
      const firstMs = performance.now() - firstStart;
      assert.ok(first.results.length > 0);

      const warmedQueries = ["paragraph identifier", "lantern index", "identifer"];
      const warmedTimes: number[] = [];
      for (const query of warmedQueries) {
        const start = performance.now();
        const result = searchDesktopLibrary({ db: workspace.db, dataDir, query });
        const elapsed = performance.now() - start;
        warmedTimes.push(elapsed);
        assert.ok(elapsed <= 50, `warmed desktop query "${query}" took ${elapsed.toFixed(2)}ms`);
        assert.ok(result.results.length > 0);
        for (const hit of result.results) {
          assert.ok(hit.source.bookId);
          assert.ok(hit.source.locator);
          assert.ok(hit.contentType);
        }
      }
      console.log(
        `SEARCH-002 desktop timing first_query_ms=${firstMs.toFixed(2)} warmed_ms=${warmedTimes
          .map((value) => value.toFixed(2))
          .join(",")}`,
      );

      const semantic = searchDesktopLibrary({
        db: workspace.db,
        dataDir,
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
      });
      assert.equal(semantic.fallback, SEMANTIC_SEARCH_FALLBACK);
      assert.equal(semantic.backend, SEARCH_BACKEND_LOCAL);
      const semanticHtml = renderSearchPanel({
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
        results: semantic.results,
        fallback: semantic.fallback,
        searched: true,
        statusMessage: null,
        error: null,
      });
      assert.match(semanticHtml, /data-testid="search-fallback-note"/);
      assert.match(semanticHtml, /本机降级/);
      assert.match(semanticHtml, /不会静默调用外部托管向量服务/);
    } finally {
      workspace.close();
    }
  });

  it("does not ship a hosted vector client or FTS schema in the desktop search module", () => {
    const files = fs.readdirSync(SEARCH_SRC_DIR).filter((name) => name.endsWith(".ts"));
    assert.ok(files.includes("keyboard.ts"));
    assert.ok(files.includes("highlight.ts"));
    assert.ok(files.includes("group.ts"));
    for (const name of files) {
      const source = fs.readFileSync(path.join(SEARCH_SRC_DIR, name), "utf8");
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /from ["']node:https["']/);
      assert.doesNotMatch(source, /openai|anthropic|pinecone|weaviate|chromadb|qdrant|milvus/i);
      assert.doesNotMatch(source, /CREATE VIRTUAL TABLE|fts5/i);
    }
  });
});
