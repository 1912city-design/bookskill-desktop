import type { SkillInputSpec } from "../types.ts";

export type SkillTemplateDomain = "daily" | "life" | "professional";

export type SkillTemplateSummary = {
  id: string;
  domain: SkillTemplateDomain;
  name: string;
  purpose: string;
  whenToUse: string;
  whenNotToUse: string;
};

export type SkillTemplateExample = {
  label: string;
  input: Record<string, string>;
};

export type SkillTemplateScopeRule = {
  /** Field name to inspect, or "*" to scan every string value in the input. */
  field: string;
  includes: string[];
  message: string;
};

export type SkillTemplatePermissions = {
  network: false;
  writeFiles: false;
  modelProvider: string;
};

export type SkillTemplateDefinition = SkillTemplateSummary & {
  inputs: SkillInputSpec[];
  steps: Array<{ id: string; text: string }>;
  rules: string[];
  outputSchema: unknown;
  permissions: SkillTemplatePermissions;
  successExample: SkillTemplateExample;
  boundaryExample: SkillTemplateExample;
  scopeRules: SkillTemplateScopeRule[];
};

export type InstantiateSkillTemplateOptions = {
  db: import("node:sqlite").DatabaseSync;
  templateId: string;
  name?: string;
};

export type InstantiateKnowledgeCardTemplateOptions = {
  db: import("node:sqlite").DatabaseSync;
  templateId: string;
  title?: string;
};

export type SkillTemplateValidationResult = {
  ok: boolean;
  complete: boolean;
  errors: string[];
  /** Validation never publishes a Skill. Always false. */
  published: false;
};

export type KnowledgeCardTemplateSummary = {
  id: string;
  name: string;
  purpose: string;
  fields: string[];
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
