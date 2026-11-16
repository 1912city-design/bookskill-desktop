export const LOCKED_SECTION_TITLES = [
  "核心定位",
  "原则与应用",
  "金句",
  "应用框架",
  "可调用Skill",
] as const;

export type LockedSectionTitle = (typeof LOCKED_SECTION_TITLES)[number];

export const DISTILL_TEMPLATE_ID = "bookskill.distill.5-segment.v1";

/**
 * Same wording as `@bookskill/core` `UNCONFIRMED_LOCATION_LABEL`.
 * Renderer distill code must not value-import the core barrel.
 */
export const DISTILL_UNCONFIRMED_LOCATION_LABEL = "来源定位未确认";

export type DistillationSourceRef = {
  source_filename: string;
  locator: string | null;
  label: string;
};

export type DistillationSkill = {
  name: string;
  triggers: string[];
  steps: string[];
  output: string;
};

export type DistillationSection = {
  id: 1 | 2 | 3 | 4 | 5;
  title: LockedSectionTitle | string;
  content: string;
  quotes: string[];
  source: DistillationSourceRef[];
  skills?: DistillationSkill[];
};

export type Distillation = {
  book_id: string;
  title: string;
  source_filename: string;
  template_id: typeof DISTILL_TEMPLATE_ID | string;
  sections: DistillationSection[];
};

export type DistillationValidationError = {
  code: "missing_section" | "renamed_title" | "section_count" | "empty_skills" | "invalid_structure";
  message: string;
  sectionId?: number;
  title?: string;
};

export type DistillationValidationResult =
  | { ok: true; errors: [] }
  | { ok: false; errors: DistillationValidationError[] };

export type DistillationSkillRef = {
  skillId: string;
  skillVersionId: string;
  name: string;
  status: string;
};

export type StoredDistillation = {
  id: string;
  distillation: Distillation;
  markdown: string;
  skillRefs: DistillationSkillRef[];
  createdAt: string;
};

export type DistillationPreviewView = {
  id: string | null;
  title: string;
  sourceFilename: string;
  locatorLabel: string;
  locatorConfirmed: boolean;
  markdown: string;
  json: string;
  sections: DistillationSection[];
  skills: Array<DistillationSkill & { markdown: string; json: string }>;
  skillRefs: DistillationSkillRef[];
};

export type DistillChatContext = {
  conversationId: string;
  bookId: string | null;
  sourceFilename: string;
  distillationId: string;
  skillId: string;
  skillVersionId: string;
  skillName: string;
  skillStatus: string;
};

export type DistillPhase = "idle" | "running" | "failed" | "preview";

export type DistillViewMode = "preview" | "markdown" | "json";

export type DistillUiState = {
  phase: DistillPhase;
  bookId: string | null;
  bookTitle: string | null;
  error: string | null;
  preview: DistillationPreviewView | null;
  viewMode: DistillViewMode;
};

export function emptyDistillUiState(): DistillUiState {
  return {
    phase: "idle",
    bookId: null,
    bookTitle: null,
    error: null,
    preview: null,
    viewMode: "preview",
  };
}
