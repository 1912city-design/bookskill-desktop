import {
  MIN_FUZZY_LENGTH,
  MIN_PREFIX_LENGTH,
  isOneEditApart,
  lightStem,
  significantTokens,
  unique,
} from "./tokenize.ts";
import type { SearchableRecord } from "./types.ts";

export type TermMatchKind = "exact" | "prefix" | "typo";

export type TermMatch = {
  kind: TermMatchKind;
  fragment: string;
};

/**
 * Rebuildable in-process inverted / prefix index.
 * Discardable cache only — never the source of truth (D-012).
 * After a restart, callers rebuild it from the business database.
 */
export type SearchMemoryIndex = {
  records: readonly SearchableRecord[];
  inverted: Map<string, number[]>;
  tokens: string[];
  prefixBuckets: Map<string, string[]>;
  recordTokens: Array<Set<string>>;
};

const KIND_RANK: Record<TermMatchKind, number> = {
  exact: 0,
  prefix: 1,
  typo: 2,
};

function bucketKey(token: string): string {
  return token.slice(0, Math.min(2, token.length));
}

export function buildSearchIndex(records: readonly SearchableRecord[]): SearchMemoryIndex {
  const inverted = new Map<string, number[]>();
  const recordTokens: Array<Set<string>> = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) {
      recordTokens.push(new Set());
      continue;
    }
    const tokens = unique([...significantTokens(record.title), ...significantTokens(record.text)]);
    recordTokens.push(new Set(tokens));
    for (const token of tokens) {
      const list = inverted.get(token);
      if (list) {
        if (list[list.length - 1] !== index) {
          list.push(index);
        }
      } else {
        inverted.set(token, [index]);
      }
    }
  }

  const tokens = [...inverted.keys()];
  const prefixBuckets = new Map<string, string[]>();
  for (const token of tokens) {
    const key = bucketKey(token);
    const bucket = prefixBuckets.get(key);
    if (bucket) {
      bucket.push(token);
    } else {
      prefixBuckets.set(key, [token]);
    }
  }

  return { records, inverted, tokens, prefixBuckets, recordTokens };
}

const recordIndexCache = new WeakMap<object, SearchMemoryIndex>();

/**
 * Return a cached in-process index for this records array identity, building
 * it on the first call. The cache is discarded when the array is GC'd.
 */
export function getOrBuildSearchIndex(records: readonly SearchableRecord[]): SearchMemoryIndex {
  const cached = recordIndexCache.get(records as object);
  if (cached) {
    return cached;
  }
  const index = buildSearchIndex(records);
  recordIndexCache.set(records as object, index);
  return index;
}

export function matchQueryTerm(index: SearchMemoryIndex, term: string): Map<number, TermMatch> {
  const matches = new Map<number, TermMatch>();
  const add = (recordIndex: number, kind: TermMatchKind, fragment: string): void => {
    const previous = matches.get(recordIndex);
    if (!previous || KIND_RANK[kind] < KIND_RANK[previous.kind]) {
      matches.set(recordIndex, { kind, fragment });
    }
  };

  const exactLists = [index.inverted.get(term), index.inverted.get(lightStem(term))];
  for (const list of exactLists) {
    if (!list) {
      continue;
    }
    for (const recordIndex of list) {
      add(recordIndex, "exact", term);
    }
  }

  if (term.length >= MIN_PREFIX_LENGTH) {
    const bucket = index.prefixBuckets.get(bucketKey(term)) ?? [];
    for (const token of bucket) {
      if (!token.startsWith(term) || token.length <= term.length) {
        continue;
      }
      for (const recordIndex of index.inverted.get(token) ?? []) {
        add(recordIndex, "prefix", token);
      }
    }
  }

  if (term.length >= MIN_FUZZY_LENGTH) {
    const stemmed = lightStem(term);
    for (const token of index.tokens) {
      if (token.length < MIN_FUZZY_LENGTH) {
        continue;
      }
      if (token === term || token === stemmed) {
        continue;
      }
      if (isOneEditApart(term, token) || (stemmed !== term && isOneEditApart(stemmed, token))) {
        for (const recordIndex of index.inverted.get(token) ?? []) {
          add(recordIndex, "typo", token);
        }
      }
    }
  }

  return matches;
}
