import { escapeHtml } from "../../shared/error-boundary.ts";
import type { ChatClaimView, ChatTurnView, ChatUiState } from "./types.ts";

export function renderChatRoute(state: ChatUiState): string {
  const error = state.error
    ? `<p class="chat-error" data-testid="chat-error" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  const status = state.statusMessage
    ? `<p class="chat-status" data-testid="chat-status">${escapeHtml(state.statusMessage)}</p>`
    : "";
  const turns =
    state.conversation && state.conversation.turns.length > 0
      ? `<ol class="chat-turns" data-testid="chat-turns">${state.conversation.turns.map(renderTurn).join("")}</ol>`
      : `<p class="chat-empty" data-testid="chat-empty">还没有对话。导入许可的书籍后，可以在这里提问并查看原书来源。</p>`;

  return [
    `<div class="chat-surface" data-testid="chat-surface">`,
    error,
    status,
    turns,
    `<form class="chat-form" data-testid="chat-form">`,
    `<label class="chat-label" for="chat-input">提问</label>`,
    `<textarea id="chat-input" class="chat-input" data-testid="chat-input" name="question" rows="3" placeholder="例如：这条原则的原书出处是什么？">${escapeHtml(state.draftQuestion)}</textarea>`,
    `<button type="submit" class="chat-send" data-testid="chat-send">发送</button>`,
    `</form>`,
    `</div>`,
  ].join("");
}

function renderTurn(turn: ChatTurnView): string {
  const role = turn.role === "user" ? "你" : "回答";
  const sources =
    turn.role === "assistant" && turn.claims.length > 0
      ? `<ul class="chat-sources" data-testid="chat-sources">${turn.claims.map(renderSource).join("")}</ul>`
      : "";
  return [
    `<li class="chat-turn" data-testid="chat-turn" data-role="${escapeHtml(turn.role)}" data-turn-id="${escapeHtml(turn.id)}">`,
    `<p class="chat-turn-role">${role}</p>`,
    `<div class="chat-turn-content" data-testid="chat-turn-content">${escapeHtml(turn.content)}</div>`,
    sources,
    `</li>`,
  ].join("");
}

function renderSource(claim: ChatClaimView): string {
  const paragraph = claim.paragraphId ? `[${claim.paragraphId}]` : "";
  const label =
    claim.grounding === "sourced"
      ? [claim.bookTitle ?? "原书", claim.chapter ?? "未知章节", paragraph].filter(Boolean).join(" / ")
      : (claim.label ?? "模型建议/一般推断");
  const text = claim.text ? `<span class="chat-source-text">${escapeHtml(claim.text)}</span>` : "";
  return [
    `<li class="chat-source" data-testid="chat-source"`,
    ` data-grounding="${escapeHtml(claim.grounding)}"`,
    ` data-paragraph-id="${escapeHtml(claim.paragraphId ?? "")}"`,
    ` data-book-title="${escapeHtml(claim.bookTitle ?? "")}"`,
    ` data-chapter="${escapeHtml(claim.chapter ?? "")}"`,
    ` data-claim-id="${escapeHtml(claim.id)}"`,
    ` data-source-chunk-id="${escapeHtml(claim.sourceChunkId ?? "")}">`,
    `<span class="chat-source-label">${escapeHtml(label)}</span>`,
    text,
    `</li>`,
  ].join("");
}
