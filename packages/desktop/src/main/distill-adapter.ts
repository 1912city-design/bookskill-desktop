import {
  createSkill,
  DEFAULT_SKILL_DOMAIN,
  DEFAULT_SKILL_VERSION,
  loadSkill,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
} from "@bookskill/core";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  DISTILL_TEMPLATE_ID,
  DISTILL_UNCONFIRMED_LOCATION_LABEL,
  LOCKED_SECTION_TITLES,
  type Distillation,
  type DistillationSection,
  type DistillationSkill,
  type DistillationSkillRef,
  type DistillationSourceRef,
  type DistillationValidationError,
  type DistillationValidationResult,
  type DistillationPreviewView,
  type StoredDistillation,
} from "../renderer/distill/types.ts";

const SECTION_HEADING = /^##\s+(\d+)\.\s+(.+?)\s*$/;
const SKILL_HEADING = /^###\s+Skill\s+\d+\s*[：:]\s*(.+?)\s*$/i;
const FIELD_LINE = /^- \*\*(Skill名称|触发条件|执行步骤|输出要求)\*\*[：:]\s*(.*)$/;
const QUOTE_RE = /「([^」]+)」/g;

export const DISTILL_STORE_DIR = ["library", "distill"] as const;

export type ParseDistillationOptions = {
  sourceFilename?: string;
  bookId?: string;
  title?: string;
};

export type ImportDistillationOptions = {
  dataDir: string;
  db: DatabaseSync;
  distillation?: Distillation;
  markdown?: string;
  sourceFilename?: string;
  bookId?: string;
};

export type ImportDistillationResult =
  | { ok: true; record: StoredDistillation; preview: DistillationPreviewView }
  | { ok: false; errors: DistillationValidationError[]; preview: null };

function unconfirmedSource(sourceFilename: string): DistillationSourceRef {
  return {
    source_filename: sourceFilename,
    locator: null,
    label: DISTILL_UNCONFIRMED_LOCATION_LABEL,
  };
}

function extractQuotes(text: string): string[] {
  const quotes: string[] = [];
  for (const match of text.matchAll(QUOTE_RE)) {
    const quote = match[1]?.trim();
    if (quote) {
      quotes.push(quote);
    }
  }
  return quotes;
}

function titleFromMarkdown(markdown: string, fallback: string): string {
  const heading = markdown.match(/^#\s+(.+?)\s*$/m);
  return heading?.[1]?.trim() || fallback;
}

function splitSections(markdown: string): Array<{ id: number; title: string; body: string }> {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const starts: Array<{ index: number; id: number; title: string }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i]?.match(SECTION_HEADING);
    if (!match) {
      continue;
    }
    starts.push({
      index: i,
      id: Number(match[1]),
      title: (match[2] ?? "").trim(),
    });
  }
  return starts.map((start, ordinal) => {
    const next = starts[ordinal + 1];
    const body = lines.slice(start.index + 1, next?.index ?? lines.length).join("\n").trim();
    return { id: start.id, title: start.title, body };
  });
}

function parseSkillBlock(block: string): DistillationSkill | null {
  const lines = block.replaceAll("\r\n", "\n").split("\n");
  const heading = lines[0]?.match(SKILL_HEADING);
  if (!heading) {
    return null;
  }
  let name = heading[1]?.trim() ?? "";
  let current: "name" | "triggers" | "steps" | "output" | null = null;
  const triggerParts: string[] = [];
  const stepParts: string[] = [];
  const outputParts: string[] = [];

  const pushTo = (field: "triggers" | "steps" | "output", line: string) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    if (field === "triggers") {
      triggerParts.push(trimmed.replace(/^[-*]\s+/, ""));
    } else if (field === "steps") {
      const numbered = trimmed.match(/^\d+[.)、]\s*(.*)$/);
      if (numbered) {
        stepParts.push((numbered[1] ?? "").trim());
        return;
      }
      if (stepParts.length === 0) {
        stepParts.push(trimmed.replace(/^[-*]\s+/, ""));
        return;
      }
      stepParts[stepParts.length - 1] = `${stepParts[stepParts.length - 1]} ${trimmed.replace(/^[-*]\s+/, "")}`.trim();
    } else {
      outputParts.push(trimmed.replace(/^[-*]\s+/, ""));
    }
  };

  for (const raw of lines.slice(1)) {
    const field = raw.trim().match(FIELD_LINE);
    if (field) {
      const key = field[1];
      const rest = (field[2] ?? "").trim();
      if (key === "Skill名称") {
        current = "name";
        if (rest) {
          name = rest;
        }
      } else if (key === "触发条件") {
        current = "triggers";
        if (rest) {
          triggerParts.push(rest);
        }
      } else if (key === "执行步骤") {
        current = "steps";
        if (rest) {
          pushTo("steps", rest);
        }
      } else if (key === "输出要求") {
        current = "output";
        if (rest) {
          outputParts.push(rest);
        }
      }
      continue;
    }
    if (current === "name" && raw.trim()) {
      name = `${name} ${raw.trim()}`.trim();
    } else if (current === "triggers") {
      pushTo("triggers", raw);
    } else if (current === "steps") {
      pushTo("steps", raw);
    } else if (current === "output") {
      pushTo("output", raw);
    }
  }

  return {
    name,
    triggers: triggerParts.filter(Boolean),
    steps: stepParts.filter(Boolean),
    output: outputParts.join("\n").trim(),
  };
}

function parseSkills(sectionBody: string): DistillationSkill[] {
  const lines = sectionBody.replaceAll("\r\n", "\n").split("\n");
  const starts: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (SKILL_HEADING.test(lines[i] ?? "")) {
      starts.push(i);
    }
  }
  return starts
    .map((start, ordinal) => {
      const next = starts[ordinal + 1];
      const block = lines.slice(start, next ?? lines.length).join("\n");
      return parseSkillBlock(block);
    })
    .filter((skill): skill is DistillationSkill => skill !== null);
}

export function skillToMarkdown(skill: DistillationSkill): string {
  const triggers = skill.triggers.length > 0 ? skill.triggers.join("；") : "";
  const steps =
    skill.steps.length > 0
      ? skill.steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n")
      : "";
  const output = skill.output
    ? skill.output
        .split("\n")
        .map((line) => (line.trim() ? `  - ${line.trim()}` : ""))
        .filter(Boolean)
        .join("\n")
    : "";
  return [
    `### Skill：${skill.name}`,
    `- **Skill名称**：${skill.name}`,
    `- **触发条件**：${triggers}`,
    `- **执行步骤**：`,
    steps,
    `- **输出要求**：`,
    output,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function skillToJson(skill: DistillationSkill): string {
  return `${JSON.stringify(skill, null, 2)}\n`;
}

export function distillationToMarkdown(distillation: Distillation): string {
  const sections = distillation.sections
    .map((section) => `## ${section.id}. ${section.title}\n\n${section.content}`.trim())
    .join("\n\n---\n\n");
  return `# ${distillation.title}\n\n${sections}\n`;
}

export function distillationToJson(distillation: Distillation): string {
  return `${JSON.stringify(distillation, null, 2)}\n`;
}

export function parseDistillationMarkdown(
  markdown: string,
  options: ParseDistillationOptions = {},
): Distillation {
  const sourceFilename = options.sourceFilename?.trim() ?? "";
  const bookId = options.bookId?.trim() ?? "";
  const title = options.title?.trim() || titleFromMarkdown(markdown, sourceFilename || "未命名蒸馏结果");
  const parsedSections = splitSections(markdown);
  const sections: DistillationSection[] = parsedSections.map((section) => {
    const base = {
      id: section.id as DistillationSection["id"],
      title: section.title,
      content: section.body,
      quotes: extractQuotes(section.body),
      source: sourceFilename ? [unconfirmedSource(sourceFilename)] : [],
    };
    if (section.id === 5) {
      return { ...base, skills: parseSkills(section.body) };
    }
    return base;
  });
  return {
    book_id: bookId,
    title,
    source_filename: sourceFilename,
    template_id: DISTILL_TEMPLATE_ID,
    sections,
  };
}

export function validateDistillation(distillation: Distillation): DistillationValidationResult {
  const errors: DistillationValidationError[] = [];
  const byId = new Map<number, DistillationSection>();
  for (const section of distillation.sections) {
    byId.set(section.id, section);
  }

  if (distillation.sections.length !== 5) {
    errors.push({
      code: "section_count",
      message: `蒸馏结果必须正好包含 5 段，当前为 ${distillation.sections.length} 段。`,
    });
  }

  LOCKED_SECTION_TITLES.forEach((expectedTitle, index) => {
    const expectedId = index + 1;
    const section = byId.get(expectedId) ?? distillation.sections[index];
    if (!section) {
      errors.push({
        code: "missing_section",
        message: `缺少锁定标题「${expectedTitle}」。`,
        sectionId: expectedId,
        title: expectedTitle,
      });
      return;
    }
    if (section.title !== expectedTitle) {
      errors.push({
        code: "renamed_title",
        message: `第 ${expectedId} 段标题必须是「${expectedTitle}」，不能改成「${section.title}」。`,
        sectionId: expectedId,
        title: section.title,
      });
    }
    if (section.id !== expectedId) {
      errors.push({
        code: "invalid_structure",
        message: `第 ${expectedId} 段的编号必须是 ${expectedId}。`,
        sectionId: section.id,
        title: section.title,
      });
    }
  });

  const skillSection =
    byId.get(5) ?? distillation.sections.find((section) => section.title === "可调用Skill");
  const skills = skillSection?.skills ?? [];
  const usableSkills = skills.filter(
    (skill) => skill.name.trim() && (skill.triggers.length > 0 || skill.steps.length > 0 || skill.output.trim()),
  );
  if (skillSection && usableSkills.length === 0) {
    errors.push({
      code: "empty_skills",
      message: "第 5 段「可调用Skill」必须包含至少一个可提取的 Skill。",
      sectionId: 5,
      title: "可调用Skill",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, errors: [] };
}

export function buildDistillationPreview(
  distillation: Distillation,
  options: { id?: string | null; markdown?: string; skillRefs?: DistillationSkillRef[] } = {},
): DistillationPreviewView {
  const skillSection = distillation.sections.find((section) => section.id === 5);
  const skills = (skillSection?.skills ?? []).map((skill) => ({
    ...skill,
    markdown: skillToMarkdown(skill),
    json: skillToJson(skill),
  }));
  return {
    id: options.id ?? null,
    title: distillation.title,
    sourceFilename: distillation.source_filename,
    locatorLabel: DISTILL_UNCONFIRMED_LOCATION_LABEL,
    locatorConfirmed: false,
    markdown: options.markdown ?? distillationToMarkdown(distillation),
    json: distillationToJson(distillation),
    sections: distillation.sections,
    skills,
    skillRefs: options.skillRefs ?? [],
  };
}

function distillRoot(dataDir: string): string {
  return path.join(dataDir, ...DISTILL_STORE_DIR);
}

function indexPath(dataDir: string): string {
  return path.join(distillRoot(dataDir), "index.json");
}

type DistillIndexEntry = {
  id: string;
  title: string;
  source_filename: string;
  book_id: string;
  createdAt: string;
};

function readIndex(dataDir: string): DistillIndexEntry[] {
  const file = indexPath(dataDir);
  if (!fs.existsSync(file)) {
    return [];
  }
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as DistillIndexEntry[];
  return Array.isArray(parsed) ? parsed : [];
}

function writeIndex(dataDir: string, entries: DistillIndexEntry[]): void {
  fs.mkdirSync(distillRoot(dataDir), { recursive: true });
  fs.writeFileSync(indexPath(dataDir), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
}

function recordPath(dataDir: string, id: string): string {
  return path.join(distillRoot(dataDir), id, "distillation.json");
}

function fillBookMetadata(
  db: DatabaseSync,
  distillation: Distillation,
  options: { sourceFilename?: string; bookId?: string },
): Distillation {
  const bookId = options.bookId?.trim() || distillation.book_id;
  let sourceFilename = options.sourceFilename?.trim() || distillation.source_filename;
  let title = distillation.title;
  if (bookId) {
    const row = db
      .prepare(`SELECT title, file_path FROM books WHERE id = ?`)
      .get(bookId) as { title: string; file_path: string } | undefined;
    if (row) {
      if (!sourceFilename && row.file_path) {
        sourceFilename = path.basename(row.file_path);
      }
      if (!title) {
        title = row.title;
      }
    }
  }
  const source = sourceFilename ? [unconfirmedSource(sourceFilename)] : [];
  return {
    ...distillation,
    book_id: bookId,
    title,
    source_filename: sourceFilename,
    template_id: distillation.template_id || DISTILL_TEMPLATE_ID,
    sections: distillation.sections.map((section) => ({
      ...section,
      source: section.source.length > 0 ? section.source : source,
    })),
  };
}

function createDraftSkills(db: DatabaseSync, distillation: Distillation): DistillationSkillRef[] {
  const skills =
    distillation.sections.find((section) => section.id === 5)?.skills ?? [];
  const refs: DistillationSkillRef[] = [];
  for (const skill of skills) {
    const created = createSkill({
      db,
      name: skill.name,
      domain: DEFAULT_SKILL_DOMAIN,
      purpose: skill.triggers[0] || skill.output || `从蒸馏结果导入的 draft Skill：${skill.name}`,
      status: SKILL_STATUS_DRAFT,
      version: DEFAULT_SKILL_VERSION,
      inputs: skill.triggers.map((trigger, index) => ({
        name: `trigger_${index + 1}`,
        required: false,
        description: trigger,
      })),
      steps: skill.steps.map((text, index) => ({
        id: `step-${index + 1}`,
        text,
      })),
      rules: [
        ...skill.triggers.map((trigger) => `触发条件：${trigger}`),
        "不得自动把草稿发布为正式 Skill。",
        "没有精确出处时必须标注为来源定位未确认，不得伪造段落定位。",
      ],
      outputSchema: {
        type: "object",
        properties: {
          content: { type: "string" },
          output: { type: "string", description: skill.output },
        },
      },
      permissions: {
        network: false,
        writeFiles: false,
        modelProvider: "none",
        whenToUse: skill.triggers.join("\n"),
        whenNotToUse: "在蒸馏结果仍为草稿、尚未由用户确认发布之前，不要把它当作正式 Skill。",
      },
    });
    if (created.skill.status === SKILL_STATUS_PUBLISHED) {
      throw new Error("蒸馏导入不得把 Skill 发布为 published。");
    }
    if (created.skill.status !== SKILL_STATUS_DRAFT) {
      throw new Error("蒸馏导入必须生成 draft Skill。");
    }
    if (!created.skill.currentVersionId) {
      throw new Error("蒸馏导入的 Skill 没有当前版本。");
    }
    refs.push({
      skillId: created.skill.id,
      skillVersionId: created.skill.currentVersionId,
      name: created.skill.name,
      status: created.skill.status,
    });
  }
  return refs;
}

export function importDistillation(options: ImportDistillationOptions): ImportDistillationResult {
  const markdown =
    options.markdown ??
    (options.distillation ? distillationToMarkdown(options.distillation) : "");
  if (!markdown.trim() && !options.distillation) {
    return {
      ok: false,
      errors: [
        {
          code: "invalid_structure",
          message: "缺少可导入的蒸馏 Markdown 或 JSON。",
        },
      ],
      preview: null,
    };
  }
  const parsed =
    options.distillation ??
    parseDistillationMarkdown(markdown, {
      sourceFilename: options.sourceFilename,
      bookId: options.bookId,
    });
  const distillation = fillBookMetadata(options.db, parsed, {
    sourceFilename: options.sourceFilename,
    bookId: options.bookId,
  });
  const validation = validateDistillation(distillation);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, preview: null };
  }

  const skillRefs = createDraftSkills(options.db, distillation);
  for (const ref of skillRefs) {
    const loaded = loadSkill(options.db, ref.skillId);
    if (loaded.status !== SKILL_STATUS_DRAFT) {
      throw new Error("蒸馏导入后的 Skill 必须保持 draft。");
    }
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const record: StoredDistillation = {
    id,
    distillation,
    markdown: markdown.trim() ? markdown : distillationToMarkdown(distillation),
    skillRefs,
    createdAt,
  };
  const folder = path.join(distillRoot(options.dataDir), id);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(recordPath(options.dataDir, id), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  fs.writeFileSync(path.join(folder, "result.md"), record.markdown.endsWith("\n") ? record.markdown : `${record.markdown}\n`, "utf8");
  const entries = readIndex(options.dataDir);
  entries.unshift({
    id,
    title: distillation.title,
    source_filename: distillation.source_filename,
    book_id: distillation.book_id,
    createdAt,
  });
  writeIndex(options.dataDir, entries);
  return {
    ok: true,
    record,
    preview: buildDistillationPreview(distillation, {
      id,
      markdown: record.markdown,
      skillRefs,
    }),
  };
}

export function listDistillations(dataDir: string): DistillIndexEntry[] {
  return readIndex(dataDir);
}

export function loadDistillation(dataDir: string, id: string): StoredDistillation {
  const file = recordPath(dataDir, id);
  if (!fs.existsSync(file)) {
    throw new Error("找不到对应的蒸馏结果。");
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as StoredDistillation;
}

export function countSkillsInWorkspace(db: DatabaseSync): { total: number; published: number; draft: number } {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS published,
         SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS draft
       FROM skills`,
    )
    .get(SKILL_STATUS_PUBLISHED, SKILL_STATUS_DRAFT) as {
    total: number;
    published: number | null;
    draft: number | null;
  };
  return {
    total: Number(row.total ?? 0),
    published: Number(row.published ?? 0),
    draft: Number(row.draft ?? 0),
  };
}
