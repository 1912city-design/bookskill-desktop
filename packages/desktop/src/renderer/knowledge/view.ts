import { escapeHtml } from "../../shared/error-boundary.ts";
import { knowledgeStatusLabel, type KnowledgeCardView, type KnowledgeUiState } from "./types.ts";

function formatLocator(source: KnowledgeCardView["sources"][number]): string {
  const book = source.bookTitle ? source.bookTitle : "原书";
  const paragraph = source.paragraphId ? source.paragraphId : "定位未著录";
  return `${book} · ${paragraph}`;
}

function renderLocatorProof(state: KnowledgeUiState): string {
  if (state.locatorProof.length === 0) {
    return "";
  }
  const items = state.locatorProof
    .map((proof) => {
      const locator = proof.paragraphId ?? proof.sourceChunkId;
      const usable = proof.bookPresent && proof.locatorUsable ? "仍可用" : "未能核验";
      return `<li data-testid="locator-proof-item" data-book-id="${escapeHtml(proof.bookId)}" data-usable="${proof.locatorUsable ? "true" : "false"}">${escapeHtml(proof.bookTitle)} · ${escapeHtml(locator)} ${usable}</li>`;
    })
    .join("");
  return `<div class="knowledge-proof" data-testid="locator-proof"><p>删除或合并后，原书与定位仍在：</p><ul>${items}</ul></div>`;
}

function renderCardList(state: KnowledgeUiState): string {
  if (state.cards.length === 0) {
    return `<p class="knowledge-empty" data-testid="knowledge-empty">还没有知识卡。可从已导入书籍的段落定位符生成一张草稿。</p>`;
  }
  const items = state.cards
    .map((card) => {
      const selected = card.id === state.selectedCardId;
      const sources = card.sources
        .map(
          (source) =>
            `<li class="knowledge-source" data-testid="card-source" data-source-chunk-id="${escapeHtml(source.sourceChunkId)}" data-paragraph-id="${escapeHtml(source.paragraphId ?? "")}">${escapeHtml(formatLocator(source))} · ${escapeHtml(source.relationType)}</li>`,
        )
        .join("");
      return [
        `<article class="knowledge-card" data-testid="knowledge-card" data-card-id="${escapeHtml(card.id)}" data-status="${escapeHtml(card.status)}" data-selected="${selected ? "true" : "false"}">`,
        `<button type="button" class="knowledge-card-open" data-testid="open-card" data-card-id="${escapeHtml(card.id)}">`,
        `<span class="knowledge-card-title">${escapeHtml(card.title)}</span>`,
        `<span class="knowledge-card-meta">`,
        `<span class="knowledge-status" data-testid="card-status" data-status="${escapeHtml(card.status)}">${escapeHtml(knowledgeStatusLabel(card.status))}</span>`,
        `<span class="knowledge-status-code" data-testid="card-status-code">${escapeHtml(card.status)}</span>`,
        `</span>`,
        `</button>`,
        `<ul class="knowledge-source-list" data-testid="card-sources">${sources}</ul>`,
        `</article>`,
      ].join("");
    })
    .join("");
  return `<div class="knowledge-card-list" data-testid="knowledge-card-list">${items}</div>`;
}

function renderDraftForm(state: KnowledgeUiState): string {
  const options = state.books
    .map((book) => {
      const selected = book.id === state.draftBookId ? " selected" : "";
      const disabled = book.parseStatus !== "parsed" ? " disabled" : "";
      return `<option value="${escapeHtml(book.id)}"${selected}${disabled}>${escapeHtml(book.title)}</option>`;
    })
    .join("");
  return [
    `<form class="knowledge-draft-form" data-testid="draft-form">`,
    `<h2>从段落生成草稿</h2>`,
    `<label class="knowledge-label" for="draft-book">已导入书籍</label>`,
    `<select id="draft-book" class="knowledge-input" data-testid="draft-book" name="bookId">`,
    `<option value="">选择一本书</option>`,
    options,
    `</select>`,
    `<label class="knowledge-label" for="draft-paragraph">段落定位符</label>`,
    `<input id="draft-paragraph" class="knowledge-input" data-testid="draft-paragraph" name="paragraphId" value="${escapeHtml(state.draftParagraphId)}" placeholder="例如 P1.3" />`,
    `<button type="submit" class="knowledge-secondary" data-testid="draft-submit">生成草稿</button>`,
    `</form>`,
  ].join("");
}

function renderEditor(state: KnowledgeUiState): string {
  const selected = state.cards.find((card) => card.id === state.selectedCardId);
  if (!selected) {
    return `<p class="knowledge-editor-empty" data-testid="knowledge-editor-empty">选择一张知识卡后，可以编辑、确认、合并或删除。</p>`;
  }
  const mergeOptions = state.cards
    .filter((card) => card.id !== selected.id)
    .map((card) => {
      const selectedOption = card.id === state.mergeTargetId ? " selected" : "";
      return `<option value="${escapeHtml(card.id)}"${selectedOption}>${escapeHtml(card.title)}</option>`;
    })
    .join("");
  const confirmDisabled = selected.status === "verified_by_user" ? " disabled" : "";
  const mergeDisabled = state.cards.length < 2 ? " disabled" : "";
  return [
    `<form class="knowledge-editor" data-testid="knowledge-editor" data-card-id="${escapeHtml(selected.id)}">`,
    `<h2>编辑知识卡</h2>`,
    `<p class="knowledge-editor-status">当前状态：<span data-testid="editor-status" data-status="${escapeHtml(selected.status)}">${escapeHtml(knowledgeStatusLabel(selected.status))}</span> <code data-testid="editor-status-code">${escapeHtml(selected.status)}</code></p>`,
    `<label class="knowledge-label" for="edit-title">标题</label>`,
    `<input id="edit-title" class="knowledge-input" data-testid="edit-title" name="title" value="${escapeHtml(state.editTitle)}" />`,
    `<label class="knowledge-label" for="edit-content">正文</label>`,
    `<textarea id="edit-content" class="knowledge-input knowledge-textarea" data-testid="edit-content" name="content" rows="6">${escapeHtml(state.editContent)}</textarea>`,
    `<label class="knowledge-label" for="edit-conditions">适用条件</label>`,
    `<textarea id="edit-conditions" class="knowledge-input knowledge-textarea" data-testid="edit-conditions" name="conditions" rows="3">${escapeHtml(state.editConditions)}</textarea>`,
    `<label class="knowledge-label" for="edit-limitations">局限</label>`,
    `<textarea id="edit-limitations" class="knowledge-input knowledge-textarea" data-testid="edit-limitations" name="limitations" rows="3">${escapeHtml(state.editLimitations)}</textarea>`,
    `<div class="knowledge-actions">`,
    `<button type="submit" class="knowledge-secondary" data-testid="save-card">保存编辑</button>`,
    `<button type="button" class="knowledge-primary" data-testid="confirm-card"${confirmDisabled}>确认</button>`,
    `<button type="button" class="knowledge-danger" data-testid="delete-card">删除</button>`,
    `</div>`,
    `</form>`,
    `<form class="knowledge-merge-form" data-testid="merge-form">`,
    `<h2>合并到当前卡片</h2>`,
    `<p class="knowledge-help">被吸收的卡片会被删除，来源会去重后保留在当前卡片上。合并不会把草稿自动变为已确认。</p>`,
    `<label class="knowledge-label" for="merge-target">要吸收的卡片</label>`,
    `<select id="merge-target" class="knowledge-input" data-testid="merge-target" name="absorbedCardId">`,
    `<option value="">选择一张要吸收的卡片</option>`,
    mergeOptions,
    `</select>`,
    `<button type="submit" class="knowledge-secondary" data-testid="merge-submit"${mergeDisabled}>合并</button>`,
    `</form>`,
  ].join("");
}

export function renderKnowledgeRoute(state: KnowledgeUiState): string {
  const error = state.error
    ? `<p class="knowledge-error" data-testid="knowledge-error" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  const message = state.statusMessage
    ? `<p class="knowledge-message" data-testid="knowledge-message">${escapeHtml(state.statusMessage)}</p>`
    : "";
  return [
    `<div class="knowledge-surface" data-testid="knowledge-surface">`,
    error,
    message,
    renderLocatorProof(state),
    `<div class="knowledge-layout">`,
    `<section class="knowledge-list-pane">`,
    `<p class="knowledge-lead">知识卡从来源生成时为草稿（draft）。只有你点「确认」后才会变为已确认（verified_by_user）。AI 不会自动确认卡片，也不会自动发布 Skill。</p>`,
    renderDraftForm(state),
    renderCardList(state),
    `</section>`,
    `<section class="knowledge-detail-pane">`,
    renderEditor(state),
    `</section>`,
    `</div>`,
    `</div>`,
  ].join("");
}
