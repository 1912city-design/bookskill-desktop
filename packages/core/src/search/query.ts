import type { DatabaseSync } from "node:sqlite";
import { expandQueryTokens, jaccard, overlapCount, recordTokenSet } from "./expand.ts";
import { collectSearchableRecords } from "./collect.ts";
import { makeSnippet, normalizeSearchText, significantTokens } from "./tokenize.ts";
import {
  DEFAULT_SEARCH_LIMIT,
  SEARCH_BACKEND_LOCAL,
  SEMANTIC_SEARCH_FALLBACK,
  type SearchHit,
  type SearchMode,
  type SearchQuery,
  type SearchResult,
  type SearchableRecord,
} from "./types.ts";

const SEMANTIC_MIN_OVERLAP = 2;

export type SearchLibraryOptions = SearchQuery & {
  db: DatabaseSync;
  extraRecords?: SearchableRecord[];
};

function phraseScore(text: string, query: string): number {
  const haystack = normalizeSearchText(text);
  const needle = normalizeSearchText(query);
  if (!needle || !haystack.includes(needle)) {
    return 0;
  }
  // Shorter fields that contain the whole phrase rank slightly higher.
  return 8 + Math.min(4, needle.length / Math.max(haystack.length, 1));
}

function fulltextScore(record: SearchableRecord, query: string, terms: string[]): number | null {
  const phrase = phraseScore(record.text, query) + phraseScore(record.title, query) * 1.25;
  if (phrase > 0) {
    return phrase;
  }
  if (terms.length === 0) {
    return null;
  }
  const haystack = new Set([...significantTokens(record.text), ...significantTokens(record.title)]);
  const missing = terms.filter((term) => !haystack.has(term));
  if (missing.length > 0) {
    return null;
  }
  return 3 + terms.length;
}

function semanticScore(record: SearchableRecord, query: string, expanded: string[]): number | null {
  const phrase = phraseScore(record.text, query) + phraseScore(record.title, query) * 1.25;
  const recordTokens = new Set([...recordTokenSet(record.text), ...recordTokenSet(record.title)]);
  const overlap = overlapCount(expanded, recordTokens);
  const similarity = jaccard(new Set(expanded), recordTokens);
  // Require a phrase hit or at least two overlapping expanded tokens so a
  // single shared word like "primer" cannot count as a semantic match.
  if (phrase === 0 && overlap < SEMANTIC_MIN_OVERLAP) {
    return null;
  }
  return phrase + overlap + similarity * 6;
}

function toHit(record: SearchableRecord, query: string, score: number): SearchHit {
  const recordId = record.id.includes(":") ? record.id.slice(record.id.indexOf(":") + 1) : record.id;
  return {
    id: record.id,
    contentType: record.contentType,
    title: record.title,
    snippet: makeSnippet(record.text, query),
    score,
    source: record.source,
    recordKind: record.kind,
    recordId,
  };
}

export function searchRecords(records: readonly SearchableRecord[], input: SearchQuery): SearchResult {
  const query = typeof input.query === "string" ? input.query : "";
  const mode: SearchMode = input.mode === "semantic" ? "semantic" : "fulltext";
  const limit = Number.isFinite(input.limit) && (input.limit ?? 0) > 0 ? Math.floor(input.limit as number) : DEFAULT_SEARCH_LIMIT;
  const trimmed = query.trim();
  const fallback = mode === "semantic" ? SEMANTIC_SEARCH_FALLBACK : "none";
  const empty: SearchResult = {
    query: trimmed,
    mode,
    fallback,
    backend: SEARCH_BACKEND_LOCAL,
    results: [],
  };
  if (!trimmed) {
    return empty;
  }

  const terms = significantTokens(trimmed);
  const expanded = mode === "semantic" ? expandQueryTokens(trimmed) : terms;
  const scored: SearchHit[] = [];
  for (const record of records) {
    const score = mode === "semantic" ? semanticScore(record, trimmed, expanded) : fulltextScore(record, trimmed, terms);
    if (score == null) {
      continue;
    }
    scored.push(toHit(record, trimmed, score));
  }
  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    const typeOrder = left.contentType.localeCompare(right.contentType, "zh");
    if (typeOrder !== 0) {
      return typeOrder;
    }
    return left.id.localeCompare(right.id);
  });
  return {
    query: trimmed,
    mode,
    fallback,
    backend: SEARCH_BACKEND_LOCAL,
    results: scored.slice(0, limit),
  };
}

/**
 * Full-text or local-fallback semantic search over already-imported books,
 * knowledge cards, and annotation rows in the business database.
 * Read-only: never writes to books, cards, or annotations.
 */
export function searchLibrary(options: SearchLibraryOptions): SearchResult {
  const collected = collectSearchableRecords(options.db);
  const records = options.extraRecords ? [...collected, ...options.extraRecords] : collected;
  return searchRecords(records, {
    query: options.query,
    mode: options.mode,
    limit: options.limit,
  });
}
