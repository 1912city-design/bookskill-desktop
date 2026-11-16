import type { ImportedBook } from "../types.ts";
import { enrichDistillationSources } from "./citations.ts";
import { distillationToMarkdown, parseDistillationMarkdown } from "./parse.ts";
import {
  DISTILL_TEMPLATE_ID,
  DistillationAdapterError,
  LOCKED_SECTION_TITLES,
  type Distillation,
  type DistillationSection,
  type LockedSectionId,
} from "./types.ts";
import { assertValidDistillation } from "./validate.ts";

export type DistillationSectionRequest = {
  template_id: typeof DISTILL_TEMPLATE_ID;
  sectionId: LockedSectionId;
  sectionTitle: (typeof LOCKED_SECTION_TITLES)[number];
  title: string;
  source_filename: string;
  sourceText: string;
  previousSections: DistillationSection[];
};

export type DistillationModelAdapter = {
  readonly configured: boolean;
  generateSection(request: DistillationSectionRequest): string | Promise<string>;
};

export type GenerateDistillationOptions = {
  adapter?: DistillationModelAdapter | null;
  title: string;
  source_filename: string;
  book_id?: string;
  book?: ImportedBook | null;
  sourceText?: string;
};

export async function generateDistillation(options: GenerateDistillationOptions): Promise<Distillation> {
  const adapter = options.adapter;
  if (!adapter || adapter.configured !== true) {
    throw new DistillationAdapterError(
      "adapter_unconfigured",
      "No configured distillation model adapter is available; refusing to pretend generation succeeded.",
    );
  }

  const sourceText = options.sourceText ?? (options.book ? sourceTextFromBook(options.book) : "");
  const previousSections: DistillationSection[] = [];
  const bodies: string[] = [];

  for (const [offset, sectionTitle] of LOCKED_SECTION_TITLES.entries()) {
    const sectionId = (offset + 1) as LockedSectionId;
    let raw: string;
    try {
      raw = await adapter.generateSection({
        template_id: DISTILL_TEMPLATE_ID,
        sectionId,
        sectionTitle,
        title: options.title,
        source_filename: options.source_filename,
        sourceText,
        previousSections: [...previousSections],
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DistillationAdapterError(
        "adapter_failed",
        `Adapter failed on section ${sectionId}. ${sectionTitle}: ${message}`,
      );
    }
    if (!raw || !raw.trim()) {
      throw new DistillationAdapterError(
        "adapter_failed",
        `Adapter returned an empty body for section ${sectionId}. ${sectionTitle}`,
      );
    }
    const body = normalizeGeneratedSection(raw, sectionId, sectionTitle);
    bodies.push(body);
    previousSections.push({
      id: sectionId,
      title: sectionTitle,
      content: stripSectionHeader(body, sectionId, sectionTitle),
      quotes: [],
      source: [],
    });
  }

  const markdown = [
    `# 《${options.title}》蒸馏结果`,
    "",
    `> 原文依据：\`${options.source_filename}\``,
    "",
    "---",
    "",
    ...bodies,
  ].join("\n");
  const parsed = parseDistillationMarkdown(markdown, {
    book_id: options.book_id ?? options.book?.id ?? "",
    title: options.title,
    source_filename: options.source_filename,
    template_id: DISTILL_TEMPLATE_ID,
  });
  return assertValidDistillation(enrichDistillationSources(parsed, options.book));
}

export function sourceTextFromBook(book: ImportedBook): string {
  return book.chunks
    .map((chunk) => {
      const locator =
        chunk.location.paragraphId && chunk.location.confirmed
          ? `[${chunk.location.paragraphId}]`
          : "[来源定位未确认]";
      const chapter = chunk.chapter ? ` ${chunk.chapter}` : "";
      return `${locator}${chapter}\n${chunk.text}`;
    })
    .join("\n\n");
}

function normalizeGeneratedSection(
  raw: string,
  id: LockedSectionId,
  title: (typeof LOCKED_SECTION_TITLES)[number],
): string {
  const trimmed = raw.trim();
  const header = new RegExp(`^##\\s+${id}\\.\\s+${escapeRegExp(title)}\\s*$`, "m");
  if (header.test(trimmed)) {
    return trimmed;
  }
  return `## ${id}. ${title}\n\n${trimmed}`;
}

function stripSectionHeader(raw: string, id: LockedSectionId, title: string): string {
  return raw.replace(new RegExp(`^##\\s+${id}\\.\\s+${escapeRegExp(title)}\\s*\\n+`), "").trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type { Distillation };
export { distillationToMarkdown };
