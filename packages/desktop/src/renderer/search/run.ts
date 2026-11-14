import type { DatabaseSync } from "node:sqlite";
import { collectSearchableRecords, searchRecords, type SearchMode, type SearchResult } from "@bookskill/core";
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
 */
export function searchDesktopLibrary(options: DesktopSearchOptions): SearchResult {
  const records = [
    ...collectSearchableRecords(options.db),
    ...collectFileAnnotationRecords(options.db, options.dataDir),
  ];
  return searchRecords(records, {
    query: options.query,
    mode: options.mode,
    limit: options.limit,
  });
}
