import type { NavItem, RouteId } from "./navigation.ts";
import type { LibraryBookSummary, ReaderAnnotation, ReaderBook } from "../renderer/read/types.ts";
import type {
  BookLocatorProof,
  KnowledgeBookOption,
  KnowledgeCardView,
} from "../renderer/knowledge/types.ts";
import type { KnowledgeRelationView, RelationLists } from "../renderer/relations/types.ts";
import type { SearchMode, SearchResult } from "@bookskill/core";

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
};
