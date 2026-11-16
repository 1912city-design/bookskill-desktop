import type { DatabaseSync } from "node:sqlite";
import { expandQueryTokens, jaccard, overlapCount, recordTokenSet } from "./expand.ts";
import { collectSearchableRecords } from "./collect.ts";
import { buildSearchIndex, getOrBuildSearchIndex, matchQueryTerm, type SearchMemoryIndex, type TermMatch } from "./memory-index.ts";
import { makeSnippet, normalizeSearchText, significantTokens, unique } from "./tokenize.ts";
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
const PHRASE_TITLE_SCORE = 100;
const PHRASE_TEXT_SCORE = 80;
const ALL_TERMS_EXACT_BONUS = 40;
const EXACT_TERM_SCORE = 12;
const PREFIX_TERM_SCORE = 7;
const TYPO_TERM_SCORE = 4;
const COVERAGE_WEIGHT = 20;
const TITLE_TERM_BONUS = 1.25;

type LibraryIndexCache = {
  fingerprint: string;
  records: SearchableRecord[];
  index: SearchMemoryIndex;
};

const libraryIndexCache = new WeakMap<object, LibraryIndexCache>();

function extraRecordsFingerprint(records: readonly SearchableRecord[] | undefined): string {
  if (!records || records.length === 0) {
    return "0";
  }
  let chars = 0;
  const ids: string[] = [];
  for (const record of records) {
    chars += record.text.length + record.title.length;
    ids.push(record.id);
  }
  ids.sort();
  return `${records.length}:${chars}:${ids[0]}:${ids[ids.length - 1]}`;
}

function tableStamp(db: DatabaseSync, table: string, withUpdatedAt: boolean): string {
  if (withUpdatedAt) {
    const row = db
      .prepare(`SELECT COUNT(*) AS count, COALESCE(MAX(updated_at), '') AS updated FROM ${table}`)
      .get() as { count: number; updated: string };
    return `${table}:${row.count}:${row.updated}`;
  }
  const row = db
    .prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(LENGTH(text)), 0) AS chars FROM ${table}`)
    .get() as { count: number; chars: number };
  return `${table}:${row.count}:${row.chars}`;
}

function countStamp(db: DatabaseSync, table: string): string {
  const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number };
  return `${table}:${row.count}`;
}

/**
 * Cheap staleness key for the in-process index. Not a content hash;
 * a changed count or timestamp triggers a rebuild from the business DB.
 */
export function libraryIndexFingerprint(db: DatabaseSync, extraRecords?: readonly SearchableRecord[]): string {
  return [
    tableStamp(db, "books", true),
    tableStamp(db, "source_chunks", false),
    tableStamp(db, "knowledge_cards", true),
    tableStamp(db, "annotations", true),
    countStamp(db, "knowledge_sources"),
    extraRecordsFingerprint(extraRecords),
  ].join("|");
}

function getOrBuildLibraryIndex(db: DatabaseSync, extraRecords?: SearchableRecord[]): LibraryIndexCache {
  const fingerprint = libraryIndexFingerprint(db, extraRecords);
  const cached = libraryIndexCache.get(db);
  if (cached && cached.fingerprint === fingerprint) {
    return cached;
  }
  const collected = collectSearchableRecords(db);
  const records = extraRecords ? [...collected, ...extraRecords] : collected;
  const entry: LibraryIndexCache = {
    fingerprint,
    records,
    index: buildSearchIndex(records),
  };
  libraryIndexCache.set(db, entry);
  return entry;
}

function phraseScore(title: string, text: string, query: string): number {
  const needle = normalizeSearchText(query);
  if (!needle) {
    return 0;
  }
  const normalizedTitle = normalizeSearchText(title);
  if (normalizedTitle.includes(needle)) {
    return PHRASE_TITLE_SCORE + Math.min(8, needle.length / Math.max(normalizedTitle.length, 1) * 8);
  }
  const normalizedText = normalizeSearchText(text);
  if (normalizedText.includes(needle)) {
    return PHRASE_TEXT_SCORE + Math.min(6, needle.length / Math.max(normalizedText.length, 1) * 6);
  }
  return 0;
}

function termPoints(kind: TermMatch["kind"]): number {
  if (kind === "exact") {
    return EXACT_TERM_SCORE;
  }
  if (kind === "prefix") {
    return PREFIX_TERM_SCORE;
  }
  return TYPO_TERM_SCORE;
}

function fulltextScore(
  record: SearchableRecord,
  query: string,
  terms: readonly string[],
  matchesByTerm: ReadonlyMap<number, TermMatch>[],
  recordIndex: number,
): number | null {
  const phrase = phraseScore(record.title, record.text, query);
  if (terms.length === 0) {
    return phrase > 0 ? phrase : null;
  }

  let exactCount = 0;
  let matchedTerms = 0;
  let score = phrase;
  const fragments: string[] = [];
  const titleNormalized = normalizeSearchText(record.title);

  for (let index = 0; index < terms.length; index += 1) {
    const match = matchesByTerm[index]?.get(recordIndex);
    if (!match) {
      continue;
    }
    matchedTerms += 1;
    if (match.kind === "exact") {
      exactCount += 1;
    }
    fragments.push(match.fragment);
    let points = termPoints(match.kind);
    if (titleNormalized.includes(normalizeSearchText(match.fragment))) {
      points *= TITLE_TERM_BONUS;
    }
    score += points;
  }

  if (matchedTerms === 0) {
    return phrase > 0 ? phrase : null;
  }
  if (exactCount === terms.length) {
    score += ALL_TERMS_EXACT_BONUS;
  }
  score += (matchedTerms / terms.length) * COVERAGE_WEIGHT;
  return score;
}

function semanticScore(record: SearchableRecord, query: string, expanded: string[]): number | null {
  const phrase = phraseScore(record.title, record.text, query);
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

function toHit(record: SearchableRecord, query: string, score: number, fragments: readonly string[]): SearchHit {
  const recordId = record.id.includes(":") ? record.id.slice(record.id.indexOf(":") + 1) : record.id;
  const matchedFragments = unique(fragments.filter((part) => part.trim().length > 0));
  return {
    id: record.id,
    contentType: record.contentType,
    title: record.title,
    snippet: makeSnippet(record.text, query, 180, matchedFragments),
    matchedFragments,
    score,
    source: record.source,
    recordKind: record.kind,
    recordId,
  };
}

function fragmentsForMatch(
  record: SearchableRecord,
  query: string,
  terms: readonly string[],
  matchesByTerm: ReadonlyMap<number, TermMatch>[],
  recordIndex: number,
): string[] {
  const fragments: string[] = [];
  const needle = normalizeSearchText(query);
  const haystack = normalizeSearchText(`${record.title} ${record.text}`);
  if (needle && haystack.includes(needle)) {
    fragments.push(query.trim());
  }
  for (let index = 0; index < terms.length; index += 1) {
    const match = matchesByTerm[index]?.get(recordIndex);
    if (match) {
      fragments.push(match.fragment);
    }
  }
  return unique(fragments);
}

function compareHits(left: SearchHit, right: SearchHit): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }
  const typeOrder = left.contentType.localeCompare(right.contentType, "zh");
  if (typeOrder !== 0) {
    return typeOrder;
  }
  return left.id.localeCompare(right.id);
}

function queryIndex(index: SearchMemoryIndex, input: SearchQuery): SearchResult {
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

  if (mode === "semantic") {
    const candidateIds = new Set<number>();
    for (const token of expanded) {
      for (const recordIndex of index.inverted.get(token) ?? []) {
        candidateIds.add(recordIndex);
      }
    }
    const needle = normalizeSearchText(trimmed);
    if (needle) {
      for (let recordIndex = 0; recordIndex < index.records.length; recordIndex += 1) {
        const record = index.records[recordIndex];
        if (!record) {
          continue;
        }
        if (
          normalizeSearchText(record.title).includes(needle) ||
          normalizeSearchText(record.text).includes(needle)
        ) {
          candidateIds.add(recordIndex);
        }
      }
    }
    for (const recordIndex of candidateIds) {
      const record = index.records[recordIndex];
      if (!record) {
        continue;
      }
      const score = semanticScore(record, trimmed, expanded);
      if (score == null) {
        continue;
      }
      const overlapFragments = expanded.filter((token) => (index.recordTokens[recordIndex]?.has(token) ?? false));
      scored.push(toHit(record, trimmed, score, [trimmed, ...overlapFragments]));
    }
  } else {
    const matchesByTerm = terms.map((term) => matchQueryTerm(index, term));
    const candidateIds = new Set<number>();
    for (const matches of matchesByTerm) {
      for (const recordIndex of matches.keys()) {
        candidateIds.add(recordIndex);
      }
    }
    for (const recordIndex of candidateIds) {
      const record = index.records[recordIndex];
      if (!record) {
        continue;
      }
      const score = fulltextScore(record, trimmed, terms, matchesByTerm, recordIndex);
      if (score == null) {
        continue;
      }
      scored.push(toHit(record, trimmed, score, fragmentsForMatch(record, trimmed, terms, matchesByTerm, recordIndex)));
    }
  }

  scored.sort(compareHits);
  return {
    query: trimmed,
    mode,
    fallback,
    backend: SEARCH_BACKEND_LOCAL,
    results: scored.slice(0, limit),
  };
}

export function searchRecords(records: readonly SearchableRecord[], input: SearchQuery): SearchResult {
  return queryIndex(getOrBuildSearchIndex(records), input);
}

export function searchIndexedRecords(index: SearchMemoryIndex, input: SearchQuery): SearchResult {
  return queryIndex(index, input);
}

/**
 * Full-text or local-fallback semantic search over already-imported books,
 * knowledge cards, and annotation rows in the business database.
 * Read-only: never writes to books, cards, or annotations.
 * Uses a rebuildable in-process inverted/prefix index (D-012); the cache is
 * discarded when the database handle is GC'd or the cheap fingerprint changes.
 */
export function searchLibrary(options: SearchLibraryOptions): SearchResult {
  const cached = getOrBuildLibraryIndex(options.db, options.extraRecords);
  return queryIndex(cached.index, {
    query: options.query,
    mode: options.mode,
    limit: options.limit,
  });
}

export type SearchLibraryOptions = SearchQuery & {
  db: DatabaseSync;
  extraRecords?: SearchableRecord[];
};
