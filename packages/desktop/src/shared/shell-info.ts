import type { NavItem, RouteId } from "./navigation.ts";

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
};
