import path from "node:path";
import {
  DISTILL_TEMPLATE_ID,
  LOCKED_SECTION_TITLES,
  UNCONFIRMED_DISTILL_LOCATION_LABEL,
  type Distillation,
  type DistillationQuote,
  type DistillationSection,
  type DistillationSkill,
  type DistillationSourceRef,
  type LockedSectionId,
} from "./types.ts";

const SECTION_HEADER_RE = /^##\s+(\d+)\.\s+(\S.*?)\s*$/gm;
const SKILL_HEADER_RE = /^###\s+Skill\s+(\d+)\s*[：:]\s*(.+?)\s*$/gm;
const TITLE_BOOK_RE = /^#\s*《([^》]+)》/;
const TITLE_FALLBACK_RE = /^#\s+(.+?)\s*$/m;
const SOURCE_PATH_RE = /原文依据：\s*`([^`]+)`/;
const FIELD_HEADER_RE =
  /^[ \t]*-[ \t]*\*\*(Skill名称|触发条件|执行步骤|输出要求)\*\*[：:][ \t]*(.*)$/gm;
const NUMBERED_STEP_RE = /^\s*(?:\d+[\.、]|\d+\))\s+(.+?)\s*$/;
const GOLDEN_LINE_RE = /^\s*\d+\.\s*(「[\s\S]*?」)\s*(?:——|—|-)\s*(.+?)\s*$/gm;
const QUOTE_RE = /「([^」]+)」/g;

export type ParseDistillationOptions = {
  book_id?: string;
  title?: string;
  source_filename?: string;
  template_id?: string;
};

export function parseDistillationMarkdown(markdown: string, options: ParseDistillationOptions = {}): Distillation {
  const normalized = normalizeNewlines(markdown);
  const title = options.title?.trim() || extractTitle(normalized);
  const sourceFilename = options.source_filename?.trim() || extractSourceFilename(normalized);
  const sections = splitSections(normalized).map((raw) => buildSection(raw, sourceFilename));

  return {
    book_id: options.book_id ?? "",
    title,
    source_filename: sourceFilename,
    template_id: options.template_id ?? DISTILL_TEMPLATE_ID,
    sections,
  };
}

export function distillationToMarkdown(distillation: Distillation): string {
  const bookTitle = distillation.title.trim() || "未命名";
  const source = distillation.source_filename.trim();
  const lines: string[] = [`# 《${bookTitle}》蒸馏结果`, ""];
  if (source) {
    lines.push(`> 原文依据：\`${source}\``, "");
  }
  lines.push("---", "");

  for (const section of distillation.sections) {
    lines.push(`## ${section.id}. ${section.title}`, "");
    const body = section.id === 5 ? renderSectionFive(section) : section.content.trim();
    if (body) {
      lines.push(body, "");
    }
    lines.push("---", "");
  }

  while (lines.length > 0 && (lines[lines.length - 1] === "" || lines[lines.length - 1] === "---")) {
    lines.pop();
  }
  return `${lines.join("\n").trim()}\n`;
}

export function distillationToJson(distillation: Distillation, pretty = true): string {
  return `${JSON.stringify(toJsonModel(distillation), null, pretty ? 2 : 0)}\n`;
}

export function parseDistillationJson(text: string): Distillation {
  const raw = JSON.parse(text) as Distillation;
  return {
    book_id: raw.book_id ?? "",
    title: raw.title ?? "",
    source_filename: raw.source_filename ?? "",
    template_id: raw.template_id ?? DISTILL_TEMPLATE_ID,
    sections: (raw.sections ?? []).map((section) => normalizeParsedSection(section, raw.source_filename ?? "")),
  };
}

export function toJsonModel(distillation: Distillation): Distillation {
  return {
    book_id: distillation.book_id,
    title: distillation.title,
    source_filename: distillation.source_filename,
    template_id: distillation.template_id,
    sections: distillation.sections.map((section) => {
      const base: DistillationSection = {
        id: section.id,
        title: section.title,
        content: section.content,
        quotes: section.quotes,
        source: section.source,
      };
      if (section.id === 5) {
        base.skills = section.skills ?? [];
      }
      return base;
    }),
  };
}

function normalizeParsedSection(section: DistillationSection, sourceFilename: string): DistillationSection {
  const content = section.content ?? "";
  const quotes = section.quotes?.length ? section.quotes : extractQuotes(content);
  const source = section.source?.length ? section.source : sourcesFromQuotes(quotes, sourceFilename);
  const built: DistillationSection = {
    id: Number(section.id) as LockedSectionId,
    title: section.title,
    content,
    quotes,
    source,
  };
  if (built.id === 5) {
    built.skills = section.skills?.length ? section.skills.map(normalizeSkill) : parseSkills(content);
  }
  return built;
}

function normalizeSkill(skill: DistillationSkill): DistillationSkill {
  return {
    name: skill.name?.trim() ?? "",
    triggers: (skill.triggers ?? []).map((item) => item.trim()).filter(Boolean),
    steps: (skill.steps ?? []).map((item) => item.trim()).filter(Boolean),
    output: skill.output?.trim() ?? "",
  };
}

function extractTitle(markdown: string): string {
  const book = markdown.match(TITLE_BOOK_RE);
  if (book?.[1]) {
    return book[1].trim();
  }
  const fallback = markdown.match(TITLE_FALLBACK_RE)?.[1]?.trim() ?? "";
  return fallback.replace(/蒸馏结果$/u, "").trim();
}

function extractSourceFilename(markdown: string): string {
  const raw = markdown.match(SOURCE_PATH_RE)?.[1]?.trim();
  if (!raw) {
    return "";
  }
  return path.basename(raw.replace(/\\/g, "/"));
}

function splitSections(markdown: string): Array<{ id: number; title: string; content: string }> {
  const matches = [...markdown.matchAll(SECTION_HEADER_RE)];
  const sections: Array<{ id: number; title: string; content: string }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? markdown.length;
    sections.push({
      id: Number(current[1]),
      title: current[2].trim(),
      content: trimSectionBody(markdown.slice(start, end)),
    });
  }
  return sections;
}

function trimSectionBody(body: string): string {
  return body
    .replace(/^\s*---\s*/g, "")
    .replace(/\s*---\s*$/g, "")
    .trim();
}

function buildSection(
  raw: { id: number; title: string; content: string },
  sourceFilename: string,
): DistillationSection {
  const quotes = extractQuotes(raw.content);
  const section: DistillationSection = {
    id: raw.id as LockedSectionId,
    title: raw.title,
    content: raw.content,
    quotes,
    source: sourcesFromQuotes(quotes, sourceFilename),
  };
  if (raw.id === 5) {
    section.skills = parseSkills(raw.content);
  }
  return section;
}

export function extractQuotes(content: string): DistillationQuote[] {
  const quotes: DistillationQuote[] = [];
  const seen = new Set<string>();

  for (const match of content.matchAll(GOLDEN_LINE_RE)) {
    pushQuote(quotes, seen, match[1] ?? "", match[2] ?? null);
  }

  for (const match of content.matchAll(QUOTE_RE)) {
    const text = `「${match[1]}」`;
    const after = content.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 40);
    const attribution = extractAttribution(after);
    pushQuote(quotes, seen, text, attribution);
  }

  return quotes;
}

function pushQuote(quotes: DistillationQuote[], seen: Set<string>, rawText: string, attribution: string | null): void {
  const text = rawText.trim();
  if (!text) {
    return;
  }
  const key = `${text}::${attribution ?? ""}`;
  if (seen.has(key) || seen.has(`${text}::`)) {
    if (attribution && !seen.has(key)) {
      const existing = quotes.find((item) => item.text === text && item.attribution == null);
      if (existing) {
        existing.attribution = attribution.trim();
        seen.add(key);
      }
    }
    return;
  }
  seen.add(key);
  seen.add(`${text}::`);
  quotes.push({ text, attribution: attribution?.trim() || null });
}

function extractAttribution(after: string): string | null {
  const emdash = after.match(/^\s*(?:——|—)\s*([^\n]+?)\s*$/m);
  if (emdash?.[1]) {
    return emdash[1].trim();
  }
  const paren = after.match(/^\s*[（(]([^）)]+)[）)]/);
  if (paren?.[1]) {
    return paren[1].trim();
  }
  return null;
}

export function sourcesFromQuotes(quotes: DistillationQuote[], sourceFilename: string): DistillationSourceRef[] {
  if (!sourceFilename && quotes.length === 0) {
    return [];
  }
  if (quotes.length === 0 && sourceFilename) {
    return [
      {
        source_filename: sourceFilename,
        paragraph_id: null,
        confirmed: false,
        unconfirmedLabel: UNCONFIRMED_DISTILL_LOCATION_LABEL,
      },
    ];
  }
  return quotes.map((quote) => ({
    source_filename: sourceFilename,
    paragraph_id: null,
    confirmed: false,
    unconfirmedLabel: UNCONFIRMED_DISTILL_LOCATION_LABEL,
    quote: quote.text,
    chapterTitle: quote.attribution,
  }));
}

export function parseSkills(content: string): DistillationSkill[] {
  const matches = [...content.matchAll(SKILL_HEADER_RE)];
  const skills: DistillationSkill[] = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? content.length;
    const headingName = current[2]?.trim() ?? "";
    skills.push(parseSkillBlock(headingName, content.slice(start, end)));
  }
  return skills;
}

function parseSkillBlock(headingName: string, body: string): DistillationSkill {
  const fields = extractSkillFields(body);
  const name = (fields.get("Skill名称") ?? headingName).trim();
  const triggerText = (fields.get("触发条件") ?? "").trim();
  const stepsText = fields.get("执行步骤") ?? "";
  const output = (fields.get("输出要求") ?? "").trim();
  return {
    name,
    triggers: triggerText ? [triggerText] : [],
    steps: parseNumberedSteps(stepsText),
    output,
  };
}

function extractSkillFields(body: string): Map<string, string> {
  const fields = new Map<string, string>();
  const matches = [...body.matchAll(FIELD_HEADER_RE)];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const firstLine = current[2] ?? "";
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? body.length;
    const rest = body.slice(start, end);
    const combined = firstLine.trim() ? `${firstLine.trim()}\n${rest}` : rest;
    fields.set(current[1], combined.replace(/^\s*\n/, "").trim());
  }
  return fields;
}

function parseNumberedSteps(text: string): string[] {
  const steps: string[] = [];
  for (const line of text.split(/\n/)) {
    const match = line.match(NUMBERED_STEP_RE);
    if (match?.[1]) {
      steps.push(match[1].trim());
    }
  }
  if (steps.length === 0) {
    const compact = text.replace(/^[ \t]*-[ \t]*/gm, "").trim();
    return compact ? [compact] : [];
  }
  return steps;
}

function renderSectionFive(section: DistillationSection): string {
  const skills = section.skills ?? [];
  const contentHasSkills = /^###\s+Skill\s+\d+/m.test(section.content);
  if (contentHasSkills && section.content.trim()) {
    return section.content.trim();
  }
  const lead = section.content.trim();
  const blocks = skills.map((skill, index) => renderSkillMarkdown(skill, index + 1));
  return [lead, ...blocks].filter(Boolean).join("\n\n").trim();
}

export function renderSkillMarkdown(skill: DistillationSkill, index: number): string {
  const lines = [
    `### Skill ${index}：${skill.name}`,
    `- **Skill名称**：${skill.name}`,
    `- **触发条件**：${skill.triggers.join("；")}`,
    "- **执行步骤**：",
  ];
  if (skill.steps.length === 0) {
    lines.push("  1. ");
  } else {
    skill.steps.forEach((step, stepIndex) => {
      lines.push(`  ${stepIndex + 1}. ${step}`);
    });
  }
  lines.push("- **输出要求**：", skill.output ? indentBlock(skill.output) : "");
  return lines.filter((line, idx) => !(idx === lines.length - 1 && line === "")).join("\n").trim();
}

function indentBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => (line.trim() ? `  ${line}` : line))
    .join("\n");
}

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export { LOCKED_SECTION_TITLES };
