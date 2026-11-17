export const GRAPH_UNCONFIRMED_LOCATION_LABEL = "来源定位未确认";

export const GRAPH_NODE_TYPES = ["positioning", "principle", "quote", "framework", "skill"] as const;

export type GraphNodeType = (typeof GRAPH_NODE_TYPES)[number];

export const GRAPH_EDGE_TYPES = ["applies_to", "supports", "derived_from", "cites"] as const;

export type GraphEdgeType = (typeof GRAPH_EDGE_TYPES)[number];

export const GRAPH_NODE_TYPE_LABELS: Record<GraphNodeType, string> = {
  positioning: "核心定位",
  principle: "原则与应用",
  quote: "金句",
  framework: "应用框架",
  skill: "可调用Skill",
};

export const GRAPH_EDGE_TYPE_LABELS: Record<GraphEdgeType, string> = {
  applies_to: "应用于",
  supports: "支持",
  derived_from: "来源于",
  cites: "引用",
};

export type KnowledgeGraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  book_title?: string;
  source_filename: string;
  source_section: 1 | 2 | 3 | 4 | 5;
  locator?: string;
  locator_confirmed: boolean;
};

export type KnowledgeGraphEdge = {
  source: string;
  target: string;
  type: GraphEdgeType;
  explanation: string;
  explanation_confirmed: boolean;
};

export type KnowledgeGraph = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
};

export type GraphBookGroup = {
  book_title: string;
  source_filename: string;
  nodeIds: string[];
  edgeCount: number;
  typeCounts: Record<GraphNodeType, number>;
};

export type KnowledgeGraphView = KnowledgeGraph & {
  groups: GraphBookGroup[];
};

export type GraphLocateView = {
  nodeId: string;
  label: string;
  source_filename: string;
  book_title?: string;
  source_section: 1 | 2 | 3 | 4 | 5;
  locator?: string;
  locator_confirmed: boolean;
  unconfirmed: boolean;
  unconfirmedLabel: string | null;
  passage: string | null;
};

export type GraphUiState = {
  loaded: boolean;
  view: KnowledgeGraphView;
  selectedNodeId: string | null;
  locate: GraphLocateView | null;
  error: string | null;
};

export function emptyKnowledgeGraphView(): KnowledgeGraphView {
  return { nodes: [], edges: [], groups: [] };
}

export function emptyGraphUiState(): GraphUiState {
  return {
    loaded: false,
    view: emptyKnowledgeGraphView(),
    selectedNodeId: null,
    locate: null,
    error: null,
  };
}

export function emptyTypeCounts(): Record<GraphNodeType, number> {
  return {
    positioning: 0,
    principle: 0,
    quote: 0,
    framework: 0,
    skill: 0,
  };
}

export function groupKnowledgeGraph(graph: KnowledgeGraph): GraphBookGroup[] {
  const groups = new Map<string, GraphBookGroup>();
  for (const node of graph.nodes) {
    const key = node.source_filename || node.book_title || "unknown";
    let group = groups.get(key);
    if (!group) {
      group = {
        book_title: node.book_title?.trim() || node.source_filename,
        source_filename: node.source_filename,
        nodeIds: [],
        edgeCount: 0,
        typeCounts: emptyTypeCounts(),
      };
      groups.set(key, group);
    }
    group.nodeIds.push(node.id);
    group.typeCounts[node.type] += 1;
    if (node.book_title && !group.book_title) {
      group.book_title = node.book_title;
    }
  }
  const nodeBook = new Map(graph.nodes.map((node) => [node.id, node.source_filename]));
  for (const edge of graph.edges) {
    const filename = nodeBook.get(edge.source) ?? nodeBook.get(edge.target);
    if (!filename) {
      continue;
    }
    const group = groups.get(filename);
    if (group) {
      group.edgeCount += 1;
    }
  }
  return [...groups.values()].sort((left, right) => left.source_filename.localeCompare(right.source_filename, "en"));
}

export function toKnowledgeGraphView(graph: KnowledgeGraph): KnowledgeGraphView {
  return {
    nodes: graph.nodes,
    edges: graph.edges,
    groups: groupKnowledgeGraph(graph),
  };
}
