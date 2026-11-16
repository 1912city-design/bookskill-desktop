import { escapeHtml } from "../../shared/error-boundary.ts";
import {
  SKILL_DOMAIN_OPTIONS,
  skillStatusLabel,
  templateDomainLabel,
  type SkillEditorView,
  type SkillListItem,
  type SkillTemplateSummary,
  type SkillsUiState,
} from "./types.ts";

function renderTemplates(templates: SkillTemplateSummary[]): string {
  if (templates.length === 0) {
    return `<div class="skill-template-list" data-testid="skill-templates"><p class="skills-help">模板列表尚未加载。</p></div>`;
  }
  const items = templates
    .map((template) => {
      return [
        `<article class="skill-template" data-testid="skill-template" data-template-id="${escapeHtml(template.id)}">`,
        `<p class="skill-template-kicker">${escapeHtml(templateDomainLabel(template.domain))} · ${escapeHtml(template.id)}</p>`,
        `<h3 class="skill-template-name">${escapeHtml(template.name)}</h3>`,
        `<p class="skill-template-purpose">${escapeHtml(template.purpose)}</p>`,
        `<p class="skill-template-guidance"><span>适用：</span>${escapeHtml(template.whenToUse)}</p>`,
        `<p class="skill-template-guidance"><span>不适用：</span>${escapeHtml(template.whenNotToUse)}</p>`,
        `<button type="button" class="skills-secondary" data-testid="skill-instantiate" data-template-id="${escapeHtml(template.id)}">用此模板生成草稿</button>`,
        `</article>`,
      ].join("");
    })
    .join("");
  return `<div class="skill-template-list" data-testid="skill-templates">${items}</div>`;
}

function renderSkillList(skills: SkillListItem[], selectedSkillId: string | null): string {
  if (skills.length === 0) {
    return `<p class="skills-empty" data-testid="skills-empty">还没有 Skill。可从空白表单或上方模板一键生成草稿。</p>`;
  }
  const items = skills
    .map((skill) => {
      const selected = skill.id === selectedSkillId;
      return [
        `<article class="skill-item" data-testid="skill-item" data-skill-id="${escapeHtml(skill.id)}" data-status="${escapeHtml(skill.status)}" data-selected="${selected ? "true" : "false"}">`,
        `<button type="button" class="skill-item-open" data-testid="open-skill" data-skill-id="${escapeHtml(skill.id)}">`,
        `<span class="skill-item-title">${escapeHtml(skill.name)}</span>`,
        `<span class="skill-item-meta">`,
        `<span>${escapeHtml(skill.domain)}</span>`,
        `<span class="skill-status" data-status="${escapeHtml(skill.status)}">${escapeHtml(skillStatusLabel(skill.status))}</span>`,
        `<code>${escapeHtml(skill.version || "—")}</code>`,
        `</span>`,
        `</button>`,
        `</article>`,
      ].join("");
    })
    .join("");
  return `<div class="skill-item-list" data-testid="skills-list">${items}</div>`;
}

function domainOptions(current: string): string {
  const known = new Set<string>(SKILL_DOMAIN_OPTIONS.map((option) => option.id));
  const extras = current && !known.has(current) ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>` : "";
  const options = SKILL_DOMAIN_OPTIONS.map((option) => {
    const selected = option.id === current ? " selected" : "";
    return `<option value="${escapeHtml(option.id)}"${selected}>${escapeHtml(option.label)}</option>`;
  }).join("");
  return `${extras}${options}`;
}

function renderEditor(state: SkillsUiState): string {
  const selected: SkillEditorView | null = state.editor;
  if (!selected) {
    return `<p class="skills-editor-empty" data-testid="skills-editor-empty">选择一个 Skill，或先从空白 / 模板生成草稿后即可编辑合同 2.6 字段。</p>`;
  }
  const draft = state.draft;
  const canMarkTested = selected.status === "draft";
  const canPublish = selected.status === "tested";
  const alreadyArchived = selected.status === "archived";
  const markTestedDisabled = canMarkTested ? "" : " disabled";
  const publishDisabled = canPublish ? "" : " disabled";
  const archiveDisabled = alreadyArchived ? " disabled" : "";
  return [
    `<form class="skill-editor" data-testid="skill-editor" data-skill-id="${escapeHtml(selected.id)}">`,
    `<h2>编辑 Skill</h2>`,
    `<p class="skills-editor-status">当前状态：<span data-testid="skill-status" data-status="${escapeHtml(selected.status)}">${escapeHtml(skillStatusLabel(selected.status))}</span> <code>${escapeHtml(selected.status)}</code></p>`,
    `<p class="skills-version-line">当前版本号：<code data-testid="skill-version">${escapeHtml(selected.version)}</code></p>`,
    `<p class="skills-version-line">当前版本 id：<code data-testid="skill-version-id">${escapeHtml(selected.currentVersionId ?? "")}</code></p>`,
    `<p class="skills-versions-entry" data-testid="skill-versions-entry">版本列表与回滚即将提供（VER-002）</p>`,
    `<label class="skills-label" for="skill-name">名称</label>`,
    `<input id="skill-name" class="skills-input" data-testid="skill-name" name="name" value="${escapeHtml(draft.name)}" />`,
    `<label class="skills-label" for="skill-domain">领域</label>`,
    `<select id="skill-domain" class="skills-input" data-testid="skill-domain" name="domain">${domainOptions(draft.domain)}</select>`,
    `<label class="skills-label" for="skill-purpose">目的</label>`,
    `<textarea id="skill-purpose" class="skills-input skills-textarea" data-testid="skill-purpose" name="purpose" rows="3">${escapeHtml(draft.purpose)}</textarea>`,
    `<label class="skills-label" for="skill-when-to-use">适用条件（when_to_use）</label>`,
    `<textarea id="skill-when-to-use" class="skills-input skills-textarea" data-testid="skill-when-to-use" name="whenToUse" rows="3">${escapeHtml(draft.whenToUse)}</textarea>`,
    `<label class="skills-label" for="skill-when-not-to-use">不适用条件（when_not_to_use）</label>`,
    `<textarea id="skill-when-not-to-use" class="skills-input skills-textarea" data-testid="skill-when-not-to-use" name="whenNotToUse" rows="3">${escapeHtml(draft.whenNotToUse)}</textarea>`,
    `<label class="skills-label" for="skill-inputs">输入（JSON 数组）</label>`,
    `<textarea id="skill-inputs" class="skills-input skills-textarea skills-code" data-testid="skill-inputs" name="inputs" rows="6">${escapeHtml(draft.inputsText)}</textarea>`,
    `<label class="skills-label" for="skill-steps">步骤（JSON 数组）</label>`,
    `<textarea id="skill-steps" class="skills-input skills-textarea skills-code" data-testid="skill-steps" name="steps" rows="6">${escapeHtml(draft.stepsText)}</textarea>`,
    `<label class="skills-label" for="skill-rules">规则（每行一条）</label>`,
    `<textarea id="skill-rules" class="skills-input skills-textarea" data-testid="skill-rules" name="rules" rows="5">${escapeHtml(draft.rulesText)}</textarea>`,
    `<label class="skills-label" for="skill-output-schema">输出 schema（JSON）</label>`,
    `<textarea id="skill-output-schema" class="skills-input skills-textarea skills-code" data-testid="skill-output-schema" name="outputSchema" rows="6">${escapeHtml(draft.outputSchemaText)}</textarea>`,
    `<fieldset class="skills-permissions" data-testid="skill-permissions">`,
    `<legend>权限声明</legend>`,
    `<label class="skills-check"><input type="checkbox" name="network" data-testid="skill-permission-network"${draft.network ? " checked" : ""} /> 允许网络</label>`,
    `<label class="skills-check"><input type="checkbox" name="writeFiles" data-testid="skill-permission-write-files"${draft.writeFiles ? " checked" : ""} /> 允许写文件</label>`,
    `<label class="skills-label" for="skill-permission-model">模型提供方</label>`,
    `<input id="skill-permission-model" class="skills-input" data-testid="skill-permission-model" name="modelProvider" value="${escapeHtml(draft.modelProvider)}" />`,
    `</fieldset>`,
    `<div class="skills-actions">`,
    `<button type="submit" class="skills-secondary" data-testid="skill-save">保存为新版本</button>`,
    `<button type="button" class="skills-secondary" data-testid="skill-mark-tested"${markTestedDisabled}>标记为已测试</button>`,
    `<button type="button" class="skills-primary" data-testid="skill-publish"${publishDisabled}>发布</button>`,
    `<button type="button" class="skills-danger" data-testid="skill-archive"${archiveDisabled}>归档</button>`,
    `</div>`,
    `<p class="skills-help">保存会追加新的版本行，不会改写既有历史版本。保存不会发布。发布、标记已测试和归档都必须由你显式点击，AI 或模板不会代为操作。</p>`,
    `</form>`,
  ].join("");
}

export function renderSkillsRoute(state: SkillsUiState): string {
  const error = state.error
    ? `<p class="skills-error" data-testid="skill-error" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  const message = state.statusMessage
    ? `<p class="skills-message" data-testid="skill-message">${escapeHtml(state.statusMessage)}</p>`
    : "";
  return [
    `<div class="skills-surface" data-testid="skills-surface">`,
    error,
    message,
    `<div class="skills-layout">`,
    `<section class="skills-list-pane">`,
    `<p class="skills-lead">从空白或模板一键生成草稿 Skill。创建和保存都保持 draft，不会自动发布。模板是静态结构，不会执行来自 Skill 或书籍内容的任意代码。</p>`,
    `<button type="button" class="skills-primary" data-testid="skill-create-blank">从空白新建草稿</button>`,
    `<h2>模板</h2>`,
    renderTemplates(state.templates),
    `<h2>已有 Skill</h2>`,
    renderSkillList(state.skills, state.selectedSkillId),
    `</section>`,
    `<section class="skills-detail-pane">`,
    renderEditor(state),
    `</section>`,
    `</div>`,
    `</div>`,
  ].join("");
}
