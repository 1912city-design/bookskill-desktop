import {
  DEFAULT_SKILL_VERSION,
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
} from "../constants.ts";
import { loadKnowledgeCard } from "../knowledge.ts";
import { createSkill } from "../skills.ts";
import type { KnowledgeCardRecord, SkillRecord, SkillVersionRecord } from "../types.ts";
import { newId, nowIso } from "../util.ts";
import {
  CONCEPT_CARD_TEMPLATE,
  CONCEPT_CARD_TEMPLATE_ID,
  SKILL_TEMPLATE_DOMAIN_LABELS,
  SKILL_TEMPLATES,
} from "./catalog.ts";
import type {
  ConceptCardDraft,
  InstantiateKnowledgeCardTemplateOptions,
  InstantiateSkillTemplateOptions,
  KnowledgeCardTemplateSummary,
  SkillTemplateDefinition,
  SkillTemplateSummary,
  SkillTemplateValidationResult,
} from "./types.ts";

export {
  CONCEPT_CARD_TEMPLATE,
  CONCEPT_CARD_TEMPLATE_ID,
  DEFAULT_SKILL_TEMPLATE_PERMISSIONS,
  SKILL_TEMPLATES,
  SKILL_TEMPLATE_DOMAIN_LABELS,
  SKILL_TEMPLATE_IDS,
} from "./catalog.ts";
export type {
  ConceptCardDraft,
  InstantiateKnowledgeCardTemplateOptions,
  InstantiateSkillTemplateOptions,
  KnowledgeCardTemplateSummary,
  SkillTemplateDefinition,
  SkillTemplateDomain,
  SkillTemplateExample,
  SkillTemplatePermissions,
  SkillTemplateScopeRule,
  SkillTemplateSummary,
  SkillTemplateValidationResult,
} from "./types.ts";

export function listSkillTemplates(): SkillTemplateSummary[] {
  return SKILL_TEMPLATES.map(toSummary);
}

export function listKnowledgeCardTemplates(): KnowledgeCardTemplateSummary[] {
  return [
    {
      id: CONCEPT_CARD_TEMPLATE.id,
      name: CONCEPT_CARD_TEMPLATE.name,
      purpose: CONCEPT_CARD_TEMPLATE.purpose,
      fields: [...CONCEPT_CARD_TEMPLATE.fields],
    },
  ];
}

export function getSkillTemplate(templateId: string): SkillTemplateDefinition {
  if (templateId === CONCEPT_CARD_TEMPLATE_ID) {
    throw new Error("概念卡模板会生成知识卡草稿，不能当作 Skill 模板读取。");
  }
  const template = SKILL_TEMPLATES.find((entry) => entry.id === templateId);
  if (!template) {
    throw new Error(`未知的 Skill 模板：${templateId}`);
  }
  return template;
}

/**
 * Create a draft Skill and its first skill_versions row from a frozen template id.
 * createSkill defaults to tested when status is omitted, so this always passes status: draft.
 * It never writes published (D-018) and never executes template code.
 */
export function instantiateSkillTemplate(
  options: InstantiateSkillTemplateOptions,
): { skill: SkillRecord; version: SkillVersionRecord } {
  const template = getSkillTemplate(options.templateId);
  const created = createSkill({
    db: options.db,
    name: options.name?.trim() ? options.name.trim() : template.name,
    domain: SKILL_TEMPLATE_DOMAIN_LABELS[template.domain],
    purpose: template.purpose,
    status: SKILL_STATUS_DRAFT,
    version: DEFAULT_SKILL_VERSION,
    inputs: template.inputs.map((input) => ({ ...input })),
    steps: template.steps.map((step) => ({ ...step })),
    rules: [...template.rules],
    outputSchema: template.outputSchema,
    permissions: {
      network: false,
      writeFiles: false,
      modelProvider: template.permissions.modelProvider,
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
  return created;
}

/**
 * Create a draft knowledge card from knowledge.concept-card.
 * Does not insert fabricated knowledge_sources rows and does not call confirmKnowledgeCard (D-017).
 */
export function instantiateKnowledgeCardTemplate(
  options: InstantiateKnowledgeCardTemplateOptions,
): ConceptCardDraft {
  if (options.templateId !== CONCEPT_CARD_TEMPLATE_ID) {
    throw new Error(`未知的知识卡模板：${options.templateId}`);
  }
  const stamp = nowIso();
  const id = newId();
  const title = options.title?.trim() ? options.title.trim() : CONCEPT_CARD_TEMPLATE.title;
  options.db
    .prepare(
      `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      title,
      CONCEPT_CARD_TEMPLATE.type,
      CONCEPT_CARD_TEMPLATE.content,
      CONCEPT_CARD_TEMPLATE.conditions,
      CONCEPT_CARD_TEMPLATE.limitations,
      KNOWLEDGE_CARD_STATUS_DRAFT,
      stamp,
      stamp,
    );
  const card = loadKnowledgeCard(options.db, id);
  if (card.status === KNOWLEDGE_CARD_STATUS_VERIFIED) {
    throw new Error("概念卡模板不得生成已确认的知识卡。");
  }
  if (card.status !== KNOWLEDGE_CARD_STATUS_DRAFT) {
    throw new Error("概念卡模板必须生成 draft 知识卡。");
  }
  return toConceptCardDraft(card);
}

export function validateSkillTemplateInput(
  templateId: string,
  input: Record<string, unknown>,
): SkillTemplateValidationResult {
  const template = getSkillTemplate(templateId);
  const errors: string[] = [];

  for (const field of template.inputs) {
    if (!field.required) {
      continue;
    }
    const value = input[field.name];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`缺少必填输入：${field.name}`);
    }
  }

  for (const rule of template.scopeRules) {
    const values =
      rule.field === "*"
        ? Object.values(input).filter((value): value is string => typeof value === "string")
        : [typeof input[rule.field] === "string" ? (input[rule.field] as string) : ""];
    for (const value of values) {
      if (rule.includes.some((needle) => value.includes(needle))) {
        errors.push(rule.message);
        break;
      }
    }
  }

  return {
    ok: errors.length === 0,
    complete: errors.length === 0,
    errors,
    published: false,
  };
}

function toSummary(template: SkillTemplateDefinition): SkillTemplateSummary {
  return {
    id: template.id,
    domain: template.domain,
    name: template.name,
    purpose: template.purpose,
    whenToUse: template.whenToUse,
    whenNotToUse: template.whenNotToUse,
  };
}

function toConceptCardDraft(card: KnowledgeCardRecord): ConceptCardDraft {
  return {
    id: card.id,
    title: card.title,
    type: card.type,
    content: card.content,
    conditions: card.conditions,
    limitations: card.limitations,
    status: card.status,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}
