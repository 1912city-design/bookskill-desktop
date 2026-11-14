import { lightStem, significantTokens, unique } from "./tokenize.ts";

/**
 * Deterministic, local synonym / paraphrase groups used only as a V1
 * stand-in for semantic search. This is not an embedding model.
 */
const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  ["knowledge card", "knowledge cards", "card", "cards", "知识卡", "知识卡片"],
  ["valid", "validity", "validated", "有效", "成立"],
  ["cite", "cites", "cited", "citation", "引用", "标注来源", "来源引用"],
  ["paragraph", "paragraphs", "paragraph identifier", "locator", "定位符", "段落", "段落定位符"],
  ["claim", "claims", "断言", "主张"],
  ["source", "sources", "sourced", "来源"],
  ["hollow echo", "unsupported", "空洞回声", "无来源"],
  ["cedar", "cedars", "cedar tree", "cedar trees"],
  ["principle", "principles", "原则"],
  ["annotation", "note", "notes", "批注", "笔记", "用户批注"],
  ["excerpt", "passage", "摘录", "原文"],
  ["lantern", "index", "灯笼", "索引"],
  ["disagree", "disagreement", "contradict", "两条", "分歧"],
];

function groupTokens(phrase: string): string[] {
  return unique([...significantTokens(phrase), ...phrase.split(/\s+/).flatMap((part) => significantTokens(part))]);
}

const TOKEN_EXPANSIONS = new Map<string, string[]>();

for (const group of SYNONYM_GROUPS) {
  const expanded = unique(group.flatMap((phrase) => [phrase, ...groupTokens(phrase)]));
  for (const term of expanded) {
    const keys = unique([term, lightStem(term), ...groupTokens(term)]);
    for (const key of keys) {
      const current = TOKEN_EXPANSIONS.get(key) ?? [];
      TOKEN_EXPANSIONS.set(key, unique([...current, ...expanded]));
    }
  }
}

export function expandQueryTokens(query: string): string[] {
  const base = significantTokens(query);
  const expanded = [...base];
  for (const token of base) {
    const extras = TOKEN_EXPANSIONS.get(token) ?? TOKEN_EXPANSIONS.get(lightStem(token));
    if (extras) {
      expanded.push(...extras.flatMap((term) => significantTokens(term)));
      expanded.push(...extras);
    }
  }
  return unique(expanded.map((token) => token.trim()).filter(Boolean));
}

export function recordTokenSet(text: string): Set<string> {
  return new Set(significantTokens(text));
}

export function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }
  return intersection / (left.size + right.size - intersection);
}

export function overlapCount(left: readonly string[], right: ReadonlySet<string>): number {
  return unique(left).filter((token) => right.has(token)).length;
}
