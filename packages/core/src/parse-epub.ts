import { splitLocatedChunks } from "./chunks.ts";
import type { ParsedBook, ParsedChunk } from "./types.ts";
import { decodeXmlEntities, normalizeWhitespace } from "./util.ts";
import { readZipEntries } from "./zip.ts";

/**
 * Parse a licensed EPUB into titled chapters and paragraph-located chunks.
 */
export function parseEpub(buffer: Buffer): ParsedBook {
  const entries = readZipEntries(buffer);
  const container = readText(entries, "META-INF/container.xml");
  const rootPath = container.match(/full-path="([^"]+)"/)?.[1];
  if (!rootPath) {
    throw new Error("EPUB is missing META-INF/container.xml rootfile");
  }
  const opf = readText(entries, rootPath);
  const base = rootPath.includes("/") ? rootPath.slice(0, rootPath.lastIndexOf("/") + 1) : "";
  const title = textContent(opf, "dc:title") ?? "Untitled EPUB";
  const author = textContent(opf, "dc:creator");

  const manifest = new Map<string, string>();
  for (const item of opf.matchAll(/<item\b[^>]*>/g)) {
    const tag = item[0];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    const href = tag.match(/\bhref="([^"]+)"/)?.[1];
    if (id && href) {
      manifest.set(id, href);
    }
  }

  const spine = [...opf.matchAll(/<itemref\b[^>]*idref="([^"]+)"/g)].map((m) => m[1]).filter((id): id is string => Boolean(id));
  const chunks: ParsedChunk[] = [];
  let ordinalBase = 0;
  for (const id of spine) {
    const href = manifest.get(id);
    if (!href) {
      continue;
    }
    const path = resolveHref(base, href);
    const xhtml = readText(entries, path);
    const chapterTitle = headingFrom(xhtml) ?? textContent(xhtml, "title");
    const paragraphs = extractParagraphs(xhtml);
    const texts: string[] = [];
    if (chapterTitle) {
      texts.push(chapterTitle);
    }
    for (const paragraph of paragraphs) {
      texts.push(paragraph.text);
    }
    const pageChunks = splitLocatedChunks(texts.join("\n"), {
      hrefFor(paragraphId) {
        if (!paragraphId) {
          return path;
        }
        return `${path}#${paragraphId}`;
      },
    });
    for (const chunk of pageChunks) {
      const located: ParsedChunk = {
        ...chunk,
        chapter: chunk.chapter ?? chapterTitle,
        location: {
          ...chunk.location,
          chapterTitle: chunk.location.chapterTitle ?? chapterTitle,
        },
        ordinal: ordinalBase + chunk.ordinal,
      };
      chunks.push(located);
    }
    ordinalBase += pageChunks.length;
  }

  if (chunks.length === 0) {
    throw new Error("EPUB produced no extractable text chunks");
  }

  return { title, author, format: "epub", chunks };
}

function readText(entries: Map<string, Buffer>, name: string): string {
  const direct = entries.get(name) ?? entries.get(name.replace(/\\/g, "/"));
  if (direct) {
    return direct.toString("utf8");
  }
  const lower = name.toLowerCase();
  for (const [key, value] of entries) {
    if (key.toLowerCase() === lower) {
      return value.toString("utf8");
    }
  }
  throw new Error(`EPUB is missing ${name}`);
}

function resolveHref(base: string, href: string): string {
  if (!base || href.startsWith("/")) {
    return href.replace(/^\//, "");
  }
  const joined = `${base}${href}`.split("/");
  const out: string[] = [];
  for (const part of joined) {
    if (part === "." || part === "") {
      continue;
    }
    if (part === "..") {
      out.pop();
    } else {
      out.push(part);
    }
  }
  return out.join("/");
}

function textContent(xml: string, tag: string): string | null {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return match?.[1] ? normalizeWhitespace(decodeXmlEntities(stripTags(match[1]))) : null;
}

function headingFrom(xhtml: string): string | null {
  const match = xhtml.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  return match?.[1] ? normalizeWhitespace(decodeXmlEntities(stripTags(match[1]))) : null;
}

function extractParagraphs(xhtml: string): Array<{ id: string | null; text: string }> {
  const body = xhtml.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? xhtml;
  const paragraphs: Array<{ id: string | null; text: string }> = [];
  for (const match of body.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const attrs = match[1] ?? "";
    const id = attrs.match(/\bid="([^"]+)"/)?.[1] ?? null;
    const text = normalizeWhitespace(decodeXmlEntities(stripTags(match[2] ?? "")));
    if (text) {
      paragraphs.push({ id, text });
    }
  }
  return paragraphs;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}
