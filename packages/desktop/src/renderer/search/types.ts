import type { SearchHit, SearchMode, SearchResult, SemanticSearchFallback } from "@bookskill/core";

export type SearchUiState = {
  query: string;
  mode: SearchMode;
  results: SearchHit[];
  fallback: SemanticSearchFallback | null;
  searched: boolean;
  statusMessage: string | null;
  error: string | null;
  /** Index into the type-grouped visual list; -1 when nothing is selected. */
  selectedIndex?: number;
  /** True after the user has moved the selection with arrow keys. */
  keyboardActive?: boolean;
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
    selectedIndex: -1,
    keyboardActive: false,
  };
}
