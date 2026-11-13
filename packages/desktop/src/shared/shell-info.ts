import type { NavItem, RouteId } from "./navigation.ts";
import type { LibraryBookSummary, ReaderAnnotation, ReaderBook } from "../renderer/read/types.ts";

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
};
