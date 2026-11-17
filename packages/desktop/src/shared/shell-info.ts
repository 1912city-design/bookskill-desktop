import type { NavItem, RouteId } from "./navigation.ts";
import type { LibraryBookSummary, ReaderAnnotation, ReaderBook } from "../renderer/read/types.ts";
import type {
  BookLocatorProof,
  KnowledgeBookOption,
  KnowledgeCardView,
} from "../renderer/knowledge/types.ts";
import type { KnowledgeRelationView, RelationLists } from "../renderer/relations/types.ts";
import type { SearchMode, SearchResult } from "@bookskill/core";
import type { ChatConversationSummary, ChatConversationView } from "../renderer/chat/types.ts";
import type {
  DistillChatContext,
  DistillationPreviewView,
  DistillationValidationError,
} from "../renderer/distill/types.ts";
import type {
  SkillEditorView,
  SkillInputField,
  SkillListItem,
  SkillStepField,
  SkillTemplateSummary,
} from "../renderer/skills/types.ts";
import type {
  CouncilAskBridgeResult,
  CouncilListBridgeResult,
  CouncilRoundtableBridgeResult,
  CouncilAdapterKind,
} from "../renderer/council/types.ts";

export type SliceSnapshotInfo = {
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

export type ShellInfo = {
  productName: string;
  version: string;
  dataDir: string;
  defaultRouteId: RouteId;
  routes: readonly NavItem[];
  businessDbPath: string;
  schemaVersion: number | null;
  slice: SliceSnapshotInfo | null;
  sliceError: string | null;
};


export type DistillStartBridgeResult = {
  status: "failed" | "ready" | "invalid";
  reason: string | null;
  preview: DistillationPreviewView | null;
  errors?: DistillationValidationError[];
};

export type DistillImportBridgeResult = {
  ok: boolean;
  preview: DistillationPreviewView | null;
  errors?: DistillationValidationError[];
};

export type DistillAttachBridgeResult = {
  conversation: ChatConversationView;
  context: DistillChatContext;
  skillStatus: string;
};

export type BookskillDesktopBridge = {
  getShellInfo: () => Promise<ShellInfo>;
  listLibraryBooks: () => Promise<LibraryBookSummary[]>;
  loadLibraryBook: (bookId: string) => Promise<ReaderBook>;
  loadAnnotations: (bookId: string) => Promise<ReaderAnnotation[]>;
  createExcerpt: (input: {
    bookId: string;
    selectedText: string;
    note?: string;
  }) => Promise<ReaderAnnotation[]>;
  listKnowledgeCards: () => Promise<KnowledgeCardView[]>;
  listKnowledgeBooks: () => Promise<KnowledgeBookOption[]>;
  draftKnowledgeCard: (input: { bookId: string; paragraphId: string }) => Promise<KnowledgeCardView[]>;
  updateKnowledgeCard: (input: {
    cardId: string;
    title?: string;
    content?: string;
    conditions?: string | null;
    limitations?: string | null;
  }) => Promise<KnowledgeCardView[]>;
  confirmKnowledgeCard: (input: {
    cardId: string;
    title?: string;
    content?: string;
    conditions?: string | null;
    limitations?: string | null;
  }) => Promise<KnowledgeCardView[]>;
  mergeKnowledgeCards: (input: {
    survivingCardId: string;
    absorbedCardId: string;
  }) => Promise<{ cards: KnowledgeCardView[]; locatorProof: BookLocatorProof[] }>;
  deleteKnowledgeCard: (cardId: string) => Promise<{ cards: KnowledgeCardView[]; locatorProof: BookLocatorProof[] }>;
  searchLibrary: (input: { query: string; mode?: SearchMode }) => Promise<SearchResult>;
  listSuggestedRelations: () => Promise<KnowledgeRelationView[]>;
  listConfirmedRelations: () => Promise<KnowledgeRelationView[]>;
  suggestRelation: (input: {
    fromCardId: string;
    toCardId: string;
    relationType: string;
  }) => Promise<RelationLists>;
  confirmRelation: (relationId: string) => Promise<RelationLists>;
  rejectRelation: (relationId: string) => Promise<RelationLists>;
  discoverKnowledgeRelations?: () => Promise<RelationLists>;
  confirmSuggestedRelations?: (relationIds: string[]) => Promise<RelationLists>;
  rejectSuggestedRelations?: (relationIds: string[]) => Promise<RelationLists>;
  importBook: (filePath: string) => Promise<LibraryBookSummary[]>;
  importBookFile: (file: File | { path?: string }) => Promise<LibraryBookSummary[]>;
  chooseAndImport: () => Promise<{ canceled: boolean; books: LibraryBookSummary[] }>;
  startConversation: (input?: { title?: string }) => Promise<ChatConversationView>;
  ask: (input: { message: string; conversationId?: string }) => Promise<ChatConversationView>;
  loadConversation: (conversationId: string) => Promise<ChatConversationView>;
  listConversations: () => Promise<ChatConversationSummary[]>;
  listSkillTemplates: () => Promise<SkillTemplateSummary[]>;
  instantiateSkillTemplate: (input: { templateId: string; name?: string }) => Promise<SkillEditorView>;
  createBlankSkill: (input?: { name?: string }) => Promise<SkillEditorView>;
  listSkills: () => Promise<SkillListItem[]>;
  loadSkill: (skillId: string) => Promise<SkillEditorView>;
  saveSkill: (input: {
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
    permissions: { network: boolean; writeFiles: boolean; modelProvider: string };
    status?: string;
  }) => Promise<SkillEditorView>;
  updateSkillMetadata: (input: {
    skillId: string;
    name?: string;
    domain?: string;
    purpose?: string;
  }) => Promise<SkillEditorView>;
  transitionSkillStatus: (input: {
    skillId: string;
    action: "mark_tested" | "publish" | "archive";
    confirmedByUser?: boolean;
  }) => Promise<SkillEditorView>;
  instantiateConceptCard: () => Promise<KnowledgeCardView[]>;
  startDistill: (input: { bookId: string }) => Promise<DistillStartBridgeResult>;
  importDistillationMarkdown: (input: {
    markdown: string;
    sourceFilename?: string;
    bookId?: string;
  }) => Promise<DistillImportBridgeResult>;
  loadDistillation: (id: string) => Promise<DistillationPreviewView>;
  listDistillations: () => Promise<Array<{ id: string; title: string; source_filename: string; book_id: string; createdAt: string }>>;
  attachDistillationToChat: (input: {
    distillationId: string;
    skillId?: string;
  }) => Promise<DistillAttachBridgeResult>;
  loadDistillationChatContext: (conversationId: string) => Promise<DistillChatContext | null>;
  listCouncilSeats: () => Promise<CouncilListBridgeResult>;
  askCouncilSeat: (input: { seatId: string; question: string; useFixtureAdapter?: boolean }) => Promise<CouncilAskBridgeResult>;
  runCouncilRoundtable: (input: {
    question: string;
    seatIds?: string[];
    useFixtureAdapter?: boolean;
  }) => Promise<CouncilRoundtableBridgeResult>;
  enableFixtureCouncilAdapter: () => Promise<CouncilAdapterKind>;
};

