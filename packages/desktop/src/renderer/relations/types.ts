/**
 * Relation tokens must stay identical to `@bookskill/core`
 * (`packages/core/src/relations.ts`). They are duplicated here so the
 * renderer bundle does not import the core barrel, which would pull
 * Node-only modules (parse-pdf, sqlite, fs) into a browser IIFE.
 */
const RELATION_STATUS_REJECTED = "rejected";
const RELATION_STATUS_SUGGESTED = "suggested";
const RELATION_STATUS_VERIFIED = "verified_by_user";
const RELATION_TYPE_CONTRADICTS = "contradicts";
const RELATION_TYPE_EXAMPLE_OF = "example_of";
const RELATION_TYPE_RELATED_TO = "related_to";
const RELATION_TYPE_SUPPORTS = "supports";

type KnowledgeRelationRecord = {
  id: string;
  fromCardId: string;
  toCardId: string;
  relationType: string;
  status: string;
};

export type KnowledgeRelationView = KnowledgeRelationRecord & {
  fromCardTitle: string;
  toCardTitle: string;
  reason?: string | null;
};

export type RelationLists = {
  suggested: KnowledgeRelationView[];
  confirmed: KnowledgeRelationView[];
};

export type RelationsUiState = {
  loaded: boolean;
  suggested: KnowledgeRelationView[];
  confirmed: KnowledgeRelationView[];
  fromCardId: string;
  toCardId: string;
  relationType: string;
  statusMessage: string | null;
  error: string | null;
};

export const RELATION_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: RELATION_TYPE_SUPPORTS, label: "支持（supports）" },
  { value: RELATION_TYPE_CONTRADICTS, label: "矛盾（contradicts）" },
  { value: RELATION_TYPE_EXAMPLE_OF, label: "作为例子（example_of）" },
  { value: RELATION_TYPE_RELATED_TO, label: "相关（related_to）" },
];

export function emptyRelationsUiState(): RelationsUiState {
  return {
    loaded: false,
    suggested: [],
    confirmed: [],
    fromCardId: "",
    toCardId: "",
    relationType: RELATION_TYPE_RELATED_TO,
    statusMessage: null,
    error: null,
  };
}

export function relationStatusLabel(status: string): string {
  if (status === RELATION_STATUS_VERIFIED) {
    return "已确认";
  }
  if (status === RELATION_STATUS_REJECTED) {
    return "已驳回";
  }
  if (status === RELATION_STATUS_SUGGESTED) {
    return "建议";
  }
  return status;
}

export function relationTypeLabel(relationType: string): string {
  return RELATION_TYPE_OPTIONS.find((option) => option.value === relationType)?.label ?? relationType;
}

export function discoveryReasonLabel(reason: string | null | undefined): string {
  if (reason === "shared_source") {
    return "共用来源段落（shared_source）";
  }
  if (reason === "text_overlap") {
    return "标题/正文相似（text_overlap）";
  }
  if (reason === "type_rule") {
    return "类型规则（type_rule）";
  }
  return "";
}
