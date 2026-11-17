import type { KnowledgeGraph, KnowledgeGraphEdge, KnowledgeGraphNode } from "./types.ts";

const TYPE_ORDER: Record<KnowledgeGraphNode["type"], number> = {
  positioning: 1,
  principle: 2,
  quote: 3,
  framework: 4,
  skill: 5,
};

export function normalizeKnowledgeGraph(graph: KnowledgeGraph): KnowledgeGraph {
  const nodes = sortNodes(dedupeNodes(graph.nodes));
  const allowed = new Set(nodes.map((node) => node.id));
  const edges = sortEdges(dedupeEdges(graph.edges.filter((edge) => allowed.has(edge.source) && allowed.has(edge.target) && edge.source !== edge.target)));
  return { nodes, edges };
}

export function sortNodes(nodes: readonly KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  return [...nodes].sort((left, right) => {
    return (
      left.source_filename.localeCompare(right.source_filename, "en") ||
      left.source_section - right.source_section ||
      (TYPE_ORDER[left.type] ?? 99) - (TYPE_ORDER[right.type] ?? 99) ||
      left.id.localeCompare(right.id, "en") ||
      left.label.localeCompare(right.label, "en")
    );
  });
}

export function sortEdges(edges: readonly KnowledgeGraphEdge[]): KnowledgeGraphEdge[] {
  return [...edges].sort((left, right) => {
    return (
      left.source.localeCompare(right.source, "en") ||
      left.target.localeCompare(right.target, "en") ||
      left.type.localeCompare(right.type, "en") ||
      left.explanation.localeCompare(right.explanation, "en")
    );
  });
}

function dedupeNodes(nodes: readonly KnowledgeGraphNode[]): KnowledgeGraphNode[] {
  const seen = new Set<string>();
  const result: KnowledgeGraphNode[] = [];
  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue;
    }
    seen.add(node.id);
    result.push(cloneNode(node));
  }
  return result;
}

function dedupeEdges(edges: readonly KnowledgeGraphEdge[]): KnowledgeGraphEdge[] {
  const seen = new Set<string>();
  const result: KnowledgeGraphEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.source}\0${edge.target}\0${edge.type}\0${edge.explanation}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push({ ...edge });
  }
  return result;
}

function cloneNode(node: KnowledgeGraphNode): KnowledgeGraphNode {
  const cloned: KnowledgeGraphNode = {
    id: node.id,
    type: node.type,
    label: node.label,
    source_filename: node.source_filename,
    source_section: node.source_section,
    locator_confirmed: node.locator_confirmed,
  };
  if (node.book_title) {
    cloned.book_title = node.book_title;
  }
  if (node.locator && node.locator.trim()) {
    cloned.locator = node.locator.trim();
  } else if (node.locator_confirmed === false) {
    // omit empty locator when unconfirmed, per GRAPH-001
  }
  return cloned;
}
