import type { DatabaseSync } from "node:sqlite";
import type { LibraryBookSummary } from "./types.ts";

type BookRow = {
  id: string;
  title: string;
  author: string | null;
  format: string;
  parse_status: string;
};

/**
 * Read-only listing of imported books from the already-opened workspace db.
 * Does not add APIs to `@bookskill/core`.
 */
export function listImportedBooks(db: DatabaseSync): LibraryBookSummary[] {
  const rows = db
    .prepare(
      `SELECT id, title, author, format, parse_status
       FROM books
       ORDER BY title COLLATE NOCASE, id`,
    )
    .all() as BookRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    author: row.author,
    format: row.format,
    parseStatus: row.parse_status,
  }));
}
