import { splitLocatedChunks } from "../chunks.ts";
import type { ParsedBook } from "../types.ts";
import { normalizeWhitespace } from "../util.ts";

/**
 * Parse a UTF-8 Markdown source into titled, paragraph-located chunks.
 * Title comes from the first ATX heading, or the first non-empty line.
 * Author is not inferred from Markdown and remains null.
 */
export function parseMarkdown(buffer: Buffer): ParsedBook {
  const text = decodeUtf8(buffer);
  const chunks = splitLocatedChunks(text);
  if (chunks.length === 0) {
    throw new Error("Markdown produced no extractable text chunks");
  }
  return {
    title: inferMarkdownTitle(text),
    author: null,
    format: "markdown",
    chunks,
  };
}

export function inferMarkdownTitle(text: string): string {
  const heading = text.match(/^\s{0,3}#{1,6}[ \t]+(.+?)\s*$/m);
  if (heading?.[1]) {
    const title = normalizeWhitespace(heading[1].replace(/\s+#+\s*$/, ""));
    if (title) {
      return title;
    }
  }
  const first = firstNonEmptyLine(text);
  return first ?? "Untitled Markdown";
}

function decodeUtf8(buffer: Buffer): string {
  const text = buffer.toString("utf8");
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function firstNonEmptyLine(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = normalizeWhitespace(line);
    if (trimmed) {
      return trimmed;
    }
  }
  return null;
}
