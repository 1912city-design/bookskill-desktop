export const SKILL_STATUS_ARCHIVED = "archived";

export type SkillTemplateDomain = "daily" | "life" | "professional";

export type SkillTemplateSummary = {
  id: string;
  domain: SkillTemplateDomain | string;
  name: string;
  purpose: string;
  whenToUse: string;
  whenNotToUse: string;
};

export type SkillInputField = {
  name: string;
  required: boolean;
  description: string;
};

export type SkillStepField = {
  id: string;
  text: string;
};

export type SkillPermissionsView = {
  network: boolean;
  writeFiles: boolean;
  modelProvider: string;
  whenToUse: string;
  whenNotToUse: string;
};

export type SkillListItem = {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  status: string;
  currentVersionId: string | null;
  version: string;
  updatedAt: string;
};

export type SkillEditorView = {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  status: string;
  currentVersionId: string | null;
  version: string;
  whenToUse: string;
  whenNotToUse: string;
  inputs: SkillInputField[];
  steps: SkillStepField[];
  rules: string[];
  outputSchema: unknown;
  permissions: SkillPermissionsView;
  knowledgeCardIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type SkillEditorDraft = {
  name: string;
  domain: string;
  purpose: string;
  whenToUse: string;
  whenNotToUse: string;
  inputsText: string;
  stepsText: string;
  rulesText: string;
  outputSchemaText: string;
  network: boolean;
  writeFiles: boolean;
  modelProvider: string;
};

export type SkillsUiState = {
  loaded: boolean;
  templates: SkillTemplateSummary[];
  skills: SkillListItem[];
  selectedSkillId: string | null;
  editor: SkillEditorView | null;
  draft: SkillEditorDraft;
  error: string | null;
  statusMessage: string | null;
};

export const SKILL_DOMAIN_OPTIONS = [
  { id: "日常", label: "日常" },
  { id: "生活", label: "生活" },
  { id: "专业", label: "专业" },
] as const;

export function emptySkillEditorDraft(): SkillEditorDraft {
  return {
    name: "",
    domain: "日常",
    purpose: "",
    whenToUse: "",
    whenNotToUse: "",
    inputsText: "[]",
    stepsText: "[]",
    rulesText: "",
    outputSchemaText: "{}",
    network: false,
    writeFiles: false,
    modelProvider: "local-stub",
  };
}

export function draftFromSkill(skill: SkillEditorView): SkillEditorDraft {
  return {
    name: skill.name,
    domain: skill.domain,
    purpose: skill.purpose,
    whenToUse: skill.whenToUse,
    whenNotToUse: skill.whenNotToUse,
    inputsText: JSON.stringify(skill.inputs, null, 2),
    stepsText: JSON.stringify(skill.steps, null, 2),
    rulesText: skill.rules.join("\n"),
    outputSchemaText: JSON.stringify(skill.outputSchema, null, 2),
    network: skill.permissions.network,
    writeFiles: skill.permissions.writeFiles,
    modelProvider: skill.permissions.modelProvider,
  };
}

export function emptySkillsUiState(): SkillsUiState {
  return {
    loaded: false,
    templates: [],
    skills: [],
    selectedSkillId: null,
    editor: null,
    draft: emptySkillEditorDraft(),
    error: null,
    statusMessage: null,
  };
}

export function skillStatusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "草稿";
    case "tested":
      return "已测试";
    case "published":
      return "已发布";
    case "archived":
      return "已归档";
    default:
      return status;
  }
}

export function templateDomainLabel(domain: string): string {
  switch (domain) {
    case "daily":
      return "日常";
    case "life":
      return "生活";
    case "professional":
      return "专业";
    default:
      return domain;
  }
}
