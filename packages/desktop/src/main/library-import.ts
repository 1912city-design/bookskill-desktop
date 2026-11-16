import { ImportParseError, importBook } from "@bookskill/core";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { listImportedBooks } from "../renderer/read/library.ts";
import type { LibraryBookSummary } from "../renderer/read/types.ts";

export const IMPORTABLE_EXTENSIONS = new Set([".pdf", ".epub", ".md", ".markdown", ".txt"]);

export type ImportLibraryBookOptions = {
  db: DatabaseSync;
  dataDir: string;
  filePath: string;
};

export type ImportLibraryBookResult = {
  book: LibraryBookSummary;
  books: LibraryBookSummary[];
};

export function validateImportPath(filePath: unknown): string {
  if (typeof filePath !== "string" || !filePath.trim()) {
    throw new Error("请选择要导入的文件。");
  }
  const absolute = path.resolve(filePath.trim());
  const ext = path.extname(absolute).toLowerCase();
  if (!IMPORTABLE_EXTENSIONS.has(ext)) {
    throw new Error("仅支持导入许可的 PDF、EPUB、Markdown 或 TXT。");
  }
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absolute);
  } catch {
    throw new Error(`找不到可导入的文件：${absolute}`);
  }
  if (!stat.isFile()) {
    throw new Error(`找不到可导入的文件：${absolute}`);
  }
  return absolute;
}

/**
 * Path-based import used by the main-process IPC handler and unit tests.
 * Does not open a GUI dialog.
 */
export function importLibraryBook(options: ImportLibraryBookOptions): ImportLibraryBookResult {
  const filePath = validateImportPath(options.filePath);
  try {
    const imported = importBook({
      db: options.db,
      dataDir: options.dataDir,
      filePath,
    });
    const books = listImportedBooks(options.db);
    const book =
      books.find((item) => item.id === imported.id) ?? {
        id: imported.id,
        title: imported.title,
        author: imported.author,
        format: imported.format,
        parseStatus: imported.parseStatus,
      };
    return { book, books };
  } catch (error) {
    if (error instanceof ImportParseError) {
      throw new Error(error.message);
    }
    throw error;
  }
}
