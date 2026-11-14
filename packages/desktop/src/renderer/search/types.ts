import type { SearchHit, SearchMode, SearchResult, SemanticSearchFallback } from "@bookskill/core";

export type SearchUiState = {
  query: string;
  mode: SearchMode;
  results: SearchHit[];
  fallback: SemanticSearchFallback | null;
  searched: boolean;
  statusMessage: string | null;
  error: string | null;
};

export type { SearchHit, SearchMode, SearchResult };

export function emptySearchUiState(): SearchUiState {
  return {
    query: "",
    mode: "fulltext",
    results: [],
    fallback: null,
    searched: false,
    statusMessage: null,
    error: null,
  };
}
