import path from "node:path";
import {
  openBusinessDatabase,
  resolveBusinessDbPath,
  type BusinessDatabase,
  type MigrateDatabaseOptions,
} from "@bookskill/data";
import { ask, loadConversation, loadEvidenceForTurn, saveFeedback, startConversation } from "./conversation.ts";
import { findChunkByParagraphId, importBook, loadBook, locateHighlight } from "./import-book.ts";
import { confirmKnowledgeCard, deleteKnowledgeCard, draftKnowledgeCardFromLocator, loadKnowledgeCard } from "./knowledge.ts";
import { recommendSkills } from "./recommend.ts";
import { createRetrospectiveSkill, createSkillVersion, loadSkill, loadSkillVersion } from "./skills.ts";
import type { SliceSnapshot } from "./types.ts";

export type OpenWorkspaceOptions = MigrateDatabaseOptions & {
  now?: Date;
};

export type SliceWorkspace = {
  readonly dataDir: string;
  readonly dbPath: string;
  readonly schemaVersion: number;
  readonly db: BusinessDatabase["db"];
  snapshot(): SliceSnapshot;
  importBook(filePath: string): ReturnType<typeof importBook>;
  loadBook(bookId: string): ReturnType<typeof loadBook>;
  findChunkByParagraphId: typeof findChunkByParagraphId;
  locateHighlight: typeof locateHighlight;
  draftKnowledgeCardFromLocator(bookId: string, paragraphId: string): ReturnType<typeof draftKnowledgeCardFromLocator>;
  confirmKnowledgeCard: typeof confirmKnowledgeCard extends (options: infer O) => infer R
    ? (options: Omit<O, "db">) => R
    : never;
  deleteKnowledgeCard(cardId: string): void;
  loadKnowledgeCard(cardId: string): ReturnType<typeof loadKnowledgeCard>;
  createRetrospectiveSkill(knowledgeCardId: string): ReturnType<typeof createRetrospectiveSkill>;
  createSkillVersion: typeof createSkillVersion extends (options: infer O) => infer R
    ? (options: Omit<O, "db">) => R
    : never;
  recommendSkills(task: string): ReturnType<typeof recommendSkills>;
  startConversation: typeof startConversation extends (options: infer O) => infer R
    ? (options: Omit<O, "db">) => R
    : never;
  ask: typeof ask extends (options: infer O) => infer R ? (options: Omit<O, "db">) => R : never;
  saveFeedback: typeof saveFeedback extends (options: infer O) => infer R
    ? (options: Omit<O, "db">) => R
    : never;
  loadConversation(conversationId: string): ReturnType<typeof loadConversation>;
  loadEvidenceForTurn(turnId: string): ReturnType<typeof loadEvidenceForTurn>;
  loadSkill(skillId: string): ReturnType<typeof loadSkill>;
  loadSkillVersion(versionId: string): ReturnType<typeof loadSkillVersion>;
  close(): void;
};

/**
 * Open the BookSkill business database under the product data directory
 * and expose the VERT-001 thin-slice operations.
 */
export function openSliceWorkspace(options: OpenWorkspaceOptions = {}): SliceWorkspace {
  const dbPath = resolveBusinessDbPath(options);
  const dataDir = path.dirname(path.dirname(dbPath));
  const opened = openBusinessDatabase(options);
  const now = options.now;

  const workspace: SliceWorkspace = {
    dataDir,
    dbPath: opened.path,
    schemaVersion: opened.schemaVersion,
    db: opened.db,
    snapshot() {
      return readSnapshot(opened, dataDir);
    },
    importBook(filePath) {
      return importBook({ db: opened.db, dataDir, filePath, now });
    },
    loadBook(bookId) {
      return loadBook(opened.db, bookId);
    },
    findChunkByParagraphId,
    locateHighlight,
    draftKnowledgeCardFromLocator(bookId, paragraphId) {
      return draftKnowledgeCardFromLocator({ db: opened.db, bookId, paragraphId, now });
    },
    confirmKnowledgeCard(cardOptions) {
      return confirmKnowledgeCard({ ...cardOptions, db: opened.db, now: cardOptions.now ?? now });
    },
    deleteKnowledgeCard(cardId) {
      deleteKnowledgeCard(opened.db, cardId);
    },
    loadKnowledgeCard(cardId) {
      return loadKnowledgeCard(opened.db, cardId);
    },
    createRetrospectiveSkill(knowledgeCardId) {
      return createRetrospectiveSkill(opened.db, knowledgeCardId, now);
    },
    createSkillVersion(versionOptions) {
      return createSkillVersion({ ...versionOptions, db: opened.db, now: versionOptions.now ?? now });
    },
    recommendSkills(task) {
      return recommendSkills(opened.db, task);
    },
    startConversation(startOptions) {
      return startConversation({ ...startOptions, db: opened.db, now: startOptions.now ?? now });
    },
    ask(askOptions) {
      return ask({ ...askOptions, db: opened.db, now: askOptions.now ?? now });
    },
    saveFeedback(feedbackOptions) {
      return saveFeedback({ ...feedbackOptions, db: opened.db, now: feedbackOptions.now ?? now });
    },
    loadConversation(conversationId) {
      return loadConversation(opened.db, conversationId);
    },
    loadEvidenceForTurn(turnId) {
      return loadEvidenceForTurn(opened.db, turnId);
    },
    loadSkill(skillId) {
      return loadSkill(opened.db, skillId);
    },
    loadSkillVersion(versionId) {
      return loadSkillVersion(opened.db, versionId);
    },
    close() {
      opened.close();
    },
  };
  return workspace;
}

export function readSnapshot(opened: BusinessDatabase, dataDir: string): SliceSnapshot {
  const count = (table: string): number => {
    const row = opened.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    return row.n;
  };
  return {
    dataDir,
    dbPath: opened.path,
    schemaVersion: opened.schemaVersion,
    books: count("books"),
    sourceChunks: count("source_chunks"),
    knowledgeCards: count("knowledge_cards"),
    skills: count("skills"),
    conversations: count("conversations"),
    feedback: count("feedback"),
  };
}
