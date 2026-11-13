export type KnowledgeSourceView = {
  id: string;
  knowledgeCardId: string;
  sourceChunkId: string;
  relationType: string;
  paragraphId: string | null;
  bookId: string | null;
  bookTitle: string | null;
};

export type KnowledgeCardView = {
  id: string;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  sources: KnowledgeSourceView[];
};

export type KnowledgeBookOption = {
  id: string;
  title: string;
  parseStatus: string;
};

export type BookLocatorProof = {
  bookId: string;
  bookTitle: string;
  sourceChunkId: string;
  paragraphId: string | null;
  bookPresent: boolean;
  locatorUsable: boolean;
};

export type KnowledgeUiState = {
  loaded: boolean;
  cards: KnowledgeCardView[];
  books: KnowledgeBookOption[];
  selectedCardId: string | null;
  mergeTargetId: string;
  draftBookId: string;
  draftParagraphId: string;
  editTitle: string;
  editContent: string;
  editConditions: string;
  editLimitations: string;
  statusMessage: string | null;
  locatorProof: BookLocatorProof[];
  error: string | null;
};

export function emptyKnowledgeUiState(): KnowledgeUiState {
  return {
    loaded: false,
    cards: [],
    books: [],
    selectedCardId: null,
    mergeTargetId: "",
    draftBookId: "",
    draftParagraphId: "",
    editTitle: "",
    editContent: "",
    editConditions: "",
    editLimitations: "",
    statusMessage: null,
    locatorProof: [],
    error: null,
  };
}

export function knowledgeStatusLabel(status: string): string {
  if (status === "verified_by_user") {
    return "已确认";
  }
  return "草稿";
}
