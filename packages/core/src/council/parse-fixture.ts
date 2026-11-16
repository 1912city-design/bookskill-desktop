import fs from "node:fs";
import path from "node:path";
import { FIXED_COUNCIL_SEATS } from "./seats.ts";
import type { DistillQuote, DistillSkillDraft, ParsedDistillFixture } from "./types.ts";

const SECTION_TITLES = {
  positioning: "核心定位",
  principles: "原则与应用",
  quotes: "金句",
  framework: "应用框架",
  skills: "可调用Skill",
} as const;

/**
 * Minimal, local parser for the locked 5-segment distill Markdown fixtures.
 * Lives under council/ so this ticket does not own or compete for packages/core/src/distill/**.
 */
export function parseCouncilDistillMarkdown(markdown: string, filename: string): ParsedDistillFixture {
  const bookTitle = extractBookTitle(markdown, filename);
  const sections = splitSections(markdown);
  return {
    filename,
    bookTitle,
    markdown,
    sections,
    quotes: parseQuotes(sections.quotes),
    skills: parseSkills(sections.skills),
  };
}

export function loadCouncilFixtureFile(filePath: string): ParsedDistillFixture {
  const markdown = fs.readFileSync(filePath, "utf8");
  return parseCouncilDistillMarkdown(markdown, path.basename(filePath));
}

export function loadCouncilFixtures(fixtureDir: string): ParsedDistillFixture[] {
  return FIXED_COUNCIL_SEATS.map((seat) => {
    const filePath = path.join(fixtureDir, seat.source_filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Council fixture missing: ${filePath}`);
    }
    const parsed = loadCouncilFixtureFile(filePath);
    if (parsed.filename !== seat.source_filename) {
      throw new Error(`Council fixture filename mismatch: ${parsed.filename}`);
    }
    return parsed;
  });
}

function extractBookTitle(markdown: string, filename: string): string {
  const heading = markdown.match(/^#\s*《([^》]+)》/m);
  if (heading?.[1]) {
    return heading[1].replaceAll("經", "经").trim();
  }
  const fromName = filename.replace(/_蒸馏结果\.md$/, "");
  return fromName || filename;
}

function splitSections(markdown: string): ParsedDistillFixture["sections"] {
  const matches = [...markdown.matchAll(/^##\s+(\d+)\.\s+(.+?)\s*$/gm)];
  if (matches.length < 5) {
    throw new Error("Distill fixture must contain the locked 5-segment structure");
  }
  const found: Partial<ParsedDistillFixture["sections"]> = {};
  for (let i = 0; i < matches.length; i += 1) {
    const match = matches[i];
    if (!match) {
      continue;
    }
    const title = match[2] ?? "";
    const start = (match.index ?? 0) + match[0].length;
    const next = matches[i + 1];
    const end = next?.index ?? markdown.length;
    const body = markdown.slice(start, end).trim();
    const key = sectionKeyFor(title);
    if (key) {
      found[key] = body;
    }
  }
  for (const [key, label] of Object.entries(SECTION_TITLES)) {
    if (!found[key as keyof typeof found]) {
      throw new Error(`Distill fixture is missing section: ${label}`);
    }
  }
  return found as ParsedDistillFixture["sections"];
}

function sectionKeyFor(title: string): keyof ParsedDistillFixture["sections"] | null {
  const normalized = title.replaceAll(/\s+/g, "");
  if (normalized.includes("核心定位")) return "positioning";
  if (normalized.includes("原则")) return "principles";
  if (normalized.includes("金句")) return "quotes";
  if (normalized.includes("应用框架")) return "framework";
  if (normalized.includes("可调用Skill") || normalized.includes("可调用技能")) return "skills";
  return null;
}

function parseQuotes(section: string): DistillQuote[] {
  const quotes: DistillQuote[] = [];
  const pattern = /^\s*\d+\.\s*「([^」]+)」——(.+)$/gm;
  for (const match of section.matchAll(pattern)) {
    const text = match[1]?.trim();
    const attribution = match[2]?.trim();
    if (text && attribution) {
      quotes.push({ text, attribution });
    }
  }
  if (quotes.length === 0) {
    throw new Error("Distill fixture section 3 must contain numbered quotes");
  }
  return quotes;
}

function parseSkills(section: string): DistillSkillDraft[] {
  const blocks = section.split(/^###\s+Skill\s+\d+：/m).slice(1);
  const skills: DistillSkillDraft[] = [];
  for (const block of blocks) {
    const lines = block.trim();
    const nameFromHeading = lines.split(/\n/, 1)[0]?.trim() ?? "";
    const nameFromField = fieldValue(lines, "Skill名称") ?? nameFromHeading;
    if (!nameFromField) {
      continue;
    }
    skills.push({
      name: nameFromField,
      trigger: fieldValue(lines, "触发条件") ?? "",
      steps: fieldBlock(lines, "执行步骤"),
      output: fieldBlock(lines, "输出要求"),
      body: lines,
    });
  }
  if (skills.length === 0) {
    throw new Error("Distill fixture section 5 must contain at least one Skill");
  }
  return skills;
}

function fieldValue(body: string, label: string): string | null {
  const match = body.match(new RegExp(`^-\\s+\\*\\*${escapeRegExp(label)}\\*\\*：\\s*(.+)$`, "m"));
  return match?.[1]?.trim() || null;
}

function fieldBlock(body: string, label: string): string {
  const match = body.match(new RegExp(`^-\\s+\\*\\*${escapeRegExp(label)}\\*\\*：\\s*([\\s\\S]*?)(?=\\n-\\s+\\*\\*|$)`));
  return match?.[1]?.trim() ?? "";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
