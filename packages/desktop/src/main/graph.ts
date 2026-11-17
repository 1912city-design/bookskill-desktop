/**
 * Desktop wrapper around the merged GRAPH-001 public API.
 * Build, load, and save stay in `@bookskill/core`. This module only
 * collects desktop-stored distillations, exposes a knowledge-library
 * view model, and locates nodes without inventing fixture locators.
 */
import {
  buildKnowledgeGraph,
  loadKnowledgeGraph,
  saveKnowledgeGraph,
  type KnowledgeGraph,
} from "@bookskill/core";
import { listDistillations, loadDistillation } from "./distill-adapter.ts";
import {
  GRAPH_UNCONFIRMED_LOCATION_LABEL,
  toKnowledgeGraphView,
  type GraphLocateView,
  type KnowledgeGraphView,
} from "../renderer/graph/types.ts";

export type GraphSourceText = {
  source_filename: string;
  markdown: string;
};

export type LoadedGraphSources = {
  distillations: unknown[];
  sources: GraphSourceText[];
};

export function loadGraphSourcesFromDataDir(dataDir: string): LoadedGraphSources {
  const distillations: unknown[] = [];
  const sources: GraphSourceText[] = [];
  const seen = new Set<string>();
  for (const entry of listDistillations(dataDir)) {
    const stored = loadDistillation(dataDir, entry.id);
    const distillation = stored.distillation;
    const sourceFilename =
      (typeof distillation.source_filename === "string" && distillation.source_filename.trim()) ||
      entry.source_filename;
    distillations.push(distillation);
    if (seen.has(sourceFilename)) {
      continue;
    }
    seen.add(sourceFilename);
    sources.push({
      source_filename: sourceFilename,
      markdown: stored.markdown,
    });
  }
  return { distillations, sources };
}

export function loadKnowledgeGraphView(dataDir: string): KnowledgeGraphView {
  const { distillations } = loadGraphSourcesFromDataDir(dataDir);
  const graph = buildKnowledgeGraph({ distillations });
  saveKnowledgeGraph({ dataDir, graph });
  return toKnowledgeGraphView(graph);
}

export function readSavedKnowledgeGraph(dataDir: string): KnowledgeGraph | null {
  return loadKnowledgeGraph({ dataDir });
}

export function locateGraphNodeInGraph(input: {
  graph: KnowledgeGraph;
  nodeId: string;
  sources: readonly GraphSourceText[];
}): GraphLocateView {
  const node = input.graph.nodes.find((item) => item.id === input.nodeId);
  if (!node) {
    throw new Error("未找到该图谱节点。");
  }
  const source = input.sources.find((item) => item.source_filename === node.source_filename);
  const markdown = source?.markdown ?? "";
  const locator = node.locator?.trim() || "";
  const locatorIsSubstring = Boolean(locator && markdown.includes(locator));
  const labelIsSubstring = Boolean(node.label && markdown.includes(node.label));
  const confirmed = Boolean(node.locator_confirmed && locatorIsSubstring);
  const passageNeedle = confirmed && locatorIsSubstring
    ? locator
    : labelIsSubstring
      ? node.label
      : locatorIsSubstring
        ? locator
        : "";
  const passage = passageNeedle ? excerptAround(markdown, passageNeedle) : null;
  const result: GraphLocateView = {
    nodeId: node.id,
    label: node.label,
    source_filename: node.source_filename,
    source_section: node.source_section,
    locator_confirmed: confirmed,
    unconfirmed: !confirmed,
    unconfirmedLabel: confirmed ? null : GRAPH_UNCONFIRMED_LOCATION_LABEL,
    passage,
  };
  if (node.book_title) {
    result.book_title = node.book_title;
  }
  if (locatorIsSubstring) {
    result.locator = locator;
  }
  return result;
}

export function locateGraphNode(input: { dataDir: string; nodeId: string }): GraphLocateView {
  const { sources } = loadGraphSourcesFromDataDir(input.dataDir);
  const graph = loadKnowledgeGraphView(input.dataDir);
  return locateGraphNodeInGraph({
    graph,
    nodeId: input.nodeId,
    sources,
  });
}

function excerptAround(markdown: string, needle: string, radius = 120): string {
  const index = markdown.indexOf(needle);
  if (index < 0) {
    return needle;
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(markdown.length, index + needle.length + radius);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < markdown.length ? "…" : "";
  return `${prefix}${markdown.slice(start, end).replace(/\s+/g, " ").trim()}${suffix}`;
}
