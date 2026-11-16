export const SEARCH_CONTENT_TYPE_ORIGINAL = "原文";
export const SEARCH_CONTENT_TYPE_AI_SUMMARY = "AI 归纳";
export const SEARCH_CONTENT_TYPE_USER_JUDGMENT = "用户判断";

export const SEARCH_CONTENT_TYPES = [
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_AI_SUMMARY,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
] as const;

export type SearchContentType = (typeof SEARCH_CONTENT_TYPES)[number];

export type SearchMode = "fulltext" | "semantic";

/** V1 semantic path is always this local fallback; there is no embedding index. */
export const SEMANTIC_SEARCH_FALLBACK = "local_keyword_expansion" as const;
export type SemanticSearchFallback = typeof SEMANTIC_SEARCH_FALLBACK | "none";

export const SEARCH_BACKEND_LOCAL = "local_deterministic" as const;
export type SearchBackend = typeof SEARCH_BACKEND_LOCAL;

export type SearchRecordKind = "source_chunk" | "knowledge_card" | "annotation" | "excerpt";

export type SearchSourceLocator = {
  bookId: string;
  bookTitle: string;
  /** Jumpable locator within the book, typically a paragraph id. */
  locator: string;
  paragraphId: string | null;
  chapter: string | null;
  page: number | null;
  confirmed: boolean;
  chunkId: string | null;
};

export type SearchableRecord = {
  id: string;
  kind: SearchRecordKind;
  contentType: SearchContentType;
  title: string;
  text: string;
  source: SearchSourceLocator;
};

export type SearchHit = {
  id: string;
  contentType: SearchContentType;
  title: string;
  snippet: string;
  /** Plain-text fragments actually found in the record, for snippet highlighting. */
  matchedFragments: string[];
  score: number;
  source: SearchSourceLocator;
  recordKind: SearchRecordKind;
  recordId: string;
};

export type SearchQuery = {
  query: string;
  mode?: SearchMode;
  limit?: number;
};

export type SearchResult = {
  query: string;
  mode: SearchMode;
  fallback: SemanticSearchFallback;
  backend: SearchBackend;
  results: SearchHit[];
};

export const DEFAULT_SEARCH_LIMIT = 25;
