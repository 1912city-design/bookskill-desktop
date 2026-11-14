import type { DatabaseSync } from "node:sqlite";
import {
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  UNCONFIRMED_LOCATION_LABEL,
} from "../constants.ts";
import type { SourceLocation } from "../types.ts";
import {
  SEARCH_CONTENT_TYPE_AI_SUMMARY,
  SEARCH_CONTENT_TYPE_ORIGINAL,
  SEARCH_CONTENT_TYPE_USER_JUDGMENT,
  type SearchContentType,
  type SearchableRecord,
  type SearchSourceLocator,
} from "./types.ts";

type ChunkRow = {
  id: string;
  book_id: string;
  book_title: string;
  chapter: string | null;
  page: number | null;
  location_json: string | null;
  text: string;
};

type CardRow = {
  id: string;
  title: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  source_chunk_id: string | null;
  book_id: string | null;
  book_title: string | null;
  chapter: string | null;
  page: number | null;
  location_json: string | null;
};

type AnnotationRow = {
  id: string;
  type: string;
  body: string;
  source_chunk_id: string;
  book_id: string;
  book_title: string;
  chapter: string | null;
  page: number | null;
  location_json: string | null;
};

function parseLocation(raw: string | null): SourceLocation {
  if (!raw) {
    return {
      paragraphId: null,
      confirmed: false,
      chapterTitle: null,
      page: null,
      href: null,
      unconfirmedLabel: UNCONFIRMED_LOCATION_LABEL,
    };
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SourceLocation>;
    return {
      paragraphId: typeof parsed.paragraphId === "string" ? parsed.paragraphId : null,
      confirmed: parsed.confirmed === true,
      chapterTitle: typeof parsed.chapterTitle === "string" ? parsed.chapterTitle : null,
      page: typeof parsed.page === "number" ? parsed.page : null,
      href: typeof parsed.href === "string" ? parsed.href : null,
      unconfirmedLabel: typeof parsed.unconfirmedLabel === "string" ? parsed.unconfirmedLabel : undefined,
    };
  } catch {
    return {
      paragraphId: null,
      confirmed: false,
      chapterTitle: null,
      page: null,
      href: null,
      unconfirmedLabel: UNCONFIRMED_LOCATION_LABEL,
    };
  }
}

export function formatSearchLocator(input: {
  confirmed: boolean;
  unconfirmedLabel?: string;
  chapter: string | null;
  chapterTitle?: string | null;
  page: number | null;
  paragraphId: string | null;
}): string {
  if (!input.confirmed) {
    return input.unconfirmedLabel?.trim() || UNCONFIRMED_LOCATION_LABEL;
  }
  if (input.paragraphId?.trim()) {
    return input.paragraphId.trim();
  }
  if (input.page != null) {
    return `第 ${input.page} 页`;
  }
  const chapter = input.chapterTitle ?? input.chapter;
  if (chapter?.trim()) {
    return chapter.trim();
  }
  return "已定位";
}

export function locatorFromChunkFields(row: {
  chapter: string | null;
  page: number | null;
  location_json: string | null;
  chunkId: string;
  bookId: string;
  bookTitle: string;
}): SearchSourceLocator {
  const location = parseLocation(row.location_json);
  const chapter = location.chapterTitle ?? row.chapter;
  const page = location.page ?? row.page;
  return {
    bookId: row.bookId,
    bookTitle: row.bookTitle,
    locator: formatSearchLocator({
      confirmed: location.confirmed,
      unconfirmedLabel: location.unconfirmedLabel,
      chapter,
      chapterTitle: location.chapterTitle,
      page,
      paragraphId: location.paragraphId,
    }),
    paragraphId: location.paragraphId,
    chapter,
    page,
    confirmed: location.confirmed,
    chunkId: row.chunkId,
  };
}

export function contentTypeForKnowledgeCard(status: string): SearchContentType {
  return status === KNOWLEDGE_CARD_STATUS_VERIFIED
    ? SEARCH_CONTENT_TYPE_USER_JUDGMENT
    : SEARCH_CONTENT_TYPE_AI_SUMMARY;
}

export function contentTypeForAnnotation(type: string): SearchContentType {
  const normalized = type.trim().toLowerCase();
  if (normalized === "excerpt" || normalized === "highlight" || normalized === "passage") {
    return SEARCH_CONTENT_TYPE_ORIGINAL;
  }
  return SEARCH_CONTENT_TYPE_USER_JUDGMENT;
}

/**
 * Read-only collection of searchable records from existing tables.
 * Does not create or query an FTS / vector table.
 */
export function collectSearchableRecords(db: DatabaseSync): SearchableRecord[] {
  const records: SearchableRecord[] = [];

  const chunks = db
    .prepare(
      `SELECT sc.id, sc.book_id, b.title AS book_title, sc.chapter, sc.page, sc.location_json, sc.text
       FROM source_chunks sc
       JOIN books b ON b.id = sc.book_id
       ORDER BY sc.book_id, sc.ordinal, sc.id`,
    )
    .all() as ChunkRow[];

  for (const chunk of chunks) {
    records.push({
      id: `source_chunk:${chunk.id}`,
      kind: "source_chunk",
      contentType: SEARCH_CONTENT_TYPE_ORIGINAL,
      title: chunk.book_title,
      text: chunk.text,
      source: locatorFromChunkFields({
        chapter: chunk.chapter,
        page: chunk.page,
        location_json: chunk.location_json,
        chunkId: chunk.id,
        bookId: chunk.book_id,
        bookTitle: chunk.book_title,
      }),
    });
  }

  const cards = db
    .prepare(
      `SELECT kc.id, kc.title, kc.content, kc.conditions, kc.limitations, kc.status,
              ks.source_chunk_id, sc.book_id, b.title AS book_title, sc.chapter, sc.page, sc.location_json
       FROM knowledge_cards kc
       LEFT JOIN knowledge_sources ks ON ks.knowledge_card_id = kc.id
       LEFT JOIN source_chunks sc ON sc.id = ks.source_chunk_id
       LEFT JOIN books b ON b.id = sc.book_id
       ORDER BY kc.id, ks.rowid`,
    )
    .all() as CardRow[];

  const seenCards = new Set<string>();
  for (const card of cards) {
    if (seenCards.has(card.id)) {
      continue;
    }
    seenCards.add(card.id);
    if (!card.book_id || !card.book_title || !card.source_chunk_id) {
      continue;
    }
    const parts = [card.title, card.content, card.conditions ?? "", card.limitations ?? ""];
    records.push({
      id: `knowledge_card:${card.id}`,
      kind: "knowledge_card",
      contentType: contentTypeForKnowledgeCard(card.status),
      title: card.title,
      text: parts.filter((part) => part.trim()).join("\n"),
      source: locatorFromChunkFields({
        chapter: card.chapter,
        page: card.page,
        location_json: card.location_json,
        chunkId: card.source_chunk_id,
        bookId: card.book_id,
        bookTitle: card.book_title,
      }),
    });
  }

  const annotations = db
    .prepare(
      `SELECT a.id, a.type, a.body, a.source_chunk_id, sc.book_id, b.title AS book_title,
              sc.chapter, sc.page, sc.location_json
       FROM annotations a
       JOIN source_chunks sc ON sc.id = a.source_chunk_id
       JOIN books b ON b.id = sc.book_id
       ORDER BY a.id`,
    )
    .all() as AnnotationRow[];

  for (const annotation of annotations) {
    records.push({
      id: `annotation:${annotation.id}`,
      kind: "annotation",
      contentType: contentTypeForAnnotation(annotation.type),
      title: annotation.type,
      text: annotation.body,
      source: locatorFromChunkFields({
        chapter: annotation.chapter,
        page: annotation.page,
        location_json: annotation.location_json,
        chunkId: annotation.source_chunk_id,
        bookId: annotation.book_id,
        bookTitle: annotation.book_title,
      }),
    });
  }

  return records;
}
