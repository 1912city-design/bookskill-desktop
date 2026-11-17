import type { LockedSectionId } from "../distill/types.ts";

export type GraphNodeType = "positioning" | "principle" | "quote" | "framework" | "skill";

export type GraphEdgeType = "applies_to" | "supports" | "derived_from" | "cites";

export interface KnowledgeGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  book_title?: string;
  source_filename: string;
  source_section: LockedSectionId;
  locator?: string;
  locator_confirmed: boolean;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: GraphEdgeType;
  explanation: string;
  explanation_confirmed: boolean;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export type BuildKnowledgeGraphInput = {
  distillations: readonly unknown[];
};

export type LoadKnowledgeGraphInput = {
  dataDir: string;
};

export type SaveKnowledgeGraphInput = {
  dataDir: string;
  graph: KnowledgeGraph;
};
