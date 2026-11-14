import type { JumpResult, ReaderAnnotation, ReaderBook } from "./types.ts";

/**
 * Renderer-safe locator copy. Must stay identical to
 * `@bookskill/core` `UNCONFIRMED_LOCATION_LABEL`.
 */

export const READER_UNCONFIRMED_LOCATION_LABEL = "来源定位未确认";

export type LocatorInput = {
  confirmed: boolean;
  unconfirmedLabel?: string;
  chapter?: string | null;
  chapterTitle?: string | null;
  page?: number | null;
  paragraphId?: string | null;
};

/**
 * Confirmed sources may show chapter / page / paragraph.
 * Unconfirmed sources only show the contract label and must never
 * be presented as a precise locator.
 */
export function formatLocatorLabel(input: LocatorInput): string {
  if (!input.confirmed) {
    return input.unconfirmedLabel?.trim() || READER_UNCONFIRMED_LOCATION_LABEL;
  }
  const parts: string[] = [];
  const chapter = input.chapterTitle ?? input.chapter ?? null;
  if (chapter) {
    parts.push(chapter);
  }
  if (input.page != null) {
    parts.push(`第 ${input.page} 页`);
  }
  if (input.paragraphId) {
    parts.push(input.paragraphId);
  }
  return parts.join(" · ") || "已定位";
}

export function formatBookFormat(format: string): string {
  switch (format) {
    case "epub":
      return "EPUB";
    case "pdf":
      return "PDF";
    case "markdown":
      return "Markdown";
    case "txt":
      return "TXT";
    default:
      return format.toUpperCase();
  }
}

export function formatParseStatus(status: string): string {
  if (status === "parsed") {
    return "已解析";
  }
  if (status === "failed") {
    return "导入失败";
  }
  return status;
}

export function locatorFromChunk(chunk: {
  chapter: string | null;
  page: number | null;
  location: {
    confirmed: boolean;
    unconfirmedLabel?: string;
    chapterTitle: string | null;
    page: number | null;
    paragraphId: string | null;
  };
}): LocatorInput {
  return {
    confirmed: chunk.location.confirmed,
    unconfirmedLabel: chunk.location.unconfirmedLabel,
    chapter: chunk.chapter,
    chapterTitle: chunk.location.chapterTitle,
    page: chunk.location.page ?? chunk.page,
    paragraphId: chunk.location.paragraphId,
  };
}

export function locatorFromAnnotation(annotation: {
  confirmed: boolean;
  unconfirmedLabel?: string;
  chapter: string | null;
  page: number | null;
  paragraphId: string | null;
}): LocatorInput {
  return {
    confirmed: annotation.confirmed,
    unconfirmedLabel: annotation.unconfirmedLabel,
    chapter: annotation.chapter,
    page: annotation.page,
    paragraphId: annotation.paragraphId,
  };
}

/**
 * Jump back to a confirmed excerpt's original chunk.
 * Unconfirmed excerpts must not be treated as a precise location.
 */
export function jumpToAnnotation(book: ReaderBook, annotation: ReaderAnnotation): JumpResult {
  const unconfirmed: JumpResult = {
    focusedChunkId: null,
    confirmed: false,
    message: annotation.unconfirmedLabel ?? READER_UNCONFIRMED_LOCATION_LABEL,
  };

  if (!annotation.confirmed || !annotation.chunkId) {
    return unconfirmed;
  }

  const chunk = book.chunks.find((entry) => entry.id === annotation.chunkId);
  if (!chunk || !chunk.location.confirmed) {
    return unconfirmed;
  }

  return {
    focusedChunkId: chunk.id,
    confirmed: true,
    message: null,
  };
}
