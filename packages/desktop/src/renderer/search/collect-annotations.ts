import type { DatabaseSync } from "node:sqlite";
import {
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
  formatSearchLocator,
  type SearchableRecord,
} from "@bookskill/core";
import { createAnnotationStore } from "../read/annotations.ts";
import { listImportedBooks } from "../read/library.ts";

/**
 * Turn file-backed excerpts and notes into searchable records.
 * Excerpt text is 原文; a non-empty user note is 用户判断.
 * Does not write annotation files.
 */
export function collectFileAnnotationRecords(db: DatabaseSync, dataDir: string): SearchableRecord[] {
  const books = listImportedBooks(db);
  const titles = new Map(books.map((book) => [book.id, book.title]));
  const store = createAnnotationStore(dataDir);
  const records: SearchableRecord[] = [];

  for (const book of books) {
    const annotations = store.load(book.id);
    const bookTitle = titles.get(book.id) ?? book.title;
    for (const annotation of annotations) {
      const source = {
        bookId: annotation.bookId,
        bookTitle,
        locator: formatSearchLocator({
          confirmed: annotation.confirmed,
          unconfirmedLabel: annotation.unconfirmedLabel,
          chapter: annotation.chapter,
          page: annotation.page,
          paragraphId: annotation.paragraphId,
        }),
        paragraphId: annotation.paragraphId,
        chapter: annotation.chapter,
        page: annotation.page,
        confirmed: annotation.confirmed,
        chunkId: annotation.chunkId,
      };
      records.push({
        id: `excerpt:${annotation.id}`,
        kind: "excerpt",
        contentType: SEARCH_CONTENT_TYPE_ORIGINAL,
        title: "摘录",
        text: annotation.text,
        source,
      });
      if (annotation.note.trim()) {
        records.push({
          id: `annotation_note:${annotation.id}`,
          kind: "annotation",
          contentType: SEARCH_CONTENT_TYPE_USER_JUDGMENT,
          title: "批注",
          text: annotation.note,
          source,
        });
      }
    }
  }
  return records;
}
