import path from "node:path";
import { createHash } from "node:crypto";
import { UNSOURCED_INFERENCE_LABEL } from "../constants.ts";
import {
  extractQuotes,
  parseSkills,
  validateDistillation,
  type Distillation,
  type DistillationQuote,
  type DistillationSection,
  type DistillationSkill,
  type DistillationSourceRef,
} from "../distill/index.ts";
import { normalizeKnowledgeGraph } from "./normalize.ts";
import type {
  BuildKnowledgeGraphInput,
  GraphEdgeType,
  KnowledgeGraph,
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from "./types.ts";

type WorkingNode = KnowledgeGraphNode & {
  content: string;
};

const PRINCIPLE_HEADING_RE = /^###\s+(.+?)\s*$/gm;
const POSITIONING_CLAIM_RE = /\*\*核心主张\*\*[：:]\s*(.+)/;
const FRAMEWORK_NAME_RE = /\*\*框架名称[：:]\s*(.+?)\s*\*\*/;
const GOLDEN_LINE_RE = /^\s*\d+\.\s*(「[\s\S]*?」)\s*(?:——|—|-)\s*(.+?)\s*$/gm;
const QUOTE_MARK_RE = /「[^」]+」/g;

export function buildKnowledgeGraph(input: BuildKnowledgeGraphInput): KnowledgeGraph {
  const distillations = resolveDistillations(input.distillations);
  const working: WorkingNode[] = [];
  for (const distillation of distillations) {
    working.push(...nodesFromDistillation(distillation));
  }

  const edges: KnowledgeGraphEdge[] = [];
  const byBook = groupBy(working, (node) => node.source_filename);
  for (const nodes of byBook.values()) {
    edges.push(...edgesForBook(nodes));
  }

  return normalizeKnowledgeGraph({
    nodes: working.map(toPublicNode),
    edges,
  });
}

function resolveDistillations(input: readonly unknown[]): Distillation[] {
  const resolved: Distillation[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    const distillation = coerceDistillation(item);
    if (!distillation) {
      continue;
    }
    const key = distillationKey(distillation);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    resolved.push(distillation);
  }
  resolved.sort((left, right) => {
    return (
      left.source_filename.localeCompare(right.source_filename, "en") ||
      left.title.localeCompare(right.title, "en") ||
      left.book_id.localeCompare(right.book_id, "en")
    );
  });
  return resolved;
}

function coerceDistillation(input: unknown): Distillation | null {
  if (typeof input === "string") {
    const result = validateDistillation(input);
    return result.ok ? result.distillation : null;
  }
  if (!input || typeof input !== "object") {
    return null;
  }
  const result = validateDistillation(input as Distillation);
  return result.ok ? result.distillation : null;
}

function distillationKey(distillation: Distillation): string {
  return `${distillation.source_filename}\0${distillation.title}\0${distillation.book_id}`;
}

function nodesFromDistillation(distillation: Distillation): WorkingNode[] {
  const bookKey = bookKeyOf(distillation);
  const sourceFilename = sourceFilenameOf(distillation);
  const bookTitle = distillation.title.trim() || undefined;
  const nodes: WorkingNode[] = [];

  const positioning = sectionById(distillation, 1);
  if (positioning && positioning.content.trim()) {
    nodes.push(
      makeNode({
        bookKey,
        type: "positioning",
        key: "core",
        label: extractPositioningLabel(positioning.content),
        bookTitle,
        sourceFilename,
        sourceSection: 1,
        locator: locatorForSection(positioning, "section"),
        content: positioning.content,
      }),
    );
  } else if (positioning) {
    nodes.push(
      makeNode({
        bookKey,
        type: "positioning",
        key: "core",
        label: "核心定位",
        bookTitle,
        sourceFilename,
        sourceSection: 1,
        locator: { value: undefined, confirmed: false },
        content: "",
      }),
    );
  }

  const principles = sectionById(distillation, 2);
  if (principles) {
    const extracted = extractPrinciples(principles.content);
    if (extracted.length === 0 && principles.content.trim()) {
      nodes.push(
        makeNode({
          bookKey,
          type: "principle",
          key: "01",
          label: "原则与应用",
          bookTitle,
          sourceFilename,
          sourceSection: 2,
          locator: locatorForSection(principles, "section"),
          content: principles.content,
        }),
      );
    }
    extracted.forEach((principle, index) => {
      nodes.push(
        makeNode({
          bookKey,
          type: "principle",
          key: padIndex(index),
          label: principle.heading,
          bookTitle,
          sourceFilename,
          sourceSection: 2,
          locator: locatorForSection(principles, "section"),
          content: principle.content,
        }),
      );
    });
  }

  const quotes = sectionById(distillation, 3);
  if (quotes) {
    const items = quotesFromSection(quotes);
    items.forEach((quote, index) => {
      nodes.push(
        makeNode({
          bookKey,
          type: "quote",
          key: padIndex(index),
          label: quote.text,
          bookTitle,
          sourceFilename,
          sourceSection: 3,
          locator: locatorForQuote(quotes, quote),
          content: quote.text,
        }),
      );
    });
  }

  const framework = sectionById(distillation, 4);
  if (framework && framework.content.trim()) {
    nodes.push(
      makeNode({
        bookKey,
        type: "framework",
        key: "core",
        label: extractFrameworkLabel(framework.content),
        bookTitle,
        sourceFilename,
        sourceSection: 4,
        locator: locatorForSection(framework, "section"),
        content: framework.content,
      }),
    );
  }

  const skills = sectionById(distillation, 5);
  if (skills) {
    const items = skillsFromSection(skills);
    items.forEach((skill, index) => {
      const content = [skill.name, ...skill.triggers, ...skill.steps, skill.output].filter(Boolean).join("\n");
      nodes.push(
        makeNode({
          bookKey,
          type: "skill",
          key: padIndex(index),
          label: skill.name.trim() || `Skill ${index + 1}`,
          bookTitle,
          sourceFilename,
          sourceSection: 5,
          locator: locatorForSection(skills, "section"),
          content,
        }),
      );
    });
  }

  return nodes;
}

function edgesForBook(nodes: readonly WorkingNode[]): KnowledgeGraphEdge[] {
  const edges: KnowledgeGraphEdge[] = [];
  const positioning = nodes.filter((node) => node.type === "positioning");
  const principles = nodes.filter((node) => node.type === "principle");
  const quotes = nodes.filter((node) => node.type === "quote");
  const frameworks = nodes.filter((node) => node.type === "framework");
  const skills = nodes.filter((node) => node.type === "skill");

  const positioningNode = positioning[0];

  for (const principle of principles) {
    if (positioningNode) {
      const shared = sharedOriginalExplanation(principle, positioningNode);
      if (shared) {
        edges.push(makeEdge(principle.id, positioningNode.id, "supports", shared, true));
      } else {
        edges.push(
          makeEdge(
            principle.id,
            positioningNode.id,
            "derived_from",
            inferredExplanation("同书原则由核心定位展开"),
            false,
          ),
        );
      }
    }
    for (const quote of quotes) {
      if (containsOriginal(principle.content, quote.label)) {
        edges.push(makeEdge(principle.id, quote.id, "cites", quote.label, true));
      }
    }
  }

  if (positioningNode) {
    for (const quote of quotes) {
      if (containsOriginal(positioningNode.content, quote.label)) {
        edges.push(makeEdge(positioningNode.id, quote.id, "cites", quote.label, true));
      }
    }
  }

  for (const framework of frameworks) {
    if (positioningNode) {
      const shared = sharedOriginalExplanation(framework, positioningNode);
      if (shared) {
        edges.push(makeEdge(framework.id, positioningNode.id, "applies_to", shared, true));
      } else {
        edges.push(
          makeEdge(
            framework.id,
            positioningNode.id,
            "applies_to",
            inferredExplanation("同书应用框架用于核心定位中的问题"),
            false,
          ),
        );
      }
    }
    for (const principle of principles) {
      const shared = sharedOriginalExplanation(framework, principle);
      if (shared) {
        edges.push(makeEdge(framework.id, principle.id, "derived_from", shared, true));
      }
    }
    for (const quote of quotes) {
      if (containsOriginal(framework.content, quote.label)) {
        edges.push(makeEdge(framework.id, quote.id, "cites", quote.label, true));
      }
    }
  }

  const frameworkNode = frameworks[0];
  for (const skill of skills) {
    if (frameworkNode) {
      const shared = sharedOriginalExplanation(skill, frameworkNode);
      if (shared) {
        edges.push(makeEdge(skill.id, frameworkNode.id, "applies_to", shared, true));
      } else {
        edges.push(
          makeEdge(
            skill.id,
            frameworkNode.id,
            "applies_to",
            inferredExplanation("同书可调用Skill应用于该应用框架"),
            false,
          ),
        );
      }
    } else if (positioningNode) {
      edges.push(
        makeEdge(
          skill.id,
          positioningNode.id,
          "applies_to",
          inferredExplanation("同书可调用Skill应用于核心定位"),
          false,
        ),
      );
    }
    for (const principle of principles) {
      const shared = sharedOriginalExplanation(skill, principle);
      if (shared) {
        edges.push(makeEdge(skill.id, principle.id, "derived_from", shared, true));
      }
    }
    for (const quote of quotes) {
      if (containsOriginal(skill.content, quote.label)) {
        edges.push(makeEdge(skill.id, quote.id, "cites", quote.label, true));
      }
    }
  }

  return edges;
}

function makeNode(input: {
  bookKey: string;
  type: KnowledgeGraphNode["type"];
  key: string;
  label: string;
  bookTitle: string | undefined;
  sourceFilename: string;
  sourceSection: KnowledgeGraphNode["source_section"];
  locator: { value?: string; confirmed: boolean };
  content: string;
}): WorkingNode {
  const node: WorkingNode = {
    id: `graph:${input.bookKey}:${input.type}:${input.key}`,
    type: input.type,
    label: input.label.trim() || input.type,
    source_filename: input.sourceFilename,
    source_section: input.sourceSection,
    locator_confirmed: input.locator.confirmed,
    content: input.content,
  };
  if (input.bookTitle) {
    node.book_title = input.bookTitle;
  }
  const locator = input.locator.value?.trim();
  if (locator) {
    node.locator = locator;
  } else {
    node.locator_confirmed = false;
  }
  return node;
}

function makeEdge(
  source: string,
  target: string,
  type: GraphEdgeType,
  explanation: string,
  explanationConfirmed: boolean,
): KnowledgeGraphEdge {
  return {
    source,
    target,
    type,
    explanation,
    explanation_confirmed: explanationConfirmed,
  };
}

function toPublicNode(node: WorkingNode): KnowledgeGraphNode {
  const publicNode: KnowledgeGraphNode = {
    id: node.id,
    type: node.type,
    label: node.label,
    source_filename: node.source_filename,
    source_section: node.source_section,
    locator_confirmed: node.locator_confirmed && Boolean(node.locator),
  };
  if (node.book_title) {
    publicNode.book_title = node.book_title;
  }
  if (node.locator && node.locator.trim()) {
    publicNode.locator = node.locator.trim();
  } else {
    publicNode.locator_confirmed = false;
  }
  return publicNode;
}

function sectionById(distillation: Distillation, id: DistillationSection["id"]): DistillationSection | undefined {
  return distillation.sections.find((section) => Number(section.id) === id);
}

function extractPositioningLabel(content: string): string {
  const claim = content.match(POSITIONING_CLAIM_RE);
  const fromClaim = claim?.[1]?.trim();
  if (fromClaim) {
    return fromClaim;
  }
  const firstLine = firstMeaningfulLine(content);
  return firstLine || "核心定位";
}

function extractPrinciples(content: string): Array<{ heading: string; content: string }> {
  const matches = [...content.matchAll(PRINCIPLE_HEADING_RE)];
  const principles: Array<{ heading: string; content: string }> = [];
  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    if (!current) {
      continue;
    }
    const heading = current[1]?.trim();
    if (!heading) {
      continue;
    }
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? content.length;
    principles.push({
      heading,
      content: `${heading}\n${content.slice(start, end).trim()}`.trim(),
    });
  }
  return principles;
}

function extractFrameworkLabel(content: string): string {
  const named = content.match(FRAMEWORK_NAME_RE);
  const fromName = named?.[1]?.trim();
  if (fromName) {
    return fromName;
  }
  const firstLine = firstMeaningfulLine(content);
  return firstLine || "应用框架";
}

function quotesFromSection(section: DistillationSection): DistillationQuote[] {
  const fromGolden = extractGoldenQuotes(section.content);
  if (fromGolden.length > 0) {
    return fromGolden;
  }
  if (section.quotes.length > 0) {
    return section.quotes;
  }
  return extractQuotes(section.content);
}

function extractGoldenQuotes(content: string): DistillationQuote[] {
  const quotes: DistillationQuote[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(GOLDEN_LINE_RE)) {
    const text = match[1]?.trim();
    if (!text || seen.has(text)) {
      continue;
    }
    seen.add(text);
    const attribution = match[2]?.trim() || null;
    quotes.push({ text, attribution });
  }
  return quotes;
}

function skillsFromSection(section: DistillationSection): DistillationSkill[] {
  if (section.skills && section.skills.length > 0) {
    return section.skills.filter((skill) => skill.name.trim());
  }
  return parseSkills(section.content).filter((skill) => skill.name.trim());
}

/**
 * Precise locators are taken only from DISTILL-001 source refs (confirmed
 * paragraph_id) or, for 金句 nodes, from an attribution already present on the
 * quote. Nothing else is invented.
 */
function locatorForSection(
  section: DistillationSection,
  _mode: "section",
): { value?: string; confirmed: boolean } {
  const confirmed = section.source.find((source) => source.confirmed && source.paragraph_id?.trim());
  const paragraphId = confirmed?.paragraph_id?.trim();
  if (paragraphId) {
    return { value: paragraphId, confirmed: true };
  }
  return { confirmed: false };
}

function locatorForQuote(
  section: DistillationSection,
  quote: DistillationQuote,
): { value?: string; confirmed: boolean } {
  const matched = matchingSource(section.source, quote);
  const confirmedId = matched?.confirmed ? matched.paragraph_id?.trim() : undefined;
  if (confirmedId) {
    return { value: confirmedId, confirmed: true };
  }
  const anyConfirmed = section.source.find((source) => {
    return source.confirmed && source.paragraph_id?.trim() && source.quote === quote.text;
  });
  const anyId = anyConfirmed?.paragraph_id?.trim();
  if (anyId) {
    return { value: anyId, confirmed: true };
  }
  const attribution = quote.attribution?.trim();
  if (attribution) {
    return { value: attribution, confirmed: false };
  }
  const chapterTitle = matched?.chapterTitle?.trim();
  if (chapterTitle) {
    return { value: chapterTitle, confirmed: false };
  }
  return { confirmed: false };
}

function matchingSource(sources: readonly DistillationSourceRef[], quote: DistillationQuote): DistillationSourceRef | undefined {
  return sources.find((source) => source.quote === quote.text);
}

function sharedOriginalExplanation(left: WorkingNode, right: WorkingNode): string | null {
  const shortName = principleShortName(left.label) ?? principleShortName(right.label);
  if (shortName && containsOriginal(left.content, shortName) && containsOriginal(right.content, shortName)) {
    return shortName;
  }
  const quotes = unique([
    ...originalQuotes(left.content),
    ...originalQuotes(left.label),
    ...originalQuotes(right.content),
    ...originalQuotes(right.label),
  ]).sort((a, b) => b.length - a.length);
  for (const quote of quotes) {
    if (containsOriginal(left.content, quote) && containsOriginal(right.content, quote)) {
      return quote;
    }
    if (containsOriginal(left.label, quote) && containsOriginal(right.content, quote)) {
      return quote;
    }
    if (containsOriginal(left.content, quote) && containsOriginal(right.label, quote)) {
      return quote;
    }
  }
  if (left.label.trim() && containsOriginal(right.content, left.label)) {
    return left.label;
  }
  if (right.label.trim() && containsOriginal(left.content, right.label)) {
    return right.label;
  }
  return null;
}

function principleShortName(label: string): string | null {
  const match = label.match(/^原则[一二三四五六七八九十0-9]+[：:]([^——\n]+)/);
  const name = match?.[1]?.trim();
  return name && name.length >= 2 ? name : null;
}

function originalQuotes(text: string): string[] {
  return text.match(QUOTE_MARK_RE) ?? [];
}

function containsOriginal(haystack: string, needle: string): boolean {
  const trimmed = needle.trim();
  if (!trimmed) {
    return false;
  }
  return haystack.includes(trimmed);
}

function inferredExplanation(reason: string): string {
  return `${UNSOURCED_INFERENCE_LABEL}：${reason}`;
}

function sourceFilenameOf(distillation: Distillation): string {
  const raw = distillation.source_filename.trim();
  if (raw) {
    return path.basename(raw.replace(/\\/g, "/"));
  }
  const fromTitle = distillation.title.trim();
  if (fromTitle) {
    return `${fromTitle}.md`;
  }
  return "unknown-source.md";
}

function bookKeyOf(distillation: Distillation): string {
  const fromFile = stripExtension(sourceFilenameOf(distillation));
  if (fromFile && fromFile !== "unknown-source") {
    return fromFile;
  }
  const title = distillation.title.trim();
  if (title) {
    return title;
  }
  const bookId = distillation.book_id.trim();
  if (bookId) {
    return bookId;
  }
  return `untitled-${sha256Short(distillation.sections.map((section) => section.content).join("\n"))}`;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.md$/i, "");
}

function padIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function firstMeaningfulLine(content: string): string {
  for (const line of content.split(/\n/)) {
    const trimmed = line.replace(/\*\*/g, "").trim();
    if (trimmed && trimmed !== "---") {
      return trimmed;
    }
  }
  return "";
}

function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
      continue;
    }
    groups.set(key, [item]);
  }
  return groups;
}

function unique(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function sha256Short(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 12);
}
