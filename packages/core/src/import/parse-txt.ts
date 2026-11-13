import { splitLocatedChunks } from "../chunks.ts";
import type { ParsedBook } from "../types.ts";
import { normalizeWhitespace } from "../util.ts";

/**
 * Parse a UTF-8 plain-text source into titled, paragraph-located chunks.
 * Title comes from the first non-empty line. Author remains null.
 */
export function parseTxt(buffer: Buffer): ParsedBook {
  const text = decodeUtf8(buffer);
  const chunks = splitLocatedChunks(text);
  if (chunks.length === 0) {
    throw new Error("Plain text produced no extractable text chunks");
  }
  return {
    title: inferTxtTitle(text),
    author: null,
    format: "txt",
    chunks,
  };
}

export function inferTxtTitle(text: string): string {
  const first = firstNonEmptyLine(text);
  return first ?? "Untitled Text";
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
