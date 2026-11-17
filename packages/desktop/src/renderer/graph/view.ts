import { escapeHtml } from "../../shared/error-boundary.ts";
import {
  GRAPH_EDGE_TYPE_LABELS,
  GRAPH_NODE_TYPE_LABELS,
  GRAPH_NODE_TYPES,
  GRAPH_UNCONFIRMED_LOCATION_LABEL,
  type GraphBookGroup,
  type GraphLocateView,
  type GraphUiState,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
} from "./types.ts";

function nodeById(state: GraphUiState, id: string): KnowledgeGraphNode | undefined {
  return state.view.nodes.find((node) => node.id === id);
}

function renderError(state: GraphUiState): string {
  if (!state.error) {
    return "";
  }
  return `<p class="library-graph-error" data-testid="library-graph-error" role="alert">${escapeHtml(state.error)}</p>`;
}

function renderLifeGraph(groups: readonly GraphBookGroup[]): string {
  if (groups.length === 0) {
    return "";
  }
  const items = groups
    .map((group) => {
      const counts = GRAPH_NODE_TYPES.map((type) => {
        const count = group.typeCounts[type];
        return `<span class="library-graph-life-count" data-type="${escapeHtml(type)}">${escapeHtml(GRAPH_NODE_TYPE_LABELS[type])} ${count}</span>`;
      }).join("");
      return [
        `<li class="library-graph-life-item" data-testid="library-graph-life-item" data-source-filename="${escapeHtml(group.source_filename)}">`,
        `<span class="library-graph-life-title">${escapeHtml(group.book_title)}</span>`,
        `<span class="library-graph-life-meta">${group.nodeIds.length} 个节点 · ${group.edgeCount} 条边</span>`,
        `<span class="library-graph-life-counts">${counts}</span>`,
        `</li>`,
      ].join("");
    })
    .join("");
  return [
    `<section class="library-graph-life" data-testid="library-graph-life">`,
    `<h3>生命图谱（按书聚合）</h3>`,
    `<ul class="library-graph-life-list">${items}</ul>`,
    `</section>`,
  ].join("");
}

function renderNode(state: GraphUiState, node: KnowledgeGraphNode): string {
  const selected = node.id === state.selectedNodeId;
  const confirmed = node.locator_confirmed && Boolean(node.locator);
  return [
    `<button type="button" class="library-graph-node" data-testid="library-graph-node"`,
    ` data-node-id="${escapeHtml(node.id)}"`,
    ` data-type="${escapeHtml(node.type)}"`,
    ` data-source-filename="${escapeHtml(node.source_filename)}"`,
    ` data-section="${node.source_section}"`,
    ` data-confirmed="${confirmed ? "true" : "false"}"`,
    ` data-selected="${selected ? "true" : "false"}">`,
    `<span class="library-graph-node-type">${escapeHtml(GRAPH_NODE_TYPE_LABELS[node.type])}</span>`,
    `<span class="library-graph-node-label">${escapeHtml(node.label)}</span>`,
    confirmed
      ? `<span class="library-graph-node-locator">${escapeHtml(node.locator ?? "")}</span>`
      : `<span class="library-graph-node-locator library-graph-node-unconfirmed">${escapeHtml(GRAPH_UNCONFIRMED_LOCATION_LABEL)}</span>`,
    `</button>`,
  ].join("");
}

function renderEdge(state: GraphUiState, edge: KnowledgeGraphEdge): string {
  const source = nodeById(state, edge.source);
  const target = nodeById(state, edge.target);
  const explanation = edge.explanation_confirmed
    ? escapeHtml(edge.explanation)
    : `${escapeHtml(edge.explanation)} <span class="library-graph-inferred">未确认</span>`;
  return [
    `<li class="library-graph-edge" data-testid="library-graph-edge"`,
    ` data-source="${escapeHtml(edge.source)}"`,
    ` data-target="${escapeHtml(edge.target)}"`,
    ` data-type="${escapeHtml(edge.type)}"`,
    ` data-explanation-confirmed="${edge.explanation_confirmed ? "true" : "false"}">`,
    `<span class="library-graph-edge-type">${escapeHtml(GRAPH_EDGE_TYPE_LABELS[edge.type])}</span>`,
    `<span class="library-graph-edge-ends">${escapeHtml(source?.label ?? edge.source)} → ${escapeHtml(target?.label ?? edge.target)}</span>`,
    `<span class="library-graph-edge-explanation">${explanation}</span>`,
    `</li>`,
  ].join("");
}

function renderBookGroup(state: GraphUiState, group: GraphBookGroup): string {
  const nodes = group.nodeIds
    .map((id) => nodeById(state, id))
    .filter((node): node is KnowledgeGraphNode => Boolean(node));
  const nodeHtml = nodes.map((node) => renderNode(state, node)).join("");
  const edges = state.view.edges.filter((edge) => group.nodeIds.includes(edge.source) || group.nodeIds.includes(edge.target));
  const edgeHtml = edges.map((edge) => renderEdge(state, edge)).join("");
  return [
    `<section class="library-graph-book-group" data-testid="library-graph-book-group"`,
    ` data-source-filename="${escapeHtml(group.source_filename)}"`,
    ` data-book-title="${escapeHtml(group.book_title)}">`,
    `<h3 class="library-graph-book-title">${escapeHtml(group.book_title)}</h3>`,
    `<p class="library-graph-book-meta">${escapeHtml(group.source_filename)} · ${group.nodeIds.length} 个节点 · ${group.edgeCount} 条边</p>`,
    `<div class="library-graph-nodes" data-testid="library-graph-nodes">${nodeHtml}</div>`,
    edges.length > 0
      ? `<ul class="library-graph-edges" data-testid="library-graph-edges">${edgeHtml}</ul>`
      : "",
    `</section>`,
  ].join("");
}

function renderLocate(locate: GraphLocateView | null): string {
  if (!locate) {
    return `<p class="library-graph-locate-empty" data-testid="library-graph-locate-empty">点击节点可跳转到对应段落。定位必须是夹具原文子串，否则会标明「${escapeHtml(GRAPH_UNCONFIRMED_LOCATION_LABEL)}」。</p>`;
  }
  const unconfirmed = locate.unconfirmed
    ? `<p class="library-graph-unconfirmed" data-testid="library-graph-unconfirmed">${escapeHtml(locate.unconfirmedLabel || GRAPH_UNCONFIRMED_LOCATION_LABEL)}</p>`
    : "";
  const passage = locate.passage
    ? `<blockquote class="library-graph-passage" data-testid="library-graph-passage">${escapeHtml(locate.passage)}</blockquote>`
    : "";
  const locator = locate.locator && locate.locator_confirmed
    ? `<p class="library-graph-locator" data-testid="library-graph-locator">${escapeHtml(locate.locator)}</p>`
    : "";
  return [
    `<div class="library-graph-locate" data-testid="library-graph-locate"`,
    ` data-node-id="${escapeHtml(locate.nodeId)}"`,
    ` data-source-filename="${escapeHtml(locate.source_filename)}"`,
    ` data-confirmed="${locate.locator_confirmed && !locate.unconfirmed ? "true" : "false"}">`,
    `<h3>定位：${escapeHtml(locate.label)}</h3>`,
    `<p class="library-graph-locate-source">${escapeHtml(locate.source_filename)}</p>`,
    locator,
    unconfirmed,
    passage,
    `</div>`,
  ].join("");
}

export function renderLibraryGraph(state: GraphUiState): string {
  const empty =
    state.view.nodes.length === 0
      ? `<p class="library-graph-empty" data-testid="library-graph-empty">还没有可展示的知识图谱。导入已校验的蒸馏结果后，可在此按书查看节点与边。</p>`
      : "";
  const groups = state.view.groups.map((group) => renderBookGroup(state, group)).join("");
  return [
    `<section class="library-graph" data-testid="library-graph">`,
    `<div class="library-graph-header">`,
    `<h2>知识图谱</h2>`,
    `<p class="library-graph-lead">按书聚合展示已校验蒸馏中的节点与边。点击节点跳到对应段落；出处若不是夹具原文子串，将标明未确认，不会伪造定位。</p>`,
    `</div>`,
    renderError(state),
    renderLifeGraph(state.view.groups),
    empty,
    groups,
    renderLocate(state.locate),
    `</section>`,
  ].join("");
}
