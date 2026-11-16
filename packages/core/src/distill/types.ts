import { UNCONFIRMED_LOCATION_LABEL } from "../constants.ts";

export const DISTILL_TEMPLATE_ID = "bookskill.distill.5-segment.v1" as const;

export const LOCKED_SECTION_TITLES = ["核心定位", "原则与应用", "金句", "应用框架", "可调用Skill"] as const;

export type LockedSectionTitle = (typeof LOCKED_SECTION_TITLES)[number];
export type LockedSectionId = 1 | 2 | 3 | 4 | 5;

export type DistillationQuote = {
  text: string;
  attribution: string | null;
};

export type DistillationSourceRef = {
  source_filename: string;
  paragraph_id: string | null;
  confirmed: boolean;
  unconfirmedLabel?: string;
  quote?: string;
  chapterTitle?: string | null;
};

export type DistillationSkill = {
  name: string;
  triggers: string[];
  steps: string[];
  output: string;
};

export type DistillationSection = {
  id: LockedSectionId;
  title: string;
  content: string;
  quotes: DistillationQuote[];
  source: DistillationSourceRef[];
  skills?: DistillationSkill[];
};

export type Distillation = {
  book_id: string;
  title: string;
  source_filename: string;
  template_id: string;
  sections: DistillationSection[];
};

export type StoredDistillation = Distillation & {
  id: string;
  skill_ids: string[];
  created_at: string;
  markdown_path: string;
  json_path: string;
};

export type DistillationConversationAttachment = {
  kind: "distillation";
  distillation_id?: string;
  title: string;
  book_id: string;
  template_id: string;
  source_filename: string;
  citations: DistillationSourceRef[];
};

export type DistillationValidationSuccess = {
  ok: true;
  distillation: Distillation;
};

export type DistillationValidationFailure = {
  ok: false;
  error: DistillationValidationError;
};

export type DistillationValidationResult = DistillationValidationSuccess | DistillationValidationFailure;

export class DistillationValidationError extends Error {
  readonly code = "DISTILL_VALIDATION_FAILED" as const;
  readonly issues: readonly string[];

  constructor(issues: string[]) {
    const unique = uniqueIssues(issues);
    super(unique.join("; "));
    this.name = "DistillationValidationError";
    this.issues = unique;
  }
}

export class DistillationAdapterError extends Error {
  readonly code: "adapter_unconfigured" | "adapter_failed";

  constructor(code: "adapter_unconfigured" | "adapter_failed", message: string) {
    super(message);
    this.name = "DistillationAdapterError";
    this.code = code;
  }
}

export const UNCONFIRMED_DISTILL_LOCATION_LABEL = UNCONFIRMED_LOCATION_LABEL;

function uniqueIssues(issues: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const issue of issues) {
    if (seen.has(issue)) continue;
    seen.add(issue);
    result.push(issue);
  }
  return result;
}
