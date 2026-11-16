import type { SearchHit } from "@bookskill/core";
import { flattenGroupedHits } from "./group.ts";
import type { SearchUiState } from "./types.ts";

export type SearchKeyboardAction = "none" | "jump";

export type SearchKeyboardResult = {
  state: SearchUiState;
  handled: boolean;
  action: SearchKeyboardAction;
  selectedHit: SearchHit | null;
};

export function applySearchKeyboard(state: SearchUiState, key: string): SearchKeyboardResult {
  const hits = flattenGroupedHits(state.results);
  const current = state.selectedIndex ?? -1;
  if (hits.length === 0) {
    return { state, handled: false, action: "none", selectedHit: null };
  }
  if (key === "ArrowDown" || key === "ArrowUp") {
    const start = current >= 0 ? current : key === "ArrowDown" ? -1 : hits.length;
    const next = Math.max(0, Math.min(hits.length - 1, start + (key === "ArrowDown" ? 1 : -1)));
    return {
      state: { ...state, selectedIndex: next, keyboardActive: true },
      handled: true,
      action: "none",
      selectedHit: hits[next] ?? null,
    };
  }
  if (key === "Enter" && state.keyboardActive === true && current >= 0 && current < hits.length) {
    return {
      state,
      handled: true,
      action: "jump",
      selectedHit: hits[current] ?? null,
    };
  }
  return {
    state,
    handled: false,
    action: "none",
    selectedHit: current >= 0 ? (hits[current] ?? null) : null,
  };
}
