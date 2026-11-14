export type BookFormat = "pdf" | "epub" | "markdown" | "txt";

export type SourceLocation = {
  paragraphId: string | null;
  confirmed: boolean;
  chapterTitle: string | null;
  page: number | null;
  href: string | null;
  unconfirmedLabel?: string;
};

export type ParsedChunk = {
  chapter: string | null;
  page: number | null;
  location: SourceLocation;
  text: string;
  ordinal: number;
};

export type ParsedBook = {
  title: string;
  author: string | null;
  format: BookFormat;
  chunks: ParsedChunk[];
};

export type ImportedBook = {
  id: string;
  title: string;
  author: string | null;
  format: BookFormat;
  filePath: string;
  contentHash: string;
  parseStatus: string;
  chunks: ImportedChunk[];
};

export type ImportedChunk = {
  id: string;
  bookId: string;
  chapter: string | null;
  page: number | null;
  location: SourceLocation;
  text: string;
  contentHash: string;
  ordinal: number;
};

export type KnowledgeCardRecord = {
  id: string;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  sources: KnowledgeSourceRecord[];
};

export type KnowledgeSourceRecord = {
  id: string;
  knowledgeCardId: string;
  sourceChunkId: string;
  relationType: string;
  paragraphId: string | null;
};

export type SkillRecord = {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  status: string;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SkillVersionRecord = {
  id: string;
  skillId: string;
  version: string;
  inputs: SkillInputSpec[];
  steps: unknown;
  rules: unknown;
  outputSchema: unknown;
  permissions: unknown;
  createdAt: string;
  knowledgeCardIds: string[];
};

export type SkillInputSpec = {
  name: string;
  required: boolean;
  description: string;
};

export type SkillRecommendation = {
  skill: SkillRecord;
  version: SkillVersionRecord;
  reason: string;
};

export type ClaimGrounding = "sourced" | "unsourced";

export type AnswerClaim = {
  id: string;
  text: string;
  grounding: ClaimGrounding;
  label: string | null;
  sourceChunkId: string | null;
  knowledgeCardId: string | null;
  paragraphId: string | null;
  chapter: string | null;
  page: number | null;
  bookTitle: string | null;
};

export type AssistantAnswer = {
  kind: "clarify" | "answer";
  content: string;
  missingInputs: string[];
  claims: AnswerClaim[];
  confirmedInputs: Record<string, string>;
};

export type ConversationTurnRecord = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status: string;
};

export type ConversationRecord = {
  id: string;
  title: string;
  mode: string;
  createdAt: string;
  updatedAt: string;
  skillId: string;
  skillVersionId: string;
  selectionMethod: string;
  turns: ConversationTurnRecord[];
};

export type SkillRunRecord = {
  id: string;
  conversationId: string;
  skillVersionId: string;
  inputs: Record<string, string>;
  result: unknown;
  status: string;
  createdAt: string;
};

export type FeedbackRecord = {
  id: string;
  skillRunId: string;
  rating: number;
  reason: string | null;
  createdAt: string;
};

export type CaseRecord = {
  card: KnowledgeCardRecord;
  feedback: FeedbackRecord;
  skillRun: SkillRunRecord;
};

export type SliceSnapshot = {
  dataDir: string;
  dbPath: string;
  schemaVersion: number;
  books: number;
  sourceChunks: number;
  knowledgeCards: number;
  skills: number;
  conversations: number;
  feedback: number;
};
