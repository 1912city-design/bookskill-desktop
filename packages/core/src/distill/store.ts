import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { newId, nowIso } from "../util.ts";
import type { ImportedBook } from "../types.ts";
import { enrichDistillationSources, buildDistillationConversationAttachment } from "./citations.ts";
import { distillationToJson, distillationToMarkdown, parseDistillationJson, parseDistillationMarkdown } from "./parse.ts";
import { createDraftSkillsFromDistillation, type CreatedDraftSkill } from "./skills.ts";
import type { Distillation, DistillationConversationAttachment, StoredDistillation } from "./types.ts";
import { DistillationValidationError } from "./types.ts";
import { assertValidDistillation } from "./validate.ts";

export const DISTILL_DIRNAME = "distill";

export type ImportDistillationOptions = {
  db: DatabaseSync;
  dataDir: string;
  markdown?: string;
  distillation?: Distillation;
  book?: ImportedBook | null;
  book_id?: string;
  source_filename?: string;
  title?: string;
  now?: Date;
};

export type ImportDistillationResult = {
  distillation: StoredDistillation;
  skills: CreatedDraftSkill[];
  attachment: DistillationConversationAttachment;
};

export function distillationsDir(dataDir: string): string {
  return path.join(dataDir, DISTILL_DIRNAME);
}

export function importDistillation(options: ImportDistillationOptions): ImportDistillationResult {
  const parsed = options.distillation
    ? options.distillation
    : parseDistillationMarkdown(requiredMarkdown(options.markdown), {
        book_id: options.book_id ?? options.book?.id,
        title: options.title,
        source_filename: options.source_filename,
      });

  const withIds: Distillation = {
    ...parsed,
    book_id: options.book_id ?? options.book?.id ?? parsed.book_id,
    title: options.title ?? parsed.title,
    source_filename: options.source_filename ?? parsed.source_filename ?? filenameFromBook(options.book),
  };
  const enriched = enrichDistillationSources(withIds, options.book);
  const validated = assertValidDistillation(enriched);

  const skillCountBefore = countSkills(options.db);
  let created: CreatedDraftSkill[] = [];
  try {
    created = createDraftSkillsFromDistillation({
      db: options.db,
      distillation: validated,
      now: options.now,
    });
  } catch (error) {
    if (countSkills(options.db) !== skillCountBefore) {
      throw new Error("Skill writes escaped a failed distillation import");
    }
    throw error;
  }

  const id = newId();
  const createdAt = nowIso(options.now);
  const directory = path.join(distillationsDir(options.dataDir), id);
  fs.mkdirSync(directory, { recursive: true });
  const jsonPath = path.join(directory, "result.json");
  const markdownPath = path.join(directory, "result.md");
  const stored: StoredDistillation = {
    ...validated,
    id,
    skill_ids: created.map((item) => item.skill.id),
    created_at: createdAt,
    markdown_path: markdownPath,
    json_path: jsonPath,
  };

  fs.writeFileSync(jsonPath, distillationToJson(stored), "utf8");
  fs.writeFileSync(markdownPath, distillationToMarkdown(stored), "utf8");
  fs.writeFileSync(path.join(directory, "manifest.json"), `${JSON.stringify(toManifest(stored), null, 2)}
`, "utf8");

  return {
    distillation: stored,
    skills: created,
    attachment: buildDistillationConversationAttachment(stored),
  };
}

export function listDistillations(dataDir: string): StoredDistillation[] {
  const root = distillationsDir(dataDir);
  if (!fs.existsSync(root)) {
    return [];
  }
  const entries = fs.readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const records: StoredDistillation[] = [];
  for (const entry of entries) {
    try {
      records.push(loadDistillation(dataDir, entry.name));
    } catch {
      // Skip incomplete directories rather than failing the whole listing.
    }
  }
  return records.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}

export function loadDistillation(dataDir: string, distillationId: string): StoredDistillation {
  const directory = path.join(distillationsDir(dataDir), distillationId);
  const manifestPath = path.join(directory, "manifest.json");
  const jsonPath = path.join(directory, "result.json");
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Distillation not found: ${distillationId}`);
  }
  const parsed = parseDistillationJson(fs.readFileSync(jsonPath, "utf8"));
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Partial<StoredDistillation>)
    : {};
  return {
    ...parsed,
    id: manifest.id ?? distillationId,
    skill_ids: manifest.skill_ids ?? [],
    created_at: manifest.created_at ?? "",
    markdown_path: manifest.markdown_path ?? path.join(directory, "result.md"),
    json_path: manifest.json_path ?? jsonPath,
  };
}

function requiredMarkdown(markdown: string | undefined): string {
  if (!markdown || !markdown.trim()) {
    throw new DistillationValidationError(["markdown is required when distillation is not provided"]);
  }
  return markdown;
}

function toManifest(stored: StoredDistillation): Record<string, unknown> {
  return {
    id: stored.id,
    book_id: stored.book_id,
    title: stored.title,
    source_filename: stored.source_filename,
    template_id: stored.template_id,
    skill_ids: stored.skill_ids,
    created_at: stored.created_at,
    markdown_path: stored.markdown_path,
    json_path: stored.json_path,
  };
}

function countSkills(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM skills").get() as { n: number };
  return row.n;
}

function filenameFromBook(book?: ImportedBook | null): string {
  if (!book?.filePath) {
    return "";
  }
  return path.basename(book.filePath);
}

