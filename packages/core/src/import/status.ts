import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PARSE_STATUS_FAILED } from "../constants.ts";
import type { BookFormat } from "../types.ts";

export const IMPORT_STATUS_FILENAME = "import-status.json";

export class ImportParseError extends Error {
  readonly bookId: string;
  readonly format?: string;

  constructor(options: { bookId: string; message: string; format?: string; cause?: unknown }) {
    super(options.message, { cause: options.cause });
    this.name = "ImportParseError";
    this.bookId = options.bookId;
    this.format = options.format;
  }
}

export type ImportStatusSidecar = {
  parseStatus: string;
  error: string | null;
  updatedAt: string;
  retryCount: number;
};

export type ImportStatus = ImportStatusSidecar & {
  bookId: string;
};

export type FailedImportRecord = ImportStatus & {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  filePath: string;
  contentHash: string;
};

export function importStatusPath(dataDir: string, bookId: string): string {
  return path.join(dataDir, "library", bookId, IMPORT_STATUS_FILENAME);
}

export function writeImportStatus(
  dataDir: string,
  bookId: string,
  status: ImportStatusSidecar,
): void {
  const directory = path.join(dataDir, "library", bookId);
  fs.mkdirSync(directory, { recursive: true });
  const target = importStatusPath(dataDir, bookId);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(status, null, 2)}\n`, "utf8");
  fs.renameSync(temp, target);
}

export function readImportStatusSidecar(
  dataDir: string,
  bookId: string,
): ImportStatusSidecar | null {
  const target = importStatusPath(dataDir, bookId);
  if (!fs.existsSync(target)) {
    return null;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(target, "utf8")) as Partial<ImportStatusSidecar>;
    if (!raw || typeof raw !== "object") {
      return null;
    }
    return {
      parseStatus: typeof raw.parseStatus === "string" ? raw.parseStatus : PARSE_STATUS_FAILED,
      error: typeof raw.error === "string" ? raw.error : raw.error === null ? null : null,
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : "",
      retryCount: typeof raw.retryCount === "number" && Number.isFinite(raw.retryCount) ? raw.retryCount : 0,
    };
  } catch {
    return null;
  }
}

export type LoadImportStatusOptions = {
  db: DatabaseSync;
  dataDir: string;
  bookId: string;
};

export function loadImportStatus(options: LoadImportStatusOptions): ImportStatus {
  const row = loadBookStatusRow(options.db, options.bookId);
  if (!row) {
    throw new Error(`Book not found: ${options.bookId}`);
  }
  return mergeStatus(options.dataDir, row);
}

export type ListFailedImportsOptions = {
  db: DatabaseSync;
  dataDir: string;
};

export function listFailedImports(options: ListFailedImportsOptions): FailedImportRecord[] {
  const rows = options.db
    .prepare(
      `SELECT id, title, author, format, file_path, content_hash, parse_status, updated_at
       FROM books WHERE parse_status = ? ORDER BY updated_at, id`,
    )
    .all(PARSE_STATUS_FAILED) as BookStatusRow[];
  return rows.map((row) => {
    const status = mergeStatus(options.dataDir, row);
    return {
      ...status,
      id: row.id,
      title: row.title,
      author: row.author,
      format: row.format,
      filePath: row.file_path,
      contentHash: row.content_hash,
    };
  });
}

type BookStatusRow = {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  file_path: string;
  content_hash: string;
  parse_status: string;
  updated_at: string;
};

function loadBookStatusRow(db: DatabaseSync, bookId: string): BookStatusRow | undefined {
  return db
    .prepare(
      `SELECT id, title, author, format, file_path, content_hash, parse_status, updated_at
       FROM books WHERE id = ?`,
    )
    .get(bookId) as BookStatusRow | undefined;
}

function mergeStatus(dataDir: string, row: BookStatusRow): ImportStatus {
  const sidecar = readImportStatusSidecar(dataDir, row.id);
  return {
    bookId: row.id,
    parseStatus: sidecar?.parseStatus ?? row.parse_status,
    error: sidecar?.error ?? null,
    updatedAt: sidecar?.updatedAt || row.updated_at,
    retryCount: sidecar?.retryCount ?? 0,
  };
}
