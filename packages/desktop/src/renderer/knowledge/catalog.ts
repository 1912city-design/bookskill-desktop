import type { DatabaseSync } from "node:sqlite";
import {
  deleteKnowledgeCard,
  listKnowledgeCards,
  loadBook,
  loadKnowledgeCard,
  type KnowledgeCardRecord,
} from "@bookskill/core";
import { listImportedBooks } from "../read/library.ts";
import type { BookLocatorProof, KnowledgeBookOption, KnowledgeCardView, KnowledgeSourceView } from "./types.ts";

type ChunkBookRow = {
  book_id: string;
  title: string;
};

export function enrichKnowledgeCard(db: DatabaseSync, card: KnowledgeCardRecord): KnowledgeCardView {
  const sources: KnowledgeSourceView[] = card.sources.map((source) => {
    const row = db
      .prepare(
        `SELECT sc.book_id, b.title
         FROM source_chunks sc
         JOIN books b ON b.id = sc.book_id
         WHERE sc.id = ?`,
      )
      .get(source.sourceChunkId) as ChunkBookRow | undefined;
    return {
      id: source.id,
      knowledgeCardId: source.knowledgeCardId,
      sourceChunkId: source.sourceChunkId,
      relationType: source.relationType,
      paragraphId: source.paragraphId,
      bookId: row?.book_id ?? null,
      bookTitle: row?.title ?? null,
    };
  });
  return {
    id: card.id,
    title: card.title,
    type: card.type,
    content: card.content,
    conditions: card.conditions,
    limitations: card.limitations,
    status: card.status,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    sources,
  };
}

export function listKnowledgeCardViews(db: DatabaseSync): KnowledgeCardView[] {
  return listKnowledgeCards(db).map((card) => enrichKnowledgeCard(db, card));
}

export function listKnowledgeBooks(db: DatabaseSync): KnowledgeBookOption[] {
  return listImportedBooks(db).map((book) => ({
    id: book.id,
    title: book.title,
    parseStatus: book.parseStatus,
  }));
}

export function verifyBookLocatorsRemain(
  db: DatabaseSync,
  sources: Array<{ bookId: string | null; sourceChunkId: string; paragraphId: string | null }>,
): BookLocatorProof[] {
  const proofs: BookLocatorProof[] = [];
  const seen = new Set<string>();
  for (const source of sources) {
    if (!source.bookId) {
      continue;
    }
    const key = `${source.bookId}:${source.sourceChunkId}:${source.paragraphId ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const book = loadBook(db, source.bookId);
    const chunkPresent = book.chunks.some((chunk) => chunk.id === source.sourceChunkId);
    const paragraphPresent = source.paragraphId
      ? book.chunks.some((chunk) => chunk.location.paragraphId === source.paragraphId)
      : chunkPresent;
    proofs.push({
      bookId: book.id,
      bookTitle: book.title,
      sourceChunkId: source.sourceChunkId,
      paragraphId: source.paragraphId,
      bookPresent: true,
      locatorUsable: chunkPresent && paragraphPresent,
    });
  }
  return proofs;
}

export function deleteKnowledgeCardAndKeepBooks(db: DatabaseSync, cardId: string): {
  deletedCardId: string;
  locatorProof: BookLocatorProof[];
} {
  const card = enrichKnowledgeCard(db, loadKnowledgeCard(db, cardId));
  deleteKnowledgeCard(db, cardId);
  return {
    deletedCardId: cardId,
    locatorProof: verifyBookLocatorsRemain(db, card.sources),
  };
}
