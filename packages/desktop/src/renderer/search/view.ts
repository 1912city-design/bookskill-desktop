import type { SearchHit } from "@bookskill/core";
import { groupSearchHits } from "./group.ts";
import { escapeHtml, highlightSnippet } from "./highlight.ts";
import type { SearchUiState } from "./types.ts";

function renderHit(hit: SearchHit, visualIndex: number, selectedIndex: number): string {
  const locator = `${hit.source.bookTitle} · ${hit.source.locator}`;
  const cardId = hit.recordKind === "knowledge_card" ? hit.recordId : "";
  const selected = visualIndex === selectedIndex;
  const fragments = hit.matchedFragments ?? [];
  return [
    `<li class="search-hit${selected ? " is-selected" : ""}" data-testid="search-hit" id="search-hit-${visualIndex}"`,
    ` data-hit-index="${visualIndex}" data-selected="${selected ? "true" : "false"}" aria-selected="${selected ? "true" : "false"}"`,
    ` data-record-kind="${escapeHtml(hit.recordKind)}"`,
    ` data-content-type="${escapeHtml(hit.contentType)}" data-book-id="${escapeHtml(hit.source.bookId)}"`,
    ` data-chunk-id="${escapeHtml(hit.source.chunkId ?? "")}" data-paragraph-id="${escapeHtml(hit.source.paragraphId ?? "")}"`,
    ` data-card-id="${escapeHtml(cardId)}" data-record-id="${escapeHtml(hit.recordId)}">`,
    `<div class="search-hit-meta">`,
    `<span class="search-content-type" data-testid="search-content-type">${escapeHtml(hit.contentType)}</span>`,
    `<span class="search-locator" data-testid="search-locator">${escapeHtml(locator)}</span>`,
    `</div>`,
    `<p class="search-hit-title">${escapeHtml(hit.title)}</p>`,
    `<p class="search-hit-snippet">${highlightSnippet(hit.snippet, fragments)}</p>`,
    `<button type="button" class="search-jump" data-testid="search-jump">跳转到来源</button>`,
    `</li>`,
  ].join("");
}

export function renderSearchPanel(state: SearchUiState): string {
  const groups = groupSearchHits(state.results);
  const selectedIndex = state.selectedIndex ?? (state.searched && state.results.length > 0 ? 0 : -1);
  let visualIndex = 0;
  const groupedHtml = groups
    .map((group) => {
      const items = group.hits
        .map((hit) => {
          const html = renderHit(hit, visualIndex, selectedIndex);
          visualIndex += 1;
          return html;
        })
        .join("");
      return [
        `<section class="search-group" data-testid="search-group" data-content-type="${escapeHtml(group.contentType)}">`,
        `<h3 class="search-group-heading" data-testid="search-group-heading">${escapeHtml(group.contentType)}`,
        `<span class="search-group-count">（${group.hits.length}）</span></h3>`,
        `<ul class="search-group-list">${items}</ul>`,
        `</section>`,
      ].join("");
    })
    .join("");

  const results =
    !state.searched
      ? `<p class="search-hint" data-testid="search-idle">在已导入的书籍、摘录与知识卡中搜索。语义检索使用本机关键词扩展，不会调用托管向量服务。</p>`
      : state.results.length === 0
        ? `<p class="search-empty" data-testid="search-empty">没有匹配结果。</p>`
        : `<div class="search-results" data-testid="search-results">${groupedHtml}</div>`;
  const fallbackNote =
    state.mode === "semantic" || state.fallback === "local_keyword_expansion"
      ? `<p class="search-fallback" data-testid="search-fallback-note">语义路径为 V1 本机降级：关键词扩展 + 词面重叠 / Jaccard 排序。没有嵌入索引，也不会静默调用外部托管向量服务。</p>`
      : "";
  const status = state.statusMessage
    ? `<p class="search-status" data-testid="search-status">${escapeHtml(state.statusMessage)}</p>`
    : "";
  const error = state.error
    ? `<p class="search-error" data-testid="search-error">${escapeHtml(state.error)}</p>`
    : "";

  return [
    `<style>
      .search-surface { margin: 0 0 24px; padding: 16px 18px 18px; background: #fff; border: 1px solid var(--line, #d5cbb8); border-radius: 16px; box-shadow: var(--shadow, 0 16px 40px rgba(22, 34, 48, 0.08)); }
      .search-surface h2 { margin: 0 0 10px; font-size: 16px; }
      .search-form { display: grid; gap: 8px; grid-template-columns: 1fr auto; align-items: end; }
      .search-query { width: 100%; font: inherit; padding: 8px 10px; border: 1px solid var(--line, #d5cbb8); border-radius: 8px; }
      .search-mode { display: flex; gap: 16px; font-size: 13px; color: var(--ink-soft, #3d4a59); grid-column: 1 / -1; }
      .search-submit { appearance: none; border: 0; background: var(--copper, #c4652d); color: #fff; font: inherit; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
      .search-results { margin: 16px 0 0; padding: 0; display: grid; gap: 16px; }
      .search-group { margin: 0; padding: 0; }
      .search-group-heading { margin: 0 0 8px; font-size: 13px; font-weight: 650; color: var(--copper-dark, #8f4320); }
      .search-group-count { font-weight: 500; color: var(--ink-soft, #3d4a59); }
      .search-group-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
      .search-hit { border: 1px solid var(--line, #d5cbb8); border-radius: 10px; padding: 10px 12px; background: var(--paper, #f6f1e8); }
      .search-hit.is-selected, .search-hit[data-selected="true"] { border-color: var(--copper, #c4652d); box-shadow: 0 0 0 2px rgba(196, 101, 45, 0.25); }
      .search-hit-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-bottom: 6px; font-size: 12px; }
      .search-content-type { font-weight: 650; color: var(--copper-dark, #8f4320); }
      .search-locator { color: var(--ink-soft, #3d4a59); }
      .search-hit-title { margin: 0 0 4px; font-size: 14px; font-weight: 650; }
      .search-hit-snippet { margin: 0 0 8px; font-size: 13px; line-height: 1.55; color: var(--ink-soft, #3d4a59); }
      .search-hit-snippet mark { background: #f6e2b8; color: inherit; padding: 0 0.1em; border-radius: 2px; }
      .search-jump { appearance: none; border: 1px solid var(--line, #d5cbb8); background: #fff; font: inherit; font-size: 12px; padding: 4px 8px; border-radius: 6px; cursor: pointer; }
      .search-hint, .search-empty, .search-fallback, .search-status, .search-error { margin: 12px 0 0; font-size: 13px; line-height: 1.55; color: var(--ink-soft, #3d4a59); }
      .search-error { color: var(--danger, #8b1e1e); }
    </style>`,
    `<section class="search-surface" data-testid="search-surface">`,
    `<h2>搜索</h2>`,
    `<form class="search-form" data-testid="search-form">`,
    `<input class="search-query" data-testid="search-query" type="search" name="query" value="${escapeHtml(state.query)}" placeholder="搜索书籍原文、摘录与知识卡" />`,
    `<button class="search-submit" data-testid="search-submit" type="submit">搜索</button>`,
    `<div class="search-mode" data-testid="search-mode">`,
    `<label><input type="radio" name="search-mode" value="fulltext"${state.mode === "fulltext" ? " checked" : ""} /> 全文</label>`,
    `<label><input type="radio" name="search-mode" value="semantic"${state.mode === "semantic" ? " checked" : ""} /> 语义（本机降级）</label>`,
    `</div>`,
    `</form>`,
    fallbackNote,
    status,
    error,
    results,
    `</section>`,
  ].join("");
}
