import type { DatabaseSync } from "node:sqlite";
import { searchLibrary, type SearchMode, type SearchResult } from "@bookskill/core";
import { collectFileAnnotationRecords } from "./collect-annotations.ts";

export type DesktopSearchOptions = {
  db: DatabaseSync;
  dataDir: string;
  query: string;
  mode?: SearchMode;
  limit?: number;
};

/**
 * Search already-imported books, knowledge cards, database annotation rows,
 * and file-backed excerpts / notes. Read-only.
 * Reuses the core in-process rebuildable index (warmed after the first query
 * in the same process when the business DB and file extras have not changed).
 */
export function searchDesktopLibrary(options: DesktopSearchOptions): SearchResult {
  return searchLibrary({
    db: options.db,
    extraRecords: collectFileAnnotationRecords(options.db, options.dataDir),
    query: options.query,
    mode: options.mode,
    limit: options.limit,
  });
}
