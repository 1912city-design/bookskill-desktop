import fs from "node:fs";
import path from "node:path";
import type { KnowledgeGraph, LoadKnowledgeGraphInput, SaveKnowledgeGraphInput } from "./types.ts";
import { normalizeKnowledgeGraph } from "./normalize.ts";

export const GRAPH_DIRNAME = "graph";
export const GRAPH_FILENAME = "knowledge-graph.json";

export function knowledgeGraphPath(dataDir: string): string {
  return path.join(dataDir, GRAPH_DIRNAME, GRAPH_FILENAME);
}

export function saveKnowledgeGraph(input: SaveKnowledgeGraphInput): void {
  const filePath = knowledgeGraphPath(input.dataDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const normalized = normalizeKnowledgeGraph(input.graph);
  fs.writeFileSync(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
}

export function loadKnowledgeGraph(input: LoadKnowledgeGraphInput): KnowledgeGraph | null {
  const filePath = knowledgeGraphPath(input.dataDir);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  return normalizeKnowledgeGraph(asKnowledgeGraph(raw, filePath));
}

function asKnowledgeGraph(raw: unknown, filePath: string): KnowledgeGraph {
  if (!isObject(raw) || !Array.isArray(raw.nodes) || !Array.isArray(raw.edges)) {
    throw new Error(`Invalid knowledge graph file: ${filePath}`);
  }
  return {
    nodes: raw.nodes.map((node, index) => asNode(node, filePath, index)),
    edges: raw.edges.map((edge, index) => asEdge(edge, filePath, index)),
  };
}

function asNode(raw: unknown, filePath: string, index: number): KnowledgeGraph["nodes"][number] {
  if (!isObject(raw)) {
    throw new Error(`Invalid knowledge graph node at ${index} in ${filePath}`);
  }
  const type = raw.type;
  const sourceSection = raw.source_section;
  if (!isNodeType(type) || !isSectionId(sourceSection) || typeof raw.id !== "string" || typeof raw.label !== "string" || typeof raw.source_filename !== "string") {
    throw new Error(`Invalid knowledge graph node at ${index} in ${filePath}`);
  }
  const node: KnowledgeGraph["nodes"][number] = {
    id: raw.id,
    type,
    label: raw.label,
    source_filename: raw.source_filename,
    source_section: sourceSection,
    locator_confirmed: Boolean(raw.locator_confirmed),
  };
  if (typeof raw.book_title === "string" && raw.book_title.trim()) {
    node.book_title = raw.book_title;
  }
  if (typeof raw.locator === "string" && raw.locator.trim()) {
    node.locator = raw.locator.trim();
  }
  return node;
}

function asEdge(raw: unknown, filePath: string, index: number): KnowledgeGraph["edges"][number] {
  if (!isObject(raw)) {
    throw new Error(`Invalid knowledge graph edge at ${index} in ${filePath}`);
  }
  if (
    typeof raw.source !== "string" ||
    typeof raw.target !== "string" ||
    !isEdgeType(raw.type) ||
    typeof raw.explanation !== "string"
  ) {
    throw new Error(`Invalid knowledge graph edge at ${index} in ${filePath}`);
  }
  return {
    source: raw.source,
    target: raw.target,
    type: raw.type,
    explanation: raw.explanation,
    explanation_confirmed: Boolean(raw.explanation_confirmed),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNodeType(value: unknown): value is KnowledgeGraph["nodes"][number]["type"] {
  return value === "positioning" || value === "principle" || value === "quote" || value === "framework" || value === "skill";
}

function isEdgeType(value: unknown): value is KnowledgeGraph["edges"][number]["type"] {
  return value === "applies_to" || value === "supports" || value === "derived_from" || value === "cites";
}

function isSectionId(value: unknown): value is KnowledgeGraph["nodes"][number]["source_section"] {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}
