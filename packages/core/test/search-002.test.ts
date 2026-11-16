import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  PRINCIPLE_PARAGRAPH_ID,
  SEARCH_BACKEND_LOCAL,
  SEARCH_CONTENT_TYPE_AI_SUMMARY,
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
  SEARCH_CONTENT_TYPES,
  SEMANTIC_SEARCH_FALLBACK,
  collectSearchableRecords,
  searchLibrary,
  searchRecords,
  type SearchableRecord,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];
const SEARCH_SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/search");
const CHINESE_NOTE = "每张知识卡都必须写上段落定位符，才能回跳到来源。";

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

type IntegritySnapshot = {
  digest: string;
  counts: { books: number; sourceChunks: number; knowledgeCards: number; annotations: number };
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
  return {
    counts: {
      books: books.length,
      sourceChunks: chunks.length,
      knowledgeCards: cards.length,
      annotations: annotations.length,
    },
    digest: createHash("sha256").update(JSON.stringify({ books, chunks, cards, annotations })).digest("hex"),
  };
}

function insertNote(workspace: ReturnType<TempWorkspace["open"]>, chunkId: string, body: string): string {
  const id = randomUUID();
  const stamp = "2026-11-16T14:00:00.000Z";
  workspace.db
    .prepare(
      `INSERT INTO annotations(id, source_chunk_id, type, body, created_at, updated_at)
       VALUES (?, ?, 'note', ?, ?, ?)`,
    )
    .run(id, chunkId, body, stamp, stamp);
  return id;
}

function assertJumpable(hit: {
  contentType: string;
  source: { bookId: string; bookTitle: string; locator: string };
}): void {
  assert.ok((SEARCH_CONTENT_TYPES as readonly string[]).includes(hit.contentType));
  assert.ok(hit.source.bookId.length > 0);
  assert.ok(hit.source.bookTitle.length > 0);
  assert.ok(hit.source.locator.length > 0);
}

function syntheticRecord(index: number, text: string, contentType: SearchableRecord["contentType"] = SEARCH_CONTENT_TYPE_ORIGINAL): SearchableRecord {
  return {
    id: `source_chunk:synth-${index}`,
    kind: "source_chunk",
    contentType,
    title: `Synthetic ${index}`,
    text,
    source: {
      bookId: "synth-book",
      bookTitle: "Synthetic Volume",
      locator: `S${index}`,
      paragraphId: `S${index}`,
      chapter: "Synth",
      page: index,
      confirmed: true,
      chunkId: `synth-${index}`,
    },
  };
}

function buildCorpus(imported: SearchableRecord[]): SearchableRecord[] {
  const records = [...imported];
  records.push(
    syntheticRecord(
      -1,
      "备用样本：每张知识卡都必须写上段落定位符，才能回跳到来源。",
      SEARCH_CONTENT_TYPE_USER_JUDGMENT,
    ),
  );
  const needed = Math.max(0, 200 - records.length);
  for (let index = 0; index < needed; index += 1) {
    const type =
      index % 11 === 0
        ? SEARCH_CONTENT_TYPE_AI_SUMMARY
        : index % 13 === 0
          ? SEARCH_CONTENT_TYPE_USER_JUDGMENT
          : SEARCH_CONTENT_TYPE_ORIGINAL;
    records.push(
      syntheticRecord(
        index,
        `Synthetic row ${index} unique token zzrow${index} filler text about workshop shelves and lamps, without the primer keywords.`,
        type,
      ),
    );
  }
  return records;
}

describe("SEARCH-002 fuzzy match, index warmup, and ranking", () => {
  it("returns jumpable hits for a 1-edit English typo on the imported FIXT-001 book", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const result = searchLibrary({ db: workspace.db, query: "identifer" });
      assert.ok(result.results.length > 0);
      assert.equal(result.backend, SEARCH_BACKEND_LOCAL);
      for (const hit of result.results) {
        assertJumpable(hit);
      }
      const principle = result.results.find(
        (hit) => hit.source.paragraphId === PRINCIPLE_PARAGRAPH_ID && hit.source.bookId === book.id,
      );
      assert.ok(principle);
      assert.equal(principle.contentType, SEARCH_CONTENT_TYPE_ORIGINAL);
      assert.equal(principle.source.locator, PRINCIPLE_PARAGRAPH_ID);
      assert.ok(principle.matchedFragments.some((part) => /identifier/i.test(part)));
      assert.match(principle.snippet, /identifier/i);
    } finally {
      workspace.close();
    }
  });

  it("hits English prefixes and Chinese partial substrings, and still ranks a full-phrase match first", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const principleChunk = book.chunks.find((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(principleChunk);
      insertNote(workspace, principleChunk.id, CHINESE_NOTE);

      const prefix = searchLibrary({ db: workspace.db, query: "identif" });
      assert.ok(prefix.results.length > 0);
      assert.ok(
        prefix.results.some(
          (hit) => hit.source.paragraphId === PRINCIPLE_PARAGRAPH_ID && hit.source.bookId === book.id,
        ),
      );
      for (const hit of prefix.results) {
        assertJumpable(hit);
      }

      const chinese = searchLibrary({ db: workspace.db, query: "段落定位" });
      assert.ok(chinese.results.length > 0);
      const noteHit = chinese.results.find(
        (hit) => hit.contentType === SEARCH_CONTENT_TYPE_USER_JUDGMENT && hit.recordKind === "annotation",
      );
      assert.ok(noteHit);
      assert.equal(noteHit.source.locator, PRINCIPLE_PARAGRAPH_ID);
      assert.match(noteHit.snippet, /段落定位符/);

      const ranked = searchLibrary({ db: workspace.db, query: "paragraph identifier" });
      assert.ok(ranked.results.length > 0);
      const firstOriginal = ranked.results.find((hit) => hit.recordKind === "source_chunk");
      assert.ok(firstOriginal);
      assert.equal(firstOriginal.source.paragraphId, PRINCIPLE_PARAGRAPH_ID);
    } finally {
      workspace.close();
    }
  });

  it("returns hits when only some query terms match, and an empty list when nothing matches", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const partial = searchLibrary({ db: workspace.db, query: "lantern identifier" });
      assert.ok(partial.results.length > 0);
      const lantern = partial.results.find(
        (hit) => hit.recordKind === "source_chunk" && /lantern/i.test(`${hit.title} ${hit.snippet}`),
      );
      const identifier = partial.results.find(
        (hit) => hit.source.paragraphId === PRINCIPLE_PARAGRAPH_ID && hit.source.bookId === book.id,
      );
      assert.ok(lantern);
      assert.ok(identifier);
      assert.notEqual(lantern.source.paragraphId, identifier.source.paragraphId);
      for (const hit of partial.results) {
        assertJumpable(hit);
      }

      const missing = searchLibrary({ db: workspace.db, query: "xyzzyplughqqq999" });
      assert.deepEqual(missing.results, []);
      assert.equal(missing.backend, SEARCH_BACKEND_LOCAL);

      const blank = searchLibrary({ db: workspace.db, query: "   " });
      assert.deepEqual(blank.results, []);
      assert.equal(blank.query, "");
    } finally {
      workspace.close();
    }
  });

  it("serves warmed typical queries in 50ms over at least 200 records without dropping locators", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      workspace.importBook(EPUB_FIXTURE);
      const imported = collectSearchableRecords(workspace.db);
      const records = buildCorpus(imported);
      assert.ok(records.length >= 200);

      const firstStart = performance.now();
      const first = searchRecords(records, { query: "paragraph identifier" });
      const firstMs = performance.now() - firstStart;
      assert.ok(first.results.length > 0);

      const warmedQueries = ["paragraph identifier", "lantern index", "identifer", "段落定位符"];
      const warmedTimes: number[] = [];
      for (const query of warmedQueries) {
        const start = performance.now();
        const result = searchRecords(records, { query });
        const elapsed = performance.now() - start;
        warmedTimes.push(elapsed);
        assert.ok(elapsed <= 50, `warmed query "${query}" took ${elapsed.toFixed(2)}ms`);
        if (query !== "段落定位符") {
          assert.ok(result.results.length > 0, `expected hits for ${query}`);
        }
        for (const hit of result.results) {
          assertJumpable(hit);
        }
      }

      console.log(
        `SEARCH-002 timing records=${records.length} first_query_ms=${firstMs.toFixed(2)} warmed_ms=${warmedTimes
          .map((value) => value.toFixed(2))
          .join(",")}`,
      );
    } finally {
      workspace.close();
    }
  });

  it("keeps the local semantic fallback declaration and does not write business data", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const chunk = book.chunks.find((entry) => entry.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(chunk);
      insertNote(workspace, chunk.id, CHINESE_NOTE);
      const before = snapshot(workspace);

      const semantic = searchLibrary({
        db: workspace.db,
        query: "citation requirement for claims on a knowledge card",
        mode: "semantic",
      });
      assert.equal(semantic.mode, "semantic");
      assert.equal(semantic.fallback, SEMANTIC_SEARCH_FALLBACK);
      assert.equal(semantic.backend, SEARCH_BACKEND_LOCAL);
      assert.ok(semantic.results.some((hit) => hit.source.paragraphId === PRINCIPLE_PARAGRAPH_ID));

      searchLibrary({ db: workspace.db, query: "identifer" });
      searchLibrary({ db: workspace.db, query: "段落定位" });
      searchLibrary({ db: workspace.db, query: "xyzzyplughqqq999" });
      searchLibrary({ db: workspace.db, query: "   " });

      const after = snapshot(workspace);
      assert.deepEqual(after.counts, before.counts);
      assert.equal(after.digest, before.digest);
      assert.equal(workspace.loadKnowledgeCard(draft.id).status, "draft");
      assert.equal(workspace.loadBook(book.id).contentHash, book.contentHash);
    } finally {
      workspace.close();
    }
  });

  it("stays local and does not add a hosted vector or FTS client", () => {
    const files = fs.readdirSync(SEARCH_SRC_DIR).filter((name) => name.endsWith(".ts"));
    assert.ok(files.includes("memory-index.ts"));
    for (const name of files) {
      const source = fs.readFileSync(path.join(SEARCH_SRC_DIR, name), "utf8");
      assert.doesNotMatch(source, /\bfetch\s*\(/);
      assert.doesNotMatch(source, /from ["']node:https["']/);
      assert.doesNotMatch(source, /from ["']node:http["']/);
      assert.doesNotMatch(source, /CREATE VIRTUAL TABLE|fts5|fts4/i);
      assert.doesNotMatch(source, /openai|anthropic|pinecone|weaviate|chromadb|qdrant|milvus|cohere/i);
    }
  });
});
