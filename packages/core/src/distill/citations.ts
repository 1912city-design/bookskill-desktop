import path from "node:path";
import { locateHighlight } from "../import-book.ts";
import type { ImportedBook } from "../types.ts";
import { UNCONFIRMED_DISTILL_LOCATION_LABEL, type Distillation, type DistillationConversationAttachment, type DistillationSourceRef, type StoredDistillation } from "./types.ts";
import { sourcesFromQuotes } from "./parse.ts";

export function enrichDistillationSources(distillation: Distillation, book?: ImportedBook | null): Distillation {
  const sourceFilename = distillation.source_filename || (book ? filenameFromBook(book) : "");
  return {
    ...distillation,
    source_filename: sourceFilename || distillation.source_filename,
    sections: distillation.sections.map((section) => {
      const baseline = section.source.length > 0 ? section.source : sourcesFromQuotes(section.quotes, sourceFilename);
      return {
        ...section,
        source: baseline.map((ref) => resolveSourceRef({ ...ref, source_filename: ref.source_filename || sourceFilename }, book)),
      };
    }),
  };
}

export function collectDistillationCitations(distillation: Distillation): DistillationSourceRef[] {
  const citations: DistillationSourceRef[] = [];
  const seen = new Set<string>();
  for (const section of distillation.sections) {
    for (const ref of section.source) {
      const key = `${ref.source_filename}|${ref.paragraph_id ?? ""}|${ref.quote ?? ""}|${ref.confirmed}`;
      if (seen.has(key)) continue;
      seen.add(key);
      citations.push(ref);
    }
  }
  if (citations.length === 0 && distillation.source_filename) {
    citations.push({
      source_filename: distillation.source_filename,
      paragraph_id: null,
      confirmed: false,
      unconfirmedLabel: UNCONFIRMED_DISTILL_LOCATION_LABEL,
    });
  }
  return citations;
}

export function buildDistillationConversationAttachment(
  distillation: Distillation | StoredDistillation,
): DistillationConversationAttachment {
  return {
    kind: "distillation",
    distillation_id: "id" in distillation ? distillation.id : undefined,
    title: distillation.title,
    book_id: distillation.book_id,
    template_id: distillation.template_id,
    source_filename: distillation.source_filename,
    citations: collectDistillationCitations(distillation),
  };
}

function resolveSourceRef(ref: DistillationSourceRef, book?: ImportedBook | null): DistillationSourceRef {
  if (!book || !ref.quote) {
    return unconfirmed(ref);
  }
  try {
    const chunk = locateHighlight(book, stripQuoteMarks(ref.quote));
    const paragraphId = chunk.location.paragraphId;
    if (chunk.location.confirmed && paragraphId) {
      return {
        ...ref,
        paragraph_id: paragraphId,
        confirmed: true,
        chapterTitle: ref.chapterTitle ?? chunk.chapter ?? chunk.location.chapterTitle,
        unconfirmedLabel: undefined,
      };
    }
    return {
      ...unconfirmed(ref),
      paragraph_id: paragraphId,
      chapterTitle: ref.chapterTitle ?? chunk.chapter ?? chunk.location.chapterTitle,
    };
  } catch {
    return unconfirmed(ref);
  }
}

function unconfirmed(ref: DistillationSourceRef): DistillationSourceRef {
  return {
    ...ref,
    confirmed: false,
    paragraph_id: ref.paragraph_id ?? null,
    unconfirmedLabel: ref.unconfirmedLabel ?? UNCONFIRMED_DISTILL_LOCATION_LABEL,
  };
}

function stripQuoteMarks(text: string): string {
  return text.replace(/^[「「""']|[」」""']$/g, "").trim();
}

function filenameFromBook(book: ImportedBook): string {
  return path.basename(book.filePath);
}
