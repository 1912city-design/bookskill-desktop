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

/** Minimum length for prefix matching on a query term. */
export const MIN_PREFIX_LENGTH = 2;
/** Minimum length for 1-edit-distance typo tolerance. */
export const MIN_FUZZY_LENGTH = 4;

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

/**
 * True when two strings are exactly one insertion, deletion, substitution,
 * or adjacent transposition apart. Distance 0 is false.
 */
export function isOneEditApart(left: string, right: string): boolean {
  if (left === right) {
    return false;
  }
  const aLen = left.length;
  const bLen = right.length;
  if (Math.abs(aLen - bLen) > 1) {
    return false;
  }
  if (aLen === bLen) {
    let diffs = 0;
    let transpose = false;
    for (let index = 0; index < aLen; index += 1) {
      if (left[index] === right[index]) {
        continue;
      }
      diffs += 1;
      if (diffs > 1) {
        return false;
      }
      if (index + 1 < aLen && left[index] === right[index + 1] && left[index + 1] === right[index]) {
        transpose = true;
        index += 1;
      }
    }
    return diffs === 1 || transpose;
  }
  const shorter = aLen < bLen ? left : right;
  const longer = aLen < bLen ? right : left;
  let skip = 0;
  let shortIndex = 0;
  for (let longIndex = 0; longIndex < longer.length; longIndex += 1) {
    if (shortIndex < shorter.length && shorter[shortIndex] === longer[longIndex]) {
      shortIndex += 1;
      continue;
    }
    skip += 1;
    if (skip > 1) {
      return false;
    }
  }
  return true;
}

export function makeSnippet(text: string, query: string, width = 180, fragments: readonly string[] = []): string {
  const compact = normalizeWhitespace(text);
  if (!compact) {
    return "";
  }
  const haystack = normalizeSearchText(compact);
  const needles = unique(
    [query, ...fragments].map((part) => normalizeSearchText(part)).filter((part) => part.length > 0),
  );
  let start = 0;
  let bestLength = 0;
  for (const needle of needles) {
    const at = haystack.indexOf(needle);
    if (at >= 0 && needle.length > bestLength) {
      bestLength = needle.length;
      start = Math.max(0, at - Math.floor((width - needle.length) / 2));
    }
  }
  const slice = compact.slice(start, start + width);
  const prefix = start > 0 ? "…" : "";
  const suffix = start + width < compact.length ? "…" : "";
  return `${prefix}${slice}${suffix}`;
}
