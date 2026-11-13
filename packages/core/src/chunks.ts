import { UNCONFIRMED_LOCATION_LABEL } from "./constants.ts";
import type { ParsedChunk, SourceLocation } from "./types.ts";
import { normalizeWhitespace } from "./util.ts";

const PARAGRAPH_RE = /\[(P\d+\.\d+)\]/g;
const CHAPTER_RE = /Chapter\s+(\d+)\.\s+([^[\n]+)/gi;

export type ChunkContext = {
  page?: number | null;
  hrefFor?: (paragraphId: string | null, chapterTitle: string | null) => string | null;
};

/**
 * Split extracted book text into chapter/paragraph chunks.
 * Paragraphs that carry a [P#.#] locator are confirmed; bare intro text is not.
 */
export function splitLocatedChunks(text: string, context: ChunkContext = {}): ParsedChunk[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const parts: ParsedChunk[] = [];
  const matches = [...normalized.matchAll(PARAGRAPH_RE)];
  let chapterTitle: string | null = findChapterBefore(normalized, matches[0]?.index ?? normalized.length);
  let ordinal = 0;

  const push = (
    raw: string,
    paragraphId: string | null,
    confirmed: boolean,
    page: number | null,
  ): void => {
    const cleaned = normalizeWhitespace(raw);
    if (!cleaned) {
      return;
    }
    const seen = findChapterIn(cleaned);
    if (seen) {
      chapterTitle = seen;
    }
    const location: SourceLocation = {
      paragraphId,
      confirmed,
      chapterTitle,
      page,
      href: context.hrefFor?.(paragraphId, chapterTitle) ?? null,
      unconfirmedLabel: confirmed ? undefined : UNCONFIRMED_LOCATION_LABEL,
    };
    parts.push({
      chapter: chapterTitle,
      page,
      location,
      text: cleaned,
      ordinal,
    });
    ordinal += 1;
  };

  if (matches.length === 0) {
    push(normalized, null, false, context.page ?? null);
    return parts;
  }

  const firstIndex = matches[0]?.index ?? 0;
  if (firstIndex > 0) {
    push(normalized.slice(0, firstIndex), null, false, context.page ?? null);
  }

  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    if (!current || current.index === undefined) {
      continue;
    }
    const next = matches[i + 1];
    const end = next?.index ?? normalized.length;
    const paragraphId = current[1] ?? null;
    push(normalized.slice(current.index, end), paragraphId, Boolean(paragraphId), context.page ?? null);
  }

  return parts;
}

function findChapterBefore(text: string, end: number): string | null {
  return findChapterIn(text.slice(0, end));
}

function findChapterIn(text: string): string | null {
  let found: string | null = null;
  CHAPTER_RE.lastIndex = 0;
  let match: RegExpExecArray | null = CHAPTER_RE.exec(text);
  while (match) {
    const number = match[1];
    const title = normalizeWhitespace(match[2] ?? "");
    found = title ? `Chapter ${number}. ${title}` : `Chapter ${number}`;
    match = CHAPTER_RE.exec(text);
  }
  return found;
}

/**
 * Prefer the passage that *begins* with the highlight after its locator,
 * so a neighboring paragraph that only mentions the sentence is not chosen.
 */
export function chooseHighlightMatch<T extends { text: string }>(chunks: T[], snippet: string): T | null {
  const needle = normalizeWhitespace(snippet).toLowerCase();
  if (!needle) {
    return null;
  }
  const scored = chunks
    .map((chunk) => {
      const text = chunk.text.toLowerCase();
      const body = text.replace(/^\s*\[p\d+\.\d+\]\s*/, "");
      const bodyIndex = body.indexOf(needle);
      if (bodyIndex < 0 && !text.includes(needle)) {
        return null;
      }
      const index = bodyIndex >= 0 ? bodyIndex : text.indexOf(needle);
      return { chunk, starts: body.startsWith(needle), index };
    })
    .filter((row): row is { chunk: T; starts: boolean; index: number } => row !== null);

  if (scored.length === 0) {
    return null;
  }
  scored.sort((a, b) => Number(b.starts) - Number(a.starts) || a.index - b.index);
  return scored[0]?.chunk ?? null;
}
