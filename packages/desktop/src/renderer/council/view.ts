import { escapeHtml } from "../../shared/error-boundary.ts";
import type { CouncilCitationView, CouncilUiState, CouncilUtteranceView } from "./types.ts";

export function renderCouncilPanel(state: CouncilUiState): string {
  const error = state.error
    ? `<p class="council-error" data-testid="council-error" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  const status = state.statusMessage
    ? `<p class="council-status" data-testid="council-status">${escapeHtml(state.statusMessage)}</p>`
    : "";
  const seats =
    state.seats.length > 0
      ? `<ul class="council-seats">${state.seats.map((seat) => renderSeat(seat, state.selectedSeatId)).join("")}</ul>`
      : `<p class="council-empty">席位尚未加载。</p>`;
  const utterances =
    state.utterances.length > 0
      ? `<ol class="council-utterances">${state.utterances.map(renderUtterance).join("")}</ol>`
      : "";

  return [
    `<section class="council-panel" data-testid="council-panel" data-adapter-kind="${escapeHtml(state.adapterKind)}">`,
    `<h2 class="council-title">智囊团席位</h2>`,
    `<p class="council-intro">在现有问题对话里向三个稳定席位提问，或召开至少两席依次发言再总结的圆桌。每条发言都会显示来源文件名。引用必须是夹具原文子串；未通过校验的内容不会当作已确认出处。</p>`,
    `<p class="council-adapter-label" data-testid="council-adapter-kind">${escapeHtml(adapterKindLabel(state.adapterKind))}</p>`,
    `<button type="button" class="council-enable-fixture" data-testid="council-enable-fixture">使用夹具演示适配器</button>`,
    seats,
    error,
    status,
    `<form class="council-form" data-testid="council-form">`,
    `<label class="council-label" for="council-question">向席位或圆桌提问</label>`,
    `<textarea id="council-question" class="council-question" data-testid="council-question" name="councilQuestion" rows="3" placeholder="例如：面对一次高风险决策，应当先摸清什么？">${escapeHtml(state.draftQuestion)}</textarea>`,
    `<div class="council-actions">`,
    `<button type="button" class="council-ask" data-testid="council-ask">向所选席位提问</button>`,
    `<button type="button" class="council-roundtable" data-testid="council-roundtable">召开圆桌</button>`,
    `</div>`,
    `</form>`,
    utterances,
    `</section>`,
  ].join("");
}

function adapterKindLabel(kind: CouncilUiState["adapterKind"]): string {
  if (kind === "fixture") {
    return "当前：夹具演示适配器（非在线模型）";
  }
  if (kind === "injected") {
    return "当前：测试注入适配器（非在线模型）";
  }
  return "当前：未配置生成适配器。未配置时不会假装成功。可显式启用夹具演示适配器。";
}

function renderSeat(
  seat: CouncilUiState["seats"][number],
  selectedSeatId: string | null,
): string {
  const selected = seat.seat_id === selectedSeatId ? "true" : "false";
  return [
    `<li class="council-seat-item">`,
    `<button type="button" class="council-seat" data-testid="council-seat-${escapeHtml(seat.seat_id)}"`,
    ` data-seat-id="${escapeHtml(seat.seat_id)}"`,
    ` data-selected="${selected}"`,
    ` data-skill-status="${escapeHtml(seat.skill_status)}">`,
    `<span class="council-seat-name">${escapeHtml(seat.name)}</span>`,
    `<span class="council-seat-book">《${escapeHtml(seat.book_title)}》</span>`,
    `<span class="council-seat-source" data-testid="council-seat-source-filename">${escapeHtml(seat.source_filename)}</span>`,
    `<span class="council-seat-status">${escapeHtml(seat.skill_status)}</span>`,
    `</button>`,
    `</li>`,
  ].join("");
}

function renderUtterance(utterance: CouncilUtteranceView): string {
  const summaryMarker =
    utterance.kind === "summary" ? ` data-testid-summary="council-summary"` : "";
  const citations =
    utterance.citations.length > 0
      ? `<ul class="council-citations">${utterance.citations.map(renderCitation).join("")}</ul>`
      : "";
  const summaryHook =
    utterance.kind === "summary" ? `<span hidden data-testid="council-summary"></span>` : "";
  return [
    `<li class="council-utterance" data-testid="council-utterance" data-kind="${escapeHtml(utterance.kind)}" data-seat-id="${escapeHtml(utterance.seat_id ?? "")}"${summaryMarker}>`,
    summaryHook,
    `<p class="council-speaker">${escapeHtml(utterance.speaker)}</p>`,
    `<div class="council-content">${escapeHtml(utterance.content)}</div>`,
    `<p class="council-source-filename" data-testid="council-source-filename">${escapeHtml(utterance.source_filename)}</p>`,
    citations,
    `</li>`,
  ].join("");
}

function renderCitation(citation: CouncilCitationView): string {
  const attribution = citation.attribution ? `——${escapeHtml(citation.attribution)}` : "";
  return [
    `<li class="council-citation" data-testid="council-citation" data-source-filename="${escapeHtml(citation.source_filename)}">`,
    `<span class="council-citation-quote">「${escapeHtml(citation.quote)}」</span>`,
    attribution,
    `<span class="council-citation-source">${escapeHtml(citation.source_filename)}</span>`,
    `</li>`,
  ].join("");
}
