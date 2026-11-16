import {
  createSkill,
  createSkillVersion,
  DEFAULT_SKILL_VERSION,
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  loadSkill,
  loadSkillVersion,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SKILL_STATUS_TESTED,
  type SkillInputSpec,
} from "@bookskill/core";
import { createBusinessId } from "@bookskill/data";
import type { DatabaseSync } from "node:sqlite";
import * as bookskillCore from "@bookskill/core";
import { SKILL_STATUS_ARCHIVED, type SkillEditorView, type SkillInputField, type SkillListItem, type SkillPermissionsView, type SkillStepField, type SkillTemplateSummary } from "../renderer/skills/types.ts";
import {
  CONCEPT_CARD_TEMPLATE_ID,
  getLocalSkillTemplate,
  listSkillTemplates as listLocalSkillTemplates,
  SKILL_TEMPLATE_DOMAIN_LABELS,
} from "./skill-templates.ts";

export { CONCEPT_CARD_TEMPLATE_ID, SKILL_STATUS_ARCHIVED };

export type SkillStatusAction = "mark_tested" | "publish" | "archive";

export type TransitionSkillStatusInput = {
  skillId: string;
  action: SkillStatusAction;
  confirmedByUser?: boolean;
};

export type UpdateSkillMetadataInput = {
  skillId: string;
  name?: string;
  domain?: string;
  purpose?: string;
};

export type SaveSkillInput = {
  skillId: string;
  name: string;
  domain: string;
  purpose: string;
  whenToUse?: string;
  whenNotToUse?: string;
  inputs: SkillInputField[];
  steps: SkillStepField[];
  rules: string[];
  outputSchema: unknown;
  permissions: {
    network: boolean;
    writeFiles: boolean;
    modelProvider: string;
  };
  status?: string;
};

export type ConceptCardDraft = {
  id: string;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

const CONCEPT_CARD_TITLE = "概念卡草稿";
const CONCEPT_CARD_TYPE = "概念";
const CONCEPT_CARD_CONTENT = "定义/内容（占位，请编辑）。";
const CONCEPT_CARD_CONDITIONS = "适用条件（占位，请按实际使用场景改写。本模板不声称适用于所有用户或岗位。）";
const CONCEPT_CARD_LIMITATIONS =
  "限制（占位）。来源占位：此草稿尚未绑定原书段落；确认前请补上来源，且不得视为已确认。";

function rejectPublished(status: string | undefined, action: string): void {
  if (status === SKILL_STATUS_PUBLISHED) {
    throw new Error(`${action}不得写成 published；发布只能由用户显式操作。`);
  }
}

export function readPermissions(raw: unknown): SkillPermissionsView {
  const obj = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const guidance =
    obj.guidance && typeof obj.guidance === "object" && !Array.isArray(obj.guidance)
      ? (obj.guidance as Record<string, unknown>)
      : {};
  const whenToUse =
    typeof obj.whenToUse === "string" ? obj.whenToUse : typeof guidance.whenToUse === "string" ? guidance.whenToUse : "";
  const whenNotToUse =
    typeof obj.whenNotToUse === "string"
      ? obj.whenNotToUse
      : typeof guidance.whenNotToUse === "string"
        ? guidance.whenNotToUse
        : "";
  return {
    network: obj.network === true,
    writeFiles: obj.writeFiles === true,
    modelProvider: typeof obj.modelProvider === "string" && obj.modelProvider.trim() ? obj.modelProvider : "local-stub",
    whenToUse,
    whenNotToUse,
  };
}

export function writePermissions(
  existing: unknown,
  updates: { network: boolean; writeFiles: boolean; modelProvider: string; whenToUse: string; whenNotToUse: string },
): Record<string, unknown> {
  const base = existing && typeof existing === "object" && !Array.isArray(existing) ? { ...(existing as Record<string, unknown>) } : {};
  return {
    ...base,
    network: updates.network,
    writeFiles: updates.writeFiles,
    modelProvider: updates.modelProvider,
    whenToUse: updates.whenToUse,
    whenNotToUse: updates.whenNotToUse,
  };
}

export function normalizeInputs(raw: unknown): SkillInputField[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return { name: `input_${index + 1}`, required: false, description: "" };
    }
    const item = entry as Record<string, unknown>;
    return {
      name: typeof item.name === "string" && item.name.trim() ? item.name : `input_${index + 1}`,
      required: item.required === true,
      description: typeof item.description === "string" ? item.description : "",
    };
  });
}

export function normalizeSteps(raw: unknown): SkillStepField[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry, index) => {
    if (typeof entry === "string") {
      return { id: `step_${index + 1}`, text: entry };
    }
    if (!entry || typeof entry !== "object") {
      return { id: `step_${index + 1}`, text: "" };
    }
    const item = entry as Record<string, unknown>;
    return {
      id: typeof item.id === "string" && item.id.trim() ? item.id : `step_${index + 1}`,
      text: typeof item.text === "string" ? item.text : typeof item.description === "string" ? item.description : "",
    };
  });
}

export function normalizeRules(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return typeof raw === "string" && raw.trim() ? [raw] : [];
  }
  return raw.map((entry) => (typeof entry === "string" ? entry : JSON.stringify(entry)));
}

export function nextSkillVersion(existingVersions: string[], current: string): string {
  const used = new Set(existingVersions);
  let candidate = bumpVersion(current || DEFAULT_SKILL_VERSION);
  while (used.has(candidate)) {
    candidate = bumpVersion(candidate);
  }
  return candidate;
}

function bumpVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return `${version}.1`;
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function listVersionNumbers(db: DatabaseSync, skillId: string): string[] {
  const rows = db
    .prepare(`SELECT version FROM skill_versions WHERE skill_id = ?`)
    .all(skillId) as Array<{ version: string }>;
  return rows.map((row) => row.version);
}

function coreListSkillTemplates(): SkillTemplateSummary[] | null {
  const fn = (bookskillCore as Record<string, unknown>).listSkillTemplates;
  if (typeof fn === "function") {
    return (fn as () => SkillTemplateSummary[])();
  }
  return null;
}

function coreInstantiateSkillTemplate(options: {
  db: DatabaseSync;
  templateId: string;
  name?: string;
}): { skill: { id: string } } | null {
  const fn = (bookskillCore as Record<string, unknown>).instantiateSkillTemplate;
  if (typeof fn === "function") {
    return (fn as (input: { db: DatabaseSync; templateId: string; name?: string }) => { skill: { id: string } })(options);
  }
  return null;
}

export function listSkillTemplates(): SkillTemplateSummary[] {
  return coreListSkillTemplates() ?? listLocalSkillTemplates();
}

export function loadSkillEditorView(db: DatabaseSync, skillId: string): SkillEditorView {
  const skill = loadSkill(db, skillId);
  if (!skill.currentVersionId) {
    throw new Error(`Skill ${skillId} 没有当前版本。`);
  }
  const version = loadSkillVersion(db, skill.currentVersionId);
  const permissions = readPermissions(version.permissions);
  return {
    id: skill.id,
    name: skill.name,
    domain: skill.domain,
    purpose: skill.purpose,
    status: skill.status,
    currentVersionId: skill.currentVersionId,
    version: version.version,
    whenToUse: permissions.whenToUse,
    whenNotToUse: permissions.whenNotToUse,
    inputs: normalizeInputs(version.inputs),
    steps: normalizeSteps(version.steps),
    rules: normalizeRules(version.rules),
    outputSchema: version.outputSchema,
    permissions,
    knowledgeCardIds: version.knowledgeCardIds,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt,
  };
}

export function listSkills(db: DatabaseSync): SkillListItem[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.name, s.domain, s.purpose, s.status, s.current_version_id, s.updated_at, v.version
       FROM skills s
       LEFT JOIN skill_versions v ON v.id = s.current_version_id
       ORDER BY s.updated_at DESC, s.created_at DESC, s.id`,
    )
    .all() as Array<{
    id: string;
    name: string;
    domain: string;
    purpose: string;
    status: string;
    current_version_id: string | null;
    updated_at: string;
    version: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    domain: row.domain,
    purpose: row.purpose,
    status: row.status,
    currentVersionId: row.current_version_id,
    version: row.version ?? "",
    updatedAt: row.updated_at,
  }));
}

export function createBlankSkill(
  db: DatabaseSync,
  options: { name?: string; status?: string } = {},
): SkillEditorView {
  rejectPublished(options.status, "从空白创建");
  const created = createSkill({
    db,
    name: options.name?.trim() ? options.name.trim() : "未命名 Skill",
    domain: "日常",
    purpose: "请填写此 Skill 的目的。这是可编辑的通用流程，不能声称适用于所有用户或岗位。",
    status: SKILL_STATUS_DRAFT,
    version: DEFAULT_SKILL_VERSION,
    inputs: [{ name: "context", required: false, description: "本次要处理的背景或材料" }],
    steps: [
      { id: "clarify", text: "确认本次要处理的问题与范围。" },
      { id: "draft", text: "按步骤整理可编辑的结果。" },
      { id: "review", text: "检查限制条件，并把没有来源的内容标注出来。" },
    ],
    rules: [
      "这是可编辑的通用流程，不能声称适用于所有用户或岗位。",
      "没有来源的内容必须标注为模型建议/一般推断。",
      "不得自动把草稿发布为正式 Skill。",
    ],
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
      },
    },
    permissions: {
      network: false,
      writeFiles: false,
      modelProvider: "local-stub",
      whenToUse: "当需要一份可编辑的空白结构来编写 Skill 时。",
      whenNotToUse: "在还没有明确目的之前，不要把它当作已完成的正式 Skill。",
    },
  });
  if (created.skill.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("从空白创建不得把 Skill 发布为 published。");
  }
  if (created.skill.status !== SKILL_STATUS_DRAFT) {
    throw new Error("从空白创建必须生成 draft Skill。");
  }
  return loadSkillEditorView(db, created.skill.id);
}

export function instantiateSkillTemplate(options: {
  db: DatabaseSync;
  templateId: string;
  name?: string;
  status?: string;
}): SkillEditorView {
  rejectPublished(options.status, "模板实例化");
  if (options.templateId === CONCEPT_CARD_TEMPLATE_ID) {
    throw new Error("概念卡模板会生成知识卡草稿，不能当作 Skill 实例化。");
  }
  const fromCore = coreInstantiateSkillTemplate({
    db: options.db,
    templateId: options.templateId,
    name: options.name,
  });
  if (fromCore) {
    const loaded = loadSkillEditorView(options.db, fromCore.skill.id);
    if (loaded.status === SKILL_STATUS_PUBLISHED) {
      throw new Error("模板实例化不得把 Skill 发布为 published。");
    }
    return loaded;
  }
  const template = getLocalSkillTemplate(options.templateId);
  const created = createSkill({
    db: options.db,
    name: options.name?.trim() ? options.name.trim() : template.name,
    domain: template.domain === "daily" || template.domain === "life" || template.domain === "professional"
      ? SKILL_TEMPLATE_DOMAIN_LABELS[template.domain]
      : template.domain,
    purpose: template.purpose,
    status: SKILL_STATUS_DRAFT,
    version: DEFAULT_SKILL_VERSION,
    inputs: template.inputs,
    steps: template.steps,
    rules: template.rules,
    outputSchema: template.outputSchema,
    permissions: {
      network: false,
      writeFiles: false,
      modelProvider: "local-stub",
      whenToUse: template.whenToUse,
      whenNotToUse: template.whenNotToUse,
    },
  });
  if (created.skill.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("模板实例化不得把 Skill 发布为 published。");
  }
  if (created.skill.status !== SKILL_STATUS_DRAFT) {
    throw new Error("模板实例化必须生成 draft Skill。");
  }
  return loadSkillEditorView(options.db, created.skill.id);
}

export function updateSkillMetadata(db: DatabaseSync, input: UpdateSkillMetadataInput): SkillEditorView {
  const existing = loadSkill(db, input.skillId);
  const name = input.name !== undefined ? input.name.trim() : existing.name;
  const domain = input.domain !== undefined ? input.domain.trim() : existing.domain;
  const purpose = input.purpose !== undefined ? input.purpose : existing.purpose;
  if (!name) {
    throw new Error("Skill 名称不能为空。");
  }
  if (!domain) {
    throw new Error("Skill 领域不能为空。");
  }
  db.prepare(`UPDATE skills SET name = ?, domain = ?, purpose = ?, updated_at = ? WHERE id = ?`).run(
    name,
    domain,
    purpose,
    new Date().toISOString(),
    input.skillId,
  );
  return loadSkillEditorView(db, input.skillId);
}

export function saveSkill(db: DatabaseSync, input: SaveSkillInput): SkillEditorView {
  rejectPublished(input.status, "保存");
  const skill = loadSkill(db, input.skillId);
  if (!skill.currentVersionId) {
    throw new Error(`Skill ${input.skillId} 没有当前版本。`);
  }
  const previous = loadSkillVersion(db, skill.currentVersionId);
  updateSkillMetadata(db, {
    skillId: input.skillId,
    name: input.name,
    domain: input.domain,
    purpose: input.purpose,
  });
  const version = nextSkillVersion(listVersionNumbers(db, input.skillId), previous.version);
  const permissions = writePermissions(previous.permissions, {
    network: input.permissions.network,
    writeFiles: input.permissions.writeFiles,
    modelProvider: input.permissions.modelProvider,
    whenToUse: input.whenToUse ?? "",
    whenNotToUse: input.whenNotToUse ?? "",
  });
  const created = createSkillVersion({
    db,
    skillId: input.skillId,
    version,
    status: SKILL_STATUS_DRAFT,
    inputs: input.inputs as SkillInputSpec[],
    steps: input.steps,
    rules: input.rules,
    outputSchema: input.outputSchema,
    permissions,
    knowledgeCardIds: previous.knowledgeCardIds,
  });
  if (created.skill.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("保存不得把 Skill 写成 published。");
  }
  return loadSkillEditorView(db, input.skillId);
}

export function transitionSkillStatus(db: DatabaseSync, input: TransitionSkillStatusInput): SkillEditorView {
  if (!input || typeof input.skillId !== "string" || !input.skillId.trim()) {
    throw new Error("无效的 Skill 编号。");
  }
  const skill = loadSkill(db, input.skillId);
  if (input.action === "publish") {
    if (input.confirmedByUser !== true) {
      throw new Error("发布 Skill 必须由用户显式确认，不能默认或自动发布。");
    }
    if (skill.status === SKILL_STATUS_ARCHIVED) {
      throw new Error("已归档的 Skill 不能被发布。");
    }
    if (skill.status === SKILL_STATUS_DRAFT) {
      throw new Error("草稿不能直接发布，请先标记为已测试。");
    }
    if (skill.status !== SKILL_STATUS_TESTED) {
      throw new Error(`不能将 ${skill.status} 的 Skill 发布为 published。`);
    }
    return writeSkillStatus(db, skill.id, SKILL_STATUS_PUBLISHED);
  }
  if (input.action === "mark_tested") {
    if (skill.status !== SKILL_STATUS_DRAFT) {
      throw new Error(`只有草稿可以标记为已测试，当前状态是 ${skill.status}。`);
    }
    return writeSkillStatus(db, skill.id, SKILL_STATUS_TESTED);
  }
  if (input.action === "archive") {
    return writeSkillStatus(db, skill.id, SKILL_STATUS_ARCHIVED);
  }
  throw new Error(`不支持的状态操作。`);
}

function writeSkillStatus(db: DatabaseSync, skillId: string, status: string): SkillEditorView {
  if (status === SKILL_STATUS_PUBLISHED) {
    // Only the explicit publish action may reach here.
  }
  db.prepare(`UPDATE skills SET status = ?, updated_at = ? WHERE id = ?`).run(status, new Date().toISOString(), skillId);
  return loadSkillEditorView(db, skillId);
}

export function instantiateConceptCard(db: DatabaseSync): ConceptCardDraft {
  const id = createBusinessId();
  const stamp = new Date().toISOString();
  db.prepare(
    `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    CONCEPT_CARD_TITLE,
    CONCEPT_CARD_TYPE,
    CONCEPT_CARD_CONTENT,
    CONCEPT_CARD_CONDITIONS,
    CONCEPT_CARD_LIMITATIONS,
    KNOWLEDGE_CARD_STATUS_DRAFT,
    stamp,
    stamp,
  );
  const row = db
    .prepare(
      `SELECT id, title, type, content, conditions, limitations, status, created_at, updated_at
       FROM knowledge_cards WHERE id = ?`,
    )
    .get(id) as {
    id: string;
    title: string;
    type: string;
    content: string;
    conditions: string | null;
    limitations: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  };
  if (row.status === KNOWLEDGE_CARD_STATUS_VERIFIED) {
    throw new Error("概念卡模板不得生成已确认的知识卡。");
  }
  if (row.status !== KNOWLEDGE_CARD_STATUS_DRAFT) {
    throw new Error("概念卡模板必须生成 draft 知识卡。");
  }
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    content: row.content,
    conditions: row.conditions,
    limitations: row.limitations,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function parseJsonField<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${label} 不是合法的 JSON。`);
  }
}

export function parseRulesText(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[")) {
    const parsed = parseJsonField<unknown>(trimmed, "规则");
    return normalizeRules(parsed);
  }
  return trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}
