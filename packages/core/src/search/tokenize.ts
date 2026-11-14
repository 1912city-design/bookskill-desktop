import { normalizeWhitespace } from "../util.ts";

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "in",
  "on",
  "for",
  "is",
  "are",
  "be",
  "as",
  "at",
  "by",
  "it",
  "its",
  "this",
  "that",
  "with",
  "from",
  "when",
  "what",
  "how",
  "should",
  "may",
  "must",
  "only",
  "every",
  "into",
  "not",
  "no",
  "的",
  "与",
  "和",
  "在",
  "是",
  "为",
  "了",
  "把",
  "被",
  "将",
  "及其",
]);

export function normalizeSearchText(text: string): string {
  return normalizeWhitespace(text.normalize("NFKC").toLowerCase());
}

export function lightStem(token: string): string {
  if (!/^[a-z]+$/.test(token) || token.length < 5) {
    return token;
  }
  if (token.endsWith("ies") && token.length > 5) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("ing") && token.length > 6) {
    const base = token.slice(0, -3);
    return base.endsWith(base.at(-1) ?? "") && /(.)\1$/.test(base) ? base.slice(0, -1) : base;
  }
  if (token.endsWith("ed") && token.length > 5) {
    return token.slice(0, -2);
  }
  if (token.endsWith("es") && token.length > 5) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss") && token.length > 4) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string): string[] {
  const normalized = normalizeSearchText(text);
  if (!normalized) {
    return [];
  }
  const tokens: string[] = [];
  for (const match of normalized.matchAll(/[a-z0-9]+(?:'[a-z]+)?/g)) {
    const raw = match[0] ?? "";
    if (raw) {
      tokens.push(raw);
      const stemmed = lightStem(raw);
      if (stemmed !== raw) {
        tokens.push(stemmed);
      }
    }
  }
  for (const match of normalized.matchAll(/[\u3400-\u9fff]+/g)) {
    const run = match[0] ?? "";
    if (!run) {
      continue;
    }
    tokens.push(run);
    if (run.length === 1) {
      continue;
    }
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.push(run.slice(index, index + 2));
    }
  }
  return unique(tokens);
}

export function significantTokens(text: string): string[] {
  return unique(tokenize(text).filter((token) => !STOPWORDS.has(token) && token.length > 1));
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

export function makeSnippet(text: string, query: string, width = 180): string {
  const compact = normalizeWhitespace(text);
  if (!compact) {
    return "";
  }
  const haystack = normalizeSearchText(compact);
  const needle = normalizeSearchText(query);
  let start = 0;
  if (needle) {
    const at = haystack.indexOf(needle);
    if (at >= 0) {
      start = Math.max(0, at - Math.floor((width - needle.length) / 2));
    }
  }
  const slice = compact.slice(start, start + width);
  const prefix = start > 0 ? "…" : "";
  const suffix = start + width < compact.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}
