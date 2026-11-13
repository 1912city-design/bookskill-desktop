import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PARSE_STATUS_FAILED, PARSE_STATUS_PARSED } from "./constants.ts";
import { parseMarkdown } from "./import/parse-markdown.ts";
import { parseTxt } from "./import/parse-txt.ts";
import { ImportParseError, readImportStatusSidecar, writeImportStatus } from "./import/status.ts";
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

export type RetryImportOptions = {
  db: DatabaseSync;
  dataDir: string;
  bookId: string;
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

  const existingId = findBookIdByContentHash(options.db, contentHash);
  if (existingId) {
    return loadBook(options.db, existingId);
  }

  const stamp = nowIso(options.now);
  const id = newId();
  const storedPath = storeOriginal(options.dataDir, id, absolute, buffer);

  let parsed: ParsedBook;
  try {
    parsed = parseSource(format, buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    persistFailedBook({
      db: options.db,
      dataDir: options.dataDir,
      id,
      title: path.basename(absolute),
      format,
      storedPath,
      contentHash,
      stamp,
      error: message,
      retryCount: 0,
    });
    throw new ImportParseError({
      bookId: id,
      format,
      message: `Failed to parse ${format}: ${message}`,
      cause: error,
    });
  }

  return withTransaction(options.db, () =>
    insertParsedBook(options.db, {
      id,
      parsed,
      storedPath,
      contentHash,
      createdAt: stamp,
      updatedAt: stamp,
    }),
  );
}

export function retryImport(options: RetryImportOptions): ImportedBook {
  const row = loadBookRow(options.db, options.bookId);
  if (!row) {
    throw new Error(`Book not found: ${options.bookId}`);
  }
  if (row.parse_status === PARSE_STATUS_PARSED) {
    return loadBook(options.db, options.bookId);
  }

  const stamp = nowIso(options.now);
  const previous = readImportStatusSidecar(options.dataDir, options.bookId);
  const retryCount = (previous?.retryCount ?? 0) + 1;
  const storedPath = row.file_path;

  if (!fs.existsSync(storedPath)) {
    const message = `Stored original is missing: ${storedPath}`;
    persistRetryFailure({
      db: options.db,
      dataDir: options.dataDir,
      bookId: options.bookId,
      stamp,
      error: message,
      retryCount,
    });
    throw new ImportParseError({
      bookId: options.bookId,
      format: row.format,
      message: `Failed to parse ${row.format}: ${message}`,
    });
  }

  const buffer = fs.readFileSync(storedPath);
  const format = detectFormat(storedPath);
  const contentHash = sha256(buffer);

  let parsed: ParsedBook;
  try {
    parsed = parseSource(format, buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    persistRetryFailure({
      db: options.db,
      dataDir: options.dataDir,
      bookId: options.bookId,
      stamp,
      error: message,
      retryCount,
    });
    throw new ImportParseError({
      bookId: options.bookId,
      format,
      message: `Failed to parse ${format}: ${message}`,
      cause: error,
    });
  }

  const imported = withTransaction(options.db, () =>
    replaceParsedBook(options.db, {
      id: options.bookId,
      parsed,
      storedPath,
      contentHash,
      updatedAt: stamp,
    }),
  );
  writeImportStatus(options.dataDir, options.bookId, {
    parseStatus: PARSE_STATUS_PARSED,
    error: null,
    updatedAt: stamp,
    retryCount,
  });
  return imported;
}

export function parseSource(format: BookFormat, buffer: Buffer): ParsedBook {
  if (format === "pdf") {
    return parseTextPdf(buffer);
  }
  if (format === "epub") {
    return parseEpub(buffer);
  }
  if (format === "markdown") {
    return parseMarkdown(buffer);
  }
  if (format === "txt") {
    return parseTxt(buffer);
  }
  throw new Error(`Unsupported source format: ${format}`);
}

export function loadBook(db: DatabaseSync, bookId: string): ImportedBook {
  const row = loadBookRow(db, bookId);
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

function findBookIdByContentHash(db: DatabaseSync, contentHash: string): string | undefined {
  const row = db
    .prepare(`SELECT id FROM books WHERE content_hash = ? ORDER BY created_at, id`)
    .get(contentHash) as { id: string } | undefined;
  return row?.id;
}

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  file_path: string;
  content_hash: string;
  parse_status: string;
};

function loadBookRow(db: DatabaseSync, bookId: string): BookRow | undefined {
  return db
    .prepare(
      `SELECT id, title, author, format, file_path, content_hash, parse_status FROM books WHERE id = ?`,
    )
    .get(bookId) as BookRow | undefined;
}

function insertParsedBook(
  db: DatabaseSync,
  params: {
    id: string;
    parsed: ParsedBook;
    storedPath: string;
    contentHash: string;
    createdAt: string;
    updatedAt: string;
  },
): ImportedBook {
  db.prepare(
    `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    params.id,
    params.parsed.title,
    params.parsed.author,
    params.parsed.format,
    params.storedPath,
    params.contentHash,
    PARSE_STATUS_PARSED,
    params.createdAt,
    params.updatedAt,
  );
  const chunks = insertChunks(db, params.id, params.parsed);
  return toImportedBook(params.id, params.parsed, params.storedPath, params.contentHash, chunks);
}

function replaceParsedBook(
  db: DatabaseSync,
  params: {
    id: string;
    parsed: ParsedBook;
    storedPath: string;
    contentHash: string;
    updatedAt: string;
  },
): ImportedBook {
  db.prepare(`DELETE FROM source_chunks WHERE book_id = ?`).run(params.id);
  db.prepare(
    `UPDATE books
     SET title = ?, author = ?, format = ?, file_path = ?, content_hash = ?, parse_status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    params.parsed.title,
    params.parsed.author,
    params.parsed.format,
    params.storedPath,
    params.contentHash,
    PARSE_STATUS_PARSED,
    params.updatedAt,
    params.id,
  );
  const chunks = insertChunks(db, params.id, params.parsed);
  return toImportedBook(params.id, params.parsed, params.storedPath, params.contentHash, chunks);
}

function insertChunks(db: DatabaseSync, bookId: string, parsed: ParsedBook): ImportedChunk[] {
  const chunks: ImportedChunk[] = [];
  const insert = db.prepare(
    `INSERT INTO source_chunks(id, book_id, chapter, page, location_json, text, content_hash, ordinal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const chunk of parsed.chunks) {
    const chunkId = newId();
    const locationJson = JSON.stringify(chunk.location);
    const chunkHash = sha256(chunk.text);
    insert.run(
      chunkId,
      bookId,
      chunk.chapter,
      chunk.page,
      locationJson,
      chunk.text,
      chunkHash,
      chunk.ordinal,
    );
    chunks.push({
      id: chunkId,
      bookId,
      chapter: chunk.chapter,
      page: chunk.page,
      location: chunk.location,
      text: chunk.text,
      contentHash: chunkHash,
      ordinal: chunk.ordinal,
    });
  }
  return chunks;
}

function toImportedBook(
  id: string,
  parsed: ParsedBook,
  storedPath: string,
  contentHash: string,
  chunks: ImportedChunk[],
): ImportedBook {
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
}

function persistFailedBook(params: {
  db: DatabaseSync;
  dataDir: string;
  id: string;
  title: string;
  format: BookFormat;
  storedPath: string;
  contentHash: string;
  stamp: string;
  error: string;
  retryCount: number;
}): void {
  withTransaction(params.db, () => {
    params.db
      .prepare(
        `INSERT INTO books(id, title, author, format, file_path, content_hash, parse_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        params.id,
        params.title,
        null,
        params.format,
        params.storedPath,
        params.contentHash,
        PARSE_STATUS_FAILED,
        params.stamp,
        params.stamp,
      );
  });
  writeImportStatus(params.dataDir, params.id, {
    parseStatus: PARSE_STATUS_FAILED,
    error: params.error,
    updatedAt: params.stamp,
    retryCount: params.retryCount,
  });
}

function persistRetryFailure(params: {
  db: DatabaseSync;
  dataDir: string;
  bookId: string;
  stamp: string;
  error: string;
  retryCount: number;
}): void {
  withTransaction(params.db, () => {
    params.db.prepare(`UPDATE books SET updated_at = ? WHERE id = ?`).run(params.stamp, params.bookId);
  });
  writeImportStatus(params.dataDir, params.bookId, {
    parseStatus: PARSE_STATUS_FAILED,
    error: params.error,
    updatedAt: params.stamp,
    retryCount: params.retryCount,
  });
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
