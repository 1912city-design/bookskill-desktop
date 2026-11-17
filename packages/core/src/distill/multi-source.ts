import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  createFixtureCouncilAdapter,
  ensureSourceFilenameInContent,
  parseCouncilDistillMarkdown,
  validateCouncilCitations,
  type CouncilAdapter,
  type CouncilCitation,
  type CouncilUtterance,
} from "../council/index.ts";
import { generateDistillation, type DistillationModelAdapter } from "./generate.ts";
import { distillationToMarkdown, parseDistillationMarkdown } from "./parse.ts";
import { importDistillation, type ImportDistillationResult } from "./store.ts";
import { DistillationValidationError, type Distillation } from "./types.ts";

export const TEXT_SOURCE_KINDS = ["interview", "text"] as const;
export type TextSourceKind = (typeof TEXT_SOURCE_KINDS)[number];

export function isTextSourceKind(value: string): value is TextSourceKind {
  return (TEXT_SOURCE_KINDS as readonly string[]).includes(value);
}

export type InterviewOrTextSource = {
  kind: TextSourceKind;
  title: string;
  source_filename: string;
  text: string;
  source_id?: string;
};

export type ImportInterviewOrTextOptions = {
  db: DatabaseSync;
  dataDir: string;
  source: InterviewOrTextSource;
  markdown?: string;
  distillation?: Distillation;
  adapter?: DistillationModelAdapter | null;
  now?: Date;
};

export type ImportInterviewOrTextResult = ImportDistillationResult & {
  source_kind: TextSourceKind;
};

/**
 * Import a licensed or synthetic interview/text (not a book-only pipeline)
 * and run it through the locked 5-segment DISTILL-001 pipeline, producing
 * a complete distillation plus draft Skills.
 */
export async function importInterviewOrText(
  options: ImportInterviewOrTextOptions,
): Promise<ImportInterviewOrTextResult> {
  const source = normalizeSource(options.source);
  const distillation = await resolveDistillation(source, options);
  const imported = importDistillation({
    db: options.db,
    dataDir: options.dataDir,
    distillation,
    book_id: source.source_id ?? distillation.book_id,
    title: source.title,
    source_filename: source.source_filename,
    now: options.now,
  });
  return { ...imported, source_kind: source.kind };
}

export type CiteImportedSourceWithCouncilOptions = {
  distillation: Distillation;
  markdown?: string;
  question: string;
  adapter?: CouncilAdapter;
};

export type ImportedSourceCouncilCitationResult = {
  source_filename: string;
  question: string;
  content: string;
  citations: CouncilCitation[];
  utterance: CouncilUtterance;
};

/**
 * Ask the council citation path to speak about an imported interview/text
 * distillation. Uses only COUNCIL-001 public APIs; does not create a fourth
 * fixed seat or rewrite council source behavior.
 *
 * The visible `source_filename` is the imported interview/text filename
 * stored on the distillation, and it appears on the utterance, each
 * citation, and in the reply content.
 */
export function citeImportedSourceWithCouncil(
  options: CiteImportedSourceWithCouncilOptions,
): ImportedSourceCouncilCitationResult {
  const sourceFilename = options.distillation.source_filename.trim();
  if (!sourceFilename) {
    throw new DistillationValidationError(["source_filename is required for council citation"]);
  }
  const question = options.question.trim();
  if (!question) {
    throw new Error("Council question must not be empty");
  }
  const markdown = options.markdown?.trim() ? options.markdown : distillationToMarkdown(options.distillation);
  const parsed = parseCouncilDistillMarkdown(markdown, sourceFilename);
  const adapter = options.adapter ?? createFixtureCouncilAdapter();
  const reply = adapter({
    seat: null,
    question,
    sources: [parsed],
    priorUtterances: [],
    role: "seat",
  });
  validateCouncilCitations(reply.citations, [parsed]);
  const citations: CouncilCitation[] = reply.citations.map((item) => ({
    quote: item.quote,
    source_filename: item.source_filename,
    attribution: item.attribution,
  }));
  const content = ensureSourceFilenameInContent(reply.content, sourceFilename);
  const speaker = options.distillation.title.trim() || parsed.bookTitle;
  const utterance: CouncilUtterance = {
    kind: "seat",
    seat_id: null,
    speaker,
    content,
    source_filename: sourceFilename,
    citations: citations.map((item) => ({ ...item })),
  };
  return {
    source_filename: sourceFilename,
    question,
    content,
    citations,
    utterance,
  };
}

function normalizeSource(source: InterviewOrTextSource): InterviewOrTextSource {
  if (!isTextSourceKind(source.kind)) {
    throw new DistillationValidationError([`source kind must be interview or text, found “${String(source.kind)}”`]);
  }
  const title = source.title.trim();
  const sourceFilename = path.basename(source.source_filename.trim().replaceAll("\\", "/"));
  const text = source.text.trim();
  const issues: string[] = [];
  if (!title) {
    issues.push("interview/text title is required");
  }
  if (!sourceFilename) {
    issues.push("interview/text source_filename is required");
  }
  if (!text) {
    issues.push("interview/text source text is required");
  }
  if (issues.length > 0) {
    throw new DistillationValidationError(issues);
  }
  const sourceId = source.source_id?.trim();
  return {
    kind: source.kind,
    title,
    source_filename: sourceFilename,
    text,
    source_id: sourceId ? sourceId : undefined,
  };
}

async function resolveDistillation(
  source: InterviewOrTextSource,
  options: ImportInterviewOrTextOptions,
): Promise<Distillation> {
  if (options.distillation) {
    return applySourceIdentity(options.distillation, source);
  }
  if (options.markdown && options.markdown.trim()) {
    return applySourceIdentity(
      parseDistillationMarkdown(options.markdown, {
        book_id: source.source_id ?? "",
        title: source.title,
        source_filename: source.source_filename,
      }),
      source,
    );
  }
  return applySourceIdentity(
    await generateDistillation({
      adapter: options.adapter,
      title: source.title,
      source_filename: source.source_filename,
      book_id: source.source_id ?? "",
      sourceText: source.text,
    }),
    source,
  );
}

function applySourceIdentity(distillation: Distillation, source: InterviewOrTextSource): Distillation {
  return {
    ...distillation,
    title: source.title,
    source_filename: source.source_filename,
    book_id: source.source_id ?? distillation.book_id,
  };
}
