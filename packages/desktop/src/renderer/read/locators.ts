import { locateHighlight, UNCONFIRMED_LOCATION_LABEL, type ImportedBook } from "@bookskill/core";
import { randomUUID } from "node:crypto";
import type { CreateExcerptOptions, ReaderAnnotation, ReaderBook } from "./types.ts";

/**
 * Build an excerpt from a user selection.
 * Uses `@bookskill/core` `locateHighlight`. A missed match, or a match
 * whose `SourceLocation.confirmed` is false, is stored as unconfirmed
 * and never given a precise paragraph/page locator.
 */
export function createExcerptFromSelection(options: CreateExcerptOptions): ReaderAnnotation {
  const selectedText = options.selectedText.trim();
  if (!selectedText) {
    throw new Error("选区为空，无法生成摘录。");
  }

  const id = options.id ?? randomUUID();
  const createdAt = (options.now ?? new Date()).toISOString();
  const note = options.note?.trim() ?? "";
  const book = options.book;

  try {
    const chunk = locateHighlight(book as ImportedBook, selectedText);
    if (!chunk.location.confirmed) {
      return unconfirmedExcerpt({
        id,
        bookId: book.id,
        text: selectedText,
        note,
        createdAt,
        chunkId: chunk.id,
      });
    }
    return {
      id,
      bookId: book.id,
      kind: "excerpt",
      text: selectedText,
      note,
      chunkId: chunk.id,
      paragraphId: chunk.location.paragraphId,
      chapter: chunk.location.chapterTitle ?? chunk.chapter,
      page: chunk.location.page ?? chunk.page,
      confirmed: true,
      createdAt,
    };
  } catch {
    return unconfirmedExcerpt({
      id,
      bookId: book.id,
      text: selectedText,
      note,
      createdAt,
      chunkId: null,
    });
  }
}

function unconfirmedExcerpt(params: {
  id: string;
  bookId: string;
  text: string;
  note: string;
  createdAt: string;
  chunkId: string | null;
}): ReaderAnnotation {
  return {
    id: params.id,
    bookId: params.bookId,
    kind: "excerpt",
    text: params.text,
    note: params.note,
    chunkId: params.chunkId,
    paragraphId: null,
    chapter: null,
    page: null,
    confirmed: false,
    unconfirmedLabel: UNCONFIRMED_LOCATION_LABEL,
    createdAt: params.createdAt,
  };
}
