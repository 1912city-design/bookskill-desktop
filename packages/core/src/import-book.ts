import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PARSE_STATUS_FAILED, PARSE_STATUS_PARSED } from "./constants.ts";
import { parseEpub } from "./parse-epub.ts";
import { parseTextPdf } from "./parse-pdf.ts";
import { chooseHighlightMatch } from "./chunks.ts";
import type { BookFormat, ImportedBook, ImportedChunk, ParsedBook, SourceLocation } from "./types.ts";
import { newId, nowIso, sha256, withTransaction } from "./util.ts";

export type ImportBookOptions = {
  db: DatabaseSync;
  dataDir: string;
  filePath: string;
  now?: Date;
};

export function detectFormat(filePath: string): BookFormat {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".epub") return "epub";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".txt") return "txt";
  throw new Error(`Unsupported source format: ${ext || "unknown"}`);
}

export function importBook(options: ImportBookOptions): ImportedBook {
  const absolute = path.resolve(options.filePath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`Source file not found: ${absolute}`);
  }
  const buffer = fs.readFileSync(absolute);
  const format = detectFormat(absolute);
  const contentHash = sha256(buffer);
  const stamp = nowIso(options.now);
  const id = newId();
  const storedPath = storeOriginal(options.dataDir, id, absolute, buffer);

  let parsed: ParsedBook;
  try {
    parsed = parseSource(format, buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    options.db
      .prepare(
        `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, path.basename(absolute), null, format, storedPath, contentHash, PARSE_STATUS_FAILED, stamp, stamp);
    throw new Error(`Failed to parse ${format}: ${message}`);
  }

  return withTransaction(options.db, () => {
    options.db
      .prepare(
        `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        parsed.title,
        parsed.author,
        parsed.format,
        storedPath,
        contentHash,
        PARSE_STATUS_PARSED,
        stamp,
        stamp,
      );

    const chunks: ImportedChunk[] = [];
    const insert = options.db.prepare(
      `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const chunk of parsed.chunks) {
      const chunkId = newId();
      const locationJson = JSON.stringify(chunk.location);
      const chunkHash = sha256(chunk.text);
      insert.run(
        chunkId,
        id,
        chunk.chapter,
        chunk.page,
        locationJson,
        chunk.text,
        chunkHash,
        chunk.ordinal,
      );
      chunks.push({
        id: chunkId,
        bookId: id,
        chapter: chunk.chapter,
        page: chunk.page,
        location: chunk.location,
        text: chunk.text,
        contentHash: chunkHash,
        ordinal: chunk.ordinal,
      });
    }
    return {
      id,
      title: parsed.title,
      author: parsed.author,
      format: parsed.format,
      filePath: storedPath,
      contentHash,
      parseStatus: PARSE_STATUS_PARSED,
      chunks,
    } satisfies ImportedBook;
  });
}

export function parseSource(format: BookFormat, buffer: Buffer): ParsedBook {
  if (format === "pdf") {
    return parseTextPdf(buffer);
  }
  if (format === "epub") {
    return parseEpub(buffer);
  }
  throw new Error(`VERT-001 import slice accepts licensed PDF and EPUB; ${format} is out of scope`);
}

export function loadBook(db: DatabaseSync, bookId: string): ImportedBook {
  const row = db
    .prepare(
      `SELECT id, title, author, format, file_path, content_hash, parse_status FROM books WHERE id = ?`,
    )
    .get(bookId) as
    | {
        id: string;
        title: string;
        author: string | null;
        format: BookFormat;
        file_path: string;
        content_hash: string;
        parse_status: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`Book not found: ${bookId}`);
  }
  const chunkRows = db
    .prepare(
      `SELECT id, book_id, chapter, page, location_json, text, content_hash, ordinal
       FROM source_chunks WHERE book_id = ? ORDER BY ordinal, rowid`,
    )
    .all(bookId) as Array<{
    id: string;
    book_id: string;
    chapter: string | null;
    page: number | null;
    location_json: string;
    text: string;
    content_hash: string;
    ordinal: number;
  }>;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format,
    filePath: row.file_path,
    contentHash: row.content_hash,
    parseStatus: row.parse_status,
    chunks: chunkRows.map((chunk) => ({
      id: chunk.id,
      bookId: chunk.book_id,
      chapter: chunk.chapter,
      page: chunk.page,
      location: JSON.parse(chunk.location_json) as SourceLocation,
      text: chunk.text,
      contentHash: chunk.content_hash,
      ordinal: chunk.ordinal,
    })),
  };
}

export function findChunkByParagraphId(
  book: ImportedBook,
  paragraphId: string,
): ImportedChunk {
  const normalized = paragraphId.replace(/^\[/, "").replace(/\]$/, "");
  const found = book.chunks.find(
    (chunk) => chunk.location.paragraphId === normalized || chunk.location.paragraphId === paragraphId,
  );
  if (!found) {
    throw new Error(`Paragraph ${paragraphId} was not located in book ${book.id}`);
  }
  return found;
}

export function locateHighlight(book: ImportedBook, snippet: string): ImportedChunk {
  const found = chooseHighlightMatch(book.chunks, snippet);
  if (!found) {
    throw new Error(`No source chunk matches highlight: ${snippet}`);
  }
  return found;
}

function storeOriginal(dataDir: string, bookId: string, sourcePath: string, buffer: Buffer): string {
  const directory = path.join(dataDir, "library", bookId);
  fs.mkdirSync(directory, { recursive: true });
  const target = path.join(directory, path.basename(sourcePath));
  fs.copyFileSync(sourcePath, target);
  if (!fs.existsSync(target) || fs.readFileSync(target).length !== buffer.length) {
    throw new Error(`Failed to copy source file into the BookSkill library at ${target}`);
  }
  return target;
}
