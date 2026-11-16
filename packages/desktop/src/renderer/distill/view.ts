import { escapeHtml } from "../../shared/error-boundary.ts";
import {
  DISTILL_UNCONFIRMED_LOCATION_LABEL,
  LOCKED_SECTION_TITLES,
  type DistillUiState,
  type DistillationPreviewView,
  type DistillationSection,
} from "./types.ts";

export function renderDistillRoute(state: DistillUiState): string {
  if (state.phase === "running") {
    return renderDistillShell(
      state,
      `<p class="distill-progress" data-testid="distill-progress" data-phase="running">正在蒸馏，请稍候…</p>`,
    );
  }
  if (state.phase === "failed") {
    const reason = state.error ?? "蒸馏失败。";
    return renderDistillShell(
      state,
      [
        `<p class="distill-error" data-testid="distill-error" role="alert">${escapeHtml(reason)}</p>`,
        renderImportControl(),
      ].join(""),
    );
  }
  if (state.phase === "preview" && state.preview) {
    const error = state.error
      ? `<p class="distill-error" data-testid="distill-error" role="alert">${escapeHtml(state.error)}</p>`
      : "";
    return renderDistillShell(state, `${error}${renderDistillPreview(state.preview, state.viewMode)}`);
  }
  return renderDistillShell(state, renderImportControl());
}

function renderDistillShell(state: DistillUiState, body: string): string {
  const book = state.bookTitle
    ? `<p class="distill-book-label">书籍：${escapeHtml(state.bookTitle)}</p>`
    : "";
  return [
    `<div class="distill-surface" data-testid="distill-surface" data-phase="${escapeHtml(state.phase)}">`,
    `<div class="distill-toolbar">`,
    `<button type="button" class="distill-back" data-testid="distill-back">返回书库</button>`,
    `</div>`,
    book,
    body,
    `</div>`,
  ].join("");
}

function renderImportControl(): string {
  return [
    `<div class="distill-import-bar">`,
    `<label class="distill-import-label" for="distill-import-markdown-file">导入已有的 5 段蒸馏 Markdown</label>`,
    `<input type="file" id="distill-import-markdown-file" class="distill-import-file" data-testid="distill-import-markdown-file" accept=".md,.markdown,text/markdown">`,
    `</div>`,
  ].join("");
}

export function renderDistillPreview(
  preview: DistillationPreviewView,
  viewMode: DistillUiState["viewMode"] = "preview",
): string {
  const sourceFilename = preview.sourceFilename
    ? escapeHtml(preview.sourceFilename)
    : "未提供源文件名";
  const locator = escapeHtml(preview.locatorLabel || DISTILL_UNCONFIRMED_LOCATION_LABEL);
  const mode = viewMode;
  const sections = LOCKED_SECTION_TITLES.map((title, index) => {
    const section =
      preview.sections.find((item) => item.id === index + 1) ??
      preview.sections.find((item) => item.title === title);
    return renderSection(title, index + 1, section);
  }).join("");
  const skills =
    preview.skills.length === 0
      ? ""
      : `<div class="distill-skills">${preview.skills.map(renderSkill).join("")}</div>`;
  const markdownView =
    mode === "markdown"
      ? `<pre class="distill-raw" data-testid="distill-markdown">${escapeHtml(preview.markdown)}</pre>`
      : "";
  const jsonView =
    mode === "json"
      ? `<pre class="distill-raw" data-testid="distill-json">${escapeHtml(preview.json)}</pre>`
      : "";
  const structured = mode === "preview" ? `${sections}${skills}` : "";

  return [
    `<div class="distill-preview" data-testid="distill-preview" data-view="${escapeHtml(mode)}">`,
    `<p class="distill-source-filename" data-testid="distill-source-filename">${sourceFilename}</p>`,
    `<p class="distill-locator" data-testid="distill-locator" data-confirmed="${preview.locatorConfirmed ? "true" : "false"}">${locator}</p>`,
    `<div class="distill-view-toggle">`,
    `<button type="button" class="distill-view-button" data-testid="distill-view-preview" data-active="${mode === "preview" ? "true" : "false"}">预览</button>`,
    `<button type="button" class="distill-view-button" data-testid="distill-view-markdown" data-active="${mode === "markdown" ? "true" : "false"}">Markdown</button>`,
    `<button type="button" class="distill-view-button" data-testid="distill-view-json" data-active="${mode === "json" ? "true" : "false"}">JSON</button>`,
    `</div>`,
    structured,
    markdownView,
    jsonView,
    `<button type="button" class="distill-add-to-chat" data-testid="distill-add-to-chat">一键加入对话</button>`,
    `</div>`,
  ].join("");
}

function renderSection(lockedTitle: string, id: number, section: DistillationSection | undefined): string {
  const title = section?.title ?? lockedTitle;
  const content = section?.content ? escapeHtml(section.content) : "";
  return [
    `<section class="distill-section" data-testid="distill-section" data-id="${id}" data-title="${escapeHtml(title)}">`,
    `<h3 class="distill-section-title">${escapeHtml(`${id}. ${title}`)}</h3>`,
    `<div class="distill-section-content">${content}</div>`,
    `</section>`,
  ].join("");
}

function renderSkill(skill: DistillationPreviewView["skills"][number]): string {
  const triggers = skill.triggers.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const steps = skill.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  return [
    `<article class="distill-skill" data-testid="distill-skill" data-skill-name="${escapeHtml(skill.name)}">`,
    `<h4 class="distill-skill-name">${escapeHtml(skill.name)}</h4>`,
    triggers ? `<ul class="distill-skill-triggers">${triggers}</ul>` : "",
    steps ? `<ol class="distill-skill-steps">${steps}</ol>` : "",
    skill.output ? `<p class="distill-skill-output">${escapeHtml(skill.output)}</p>` : "",
    `<div class="distill-skill-actions">`,
    `<button type="button" class="distill-skill-copy" data-testid="distill-skill-copy-markdown">复制 Markdown</button>`,
    `<button type="button" class="distill-skill-copy" data-testid="distill-skill-copy-json">复制 JSON</button>`,
    `</div>`,
    `<pre class="distill-skill-copy-payload" data-copy="markdown" hidden>${escapeHtml(skill.markdown)}</pre>`,
    `<pre class="distill-skill-copy-payload" data-copy="json" hidden>${escapeHtml(skill.json)}</pre>`,
    `</article>`,
  ].join("");
}
