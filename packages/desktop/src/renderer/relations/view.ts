import { escapeHtml } from "../../shared/error-boundary.ts";
import type { KnowledgeCardView } from "../knowledge/types.ts";
import {
  RELATION_TYPE_OPTIONS,
  relationStatusLabel,
  relationTypeLabel,
  type KnowledgeRelationView,
  type RelationsUiState,
} from "./types.ts";

function renderCardOptions(cards: KnowledgeCardView[], selectedId: string, emptyLabel: string): string {
  const options = cards
    .map((card) => {
      const selected = card.id === selectedId ? " selected" : "";
      return `<option value="${escapeHtml(card.id)}"${selected}>${escapeHtml(card.title)}</option>`;
    })
    .join("");
  return `<option value="">${escapeHtml(emptyLabel)}</option>${options}`;
}

function renderRelationItem(relation: KnowledgeRelationView, actions: string): string {
  return [
    `<article class="knowledge-card" data-testid="relation-item" data-relation-id="${escapeHtml(relation.id)}" data-status="${escapeHtml(relation.status)}" data-relation-type="${escapeHtml(relation.relationType)}">`,
    `<p class="knowledge-card-title">${escapeHtml(relation.fromCardTitle)} → ${escapeHtml(relation.toCardTitle)}</p>`,
    `<p class="knowledge-card-meta">`,
    `<span class="knowledge-status" data-testid="relation-status" data-status="${escapeHtml(relation.status)}">${escapeHtml(relationStatusLabel(relation.status))}</span>`,
    `<span class="knowledge-status-code" data-testid="relation-status-code">${escapeHtml(relation.status)}</span>`,
    `<span data-testid="relation-type">${escapeHtml(relationTypeLabel(relation.relationType))}</span>`,
    `</p>`,
    actions,
    `</article>`,
  ].join("");
}

function renderSuggestedList(state: RelationsUiState): string {
  if (state.suggested.length === 0) {
    return `<p class="knowledge-empty" data-testid="suggested-relations-empty">目前没有待确认的关系建议。</p>`;
  }
  const items = state.suggested
    .map((relation) =>
      renderRelationItem(
        relation,
        [
          `<div class="knowledge-actions">`,
          `<button type="button" class="knowledge-primary" data-testid="confirm-relation" data-relation-id="${escapeHtml(relation.id)}">确认关系</button>`,
          `<button type="button" class="knowledge-danger" data-testid="reject-relation" data-relation-id="${escapeHtml(relation.id)}">驳回建议</button>`,
          `</div>`,
        ].join(""),
      ),
    )
    .join("");
  return `<div class="knowledge-card-list" data-testid="suggested-relations">${items}</div>`;
}

function renderConfirmedList(state: RelationsUiState): string {
  if (state.confirmed.length === 0) {
    return `<p class="knowledge-empty" data-testid="confirmed-relations-empty">还没有已确认的正式关系。</p>`;
  }
  const items = state.confirmed
    .map((relation) => renderRelationItem(relation, ""))
    .join("");
  return `<div class="knowledge-card-list" data-testid="confirmed-relations">${items}</div>`;
}

function renderSuggestForm(state: RelationsUiState, cards: KnowledgeCardView[]): string {
  const typeOptions = RELATION_TYPE_OPTIONS.map((option) => {
    const selected = option.value === state.relationType ? " selected" : "";
    return `<option value="${escapeHtml(option.value)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
  const disabled = cards.length < 2 ? " disabled" : "";
  return [
    `<form class="knowledge-draft-form" data-testid="suggest-relation-form">`,
    `<h2>建议知识关系</h2>`,
    `<p class="knowledge-help">规则只能建议两张知识卡之间的关系。建议在你点「确认关系」之前不会出现在已确认列表中，也不会自动变成正式关系。</p>`,
    `<label class="knowledge-label" for="relation-from">起始知识卡</label>`,
    `<select id="relation-from" class="knowledge-input" data-testid="relation-from" name="fromCardId">`,
    renderCardOptions(cards, state.fromCardId, "选择起始知识卡"),
    `</select>`,
    `<label class="knowledge-label" for="relation-to">目标知识卡</label>`,
    `<select id="relation-to" class="knowledge-input" data-testid="relation-to" name="toCardId">`,
    renderCardOptions(cards, state.toCardId, "选择目标知识卡"),
    `</select>`,
    `<label class="knowledge-label" for="relation-type">关系类型</label>`,
    `<select id="relation-type" class="knowledge-input" data-testid="relation-type-input" name="relationType">`,
    typeOptions,
    `</select>`,
    `<button type="submit" class="knowledge-secondary" data-testid="suggest-relation"${disabled}>生成建议</button>`,
    `</form>`,
  ].join("");
}

export function renderRelationsRoute(state: RelationsUiState, cards: KnowledgeCardView[] = []): string {
  const error = state.error
    ? `<p class="knowledge-error" data-testid="relations-error" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  const message = state.statusMessage
    ? `<p class="knowledge-message" data-testid="relations-message">${escapeHtml(state.statusMessage)}</p>`
    : "";
  return [
    `<div class="knowledge-surface" data-testid="relations-surface">`,
    error,
    message,
    `<div class="knowledge-layout">`,
    `<section class="knowledge-list-pane">`,
    `<p class="knowledge-lead">知识卡之间的关系先以建议出现（suggested）。只有你确认后才会变为正式关系（verified_by_user）。驳回后不会残留为正式关系。</p>`,
    renderSuggestForm(state, cards),
    `</section>`,
    `<section class="knowledge-detail-pane">`,
    `<div class="knowledge-editor">`,
    `<h2>待确认的建议</h2>`,
    renderSuggestedList(state),
    `<h2>已确认的正式关系</h2>`,
    renderConfirmedList(state),
    `</div>`,
    `</section>`,
    `</div>`,
    `</div>`,
  ].join("");
}
