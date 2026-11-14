import { splitLocatedChunks } from "./chunks.ts";
import type { ParsedBook, ParsedChunk } from "./types.ts";
import { inflateSync } from "node:zlib";
import { normalizeWhitespace } from "./util.ts";

/**
 * Lightweight extractor for text PDFs (uncompressed or FlateDecode streams).
 * Enough for the licensed BookSkill Test Primer; not a full PDF renderer.
 */
export function parseTextPdf(buffer: Buffer): ParsedBook {
  const source = decodePdfBytes(buffer);
  const objects = parseObjects(source);
  const pagesObj = [...objects.values()].find((obj) => /\/Type\s*\/Pages\b/.test(obj.dict) && /\/Kids\s*\[/.test(obj.dict));
  if (!pagesObj) {
    throw new Error("PDF is missing a /Pages tree");
  }
  const kids = [...pagesObj.dict.matchAll(/(\d+)\s+0\s+R/g)].map((m) => m[1]).filter((id): id is string => Boolean(id));
  const pageIds = kids.filter((id) => {
    const obj = objects.get(id);
    return obj ? /\/Type\s*\/Page\b/.test(obj.dict) && !/\/Type\s*\/Pages\b/.test(obj.dict) : false;
  });
  if (pageIds.length === 0) {
    throw new Error("PDF does not contain page objects");
  }

  const chunks: ParsedChunk[] = [];
  let ordinalBase = 0;
  for (let i = 0; i < pageIds.length; i += 1) {
    const pageId = pageIds[i];
    if (!pageId) continue;
    const page = objects.get(pageId);
    if (!page) continue;
    const contentsMatch = page.dict.match(/\/Contents\s+(\d+)\s+0\s+R/);
    const contentId = contentsMatch?.[1];
    const content = contentId ? objects.get(contentId) : undefined;
    const pageText = extractText(content?.stream ?? content?.dict ?? "");
    const pageChunks = splitLocatedChunks(pageText, { page: i + 1 });
    for (const chunk of pageChunks) {
      chunks.push({ ...chunk, ordinal: ordinalBase + chunk.ordinal });
    }
    ordinalBase += pageChunks.length;
  }

  if (chunks.length === 0) {
    throw new Error("PDF produced no extractable text chunks");
  }

  const info = extractTrailerInfo(source);
  const title = info.title ?? inferTitle(chunks) ?? "Untitled PDF";
  return {
    title,
    author: info.author,
    format: "pdf",
    chunks,
  };
}

type PdfObject = { dict: string; stream: string | null };

function decodePdfBytes(buffer: Buffer): string {
  // Primer and similar Latin text PDFs are ASCII/Latin-1 in the content stream.
  return buffer.toString("latin1");
}

function parseObjects(source: string): Map<string, PdfObject> {
  const objects = new Map<string, PdfObject>();
  const re = /(\d+)\s+0\s+obj\b([\s\S]*?)endobj/g;
  let match: RegExpExecArray | null = re.exec(source);
  while (match) {
    const id = match[1];
    const body = match[2] ?? "";
    const streamIndex = body.search(/\bstream\b/);
    if (streamIndex >= 0) {
      const dict = body.slice(0, streamIndex);
      let start = streamIndex + "stream".length;
      if (body[start] === "\r") start += 1;
      if (body[start] === "\n") start += 1;
      const end = body.search(/\bendstream\b/);
      const raw = end >= 0 ? body.slice(start, end) : body.slice(start);
      objects.set(id ?? "", { dict, stream: decodeStream(dict, raw) });
    } else if (id) {
      objects.set(id, { dict: body, stream: null });
    }
    match = re.exec(source);
  }
  return objects;
}

function decodeStream(dict: string, raw: string): string {
  const bytes = Buffer.from(raw, "latin1");
  if (/\/Filter\s*\/FlateDecode/.test(dict)) {
    return inflateSync(bytes).toString("latin1");
  }
  return raw;
}

function extractText(content: string): string {
  const pieces: string[] = [];
  const re = /\(((?:\\.|[^\\)])*)\)\s*Tj/g;
  let match: RegExpExecArray | null = re.exec(content);
  while (match) {
    pieces.push(decodePdfString(match[1] ?? ""));
    match = re.exec(content);
  }
  return pieces.join(" ");
}

function decodePdfString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch !== "\\") {
      out += ch;
      continue;
    }
    const next = raw[i + 1];
    if (next === undefined) {
      break;
    }
    const simple: Record<string, string> = {
      n: "\n",
      r: "\r",
      t: "\t",
      b: "\b",
      f: "\f",
      "\\": "\\",
      "(": "(",
      ")": ")",
    };
    if (next in simple) {
      out += simple[next];
      i += 1;
      continue;
    }
    if (/[0-7]/.test(next)) {
      let oct = next;
      i += 1;
      if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1] ?? "")) {
        i += 1;
        oct += raw[i];
      }
      if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1] ?? "")) {
        i += 1;
        oct += raw[i];
      }
      out += String.fromCharCode(parseInt(oct, 8));
      continue;
    }
    out += next;
    i += 1;
  }
  return out;
}

function extractTrailerInfo(source: string): { title: string | null; author: string | null } {
  const title = source.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/)?.[1] ?? null;
  const author = source.match(/\/Author\s*\(((?:\\.|[^\\)])*)\)/)?.[1] ?? null;
  return {
    title: title ? normalizeWhitespace(decodePdfString(title)) : null,
    author: author ? normalizeWhitespace(decodePdfString(author)) : null,
  };
}

function inferTitle(chunks: ParsedChunk[]): string | null {
  const first = chunks[0]?.text;
  if (!first) {
    return null;
  }
  const beforeChapter = first.split(/Chapter\s+\d+\./)[0];
  const candidate = normalizeWhitespace(beforeChapter ?? first).slice(0, 80);
  return candidate || null;
}
