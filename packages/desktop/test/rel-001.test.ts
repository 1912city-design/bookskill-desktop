import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  PRINCIPLE_PARAGRAPH_ID,
  RELATION_STATUS_REJECTED,
  RELATION_STATUS_SUGGESTED,
  RELATION_STATUS_VERIFIED,
  RELATION_TYPE_RELATED_TO,
  RELATION_TYPE_SUPPORTS,
  confirmRelation,
  listConfirmedRelations,
  listSuggestedRelations,
  openSliceWorkspace,
  rejectRelation,
  suggestRelation,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../src/shared/navigation.ts";
import type { BookskillDesktopBridge } from "../src/shared/shell-info.ts";
import { listKnowledgeCardViews } from "../src/renderer/knowledge/catalog.ts";
import { emptyKnowledgeUiState, type KnowledgeCardView } from "../src/renderer/knowledge/types.ts";
import { listRelationViews } from "../src/renderer/relations/catalog.ts";
import { relationStatusLabel, type RelationsUiState } from "../src/renderer/relations/types.ts";
import { renderRelationsRoute } from "../src/renderer/relations/view.ts";

const leftovers: string[] = [];
const FIXTURES_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../fixtures");
const EPUB_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.epub");
const MAIN_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/main/main.ts");
const PRELOAD_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/main/preload.cjs");
const KNOWLEDGE_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../core/src/knowledge.ts");
const NAV_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/shared/navigation.ts");

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-rel-"));
  leftovers.push(dataDir);
  initializeDataDir({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
  return dataDir;
}

function routeState(overrides: Partial<RelationsUiState> = {}): RelationsUiState {
  return {
    loaded: true,
    suggested: [],
    confirmed: [],
    fromCardId: "",
    toCardId: "",
    relationType: RELATION_TYPE_RELATED_TO,
    statusMessage: null,
    error: null,
    ...overrides,
  };
}

function sampleCard(id: string, title: string): KnowledgeCardView {
  return {
    id,
    title,
    type: "原则",
    content: "sample",
    conditions: null,
    limitations: null,
    status: "draft",
    createdAt: "2026-11-14T00:00:00.000Z",
    updatedAt: "2026-11-14T00:00:00.000Z",
    sources: [],
  };
}

describe("REL-001 knowledge relations route", () => {
  it("keeps the default route on chat and does not add a top-level nav entry", () => {
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.label),
      ["问题对话", "书库", "知识库", "Skills", "设置与数据"],
    );
    const knowledge = NAV_ITEMS.find((item) => item.id === "knowledge");
    assert.ok(knowledge);
    assert.match(knowledge.description, /建议知识卡之间的关系/);
    const navSource = fs.readFileSync(NAV_SOURCE, "utf8");
    assert.match(navSource, /export const DEFAULT_ROUTE_ID: RouteId = "chat"/);
  });

  it("renders suggestions outside the confirmed list, with explicit confirm and reject controls", () => {
    const html = renderRelationsRoute(
      routeState({
        fromCardId: "card-a",
        toCardId: "card-b",
        relationType: RELATION_TYPE_SUPPORTS,
        suggested: [
          {
            id: "rel-suggested",
            fromCardId: "card-a",
            toCardId: "card-b",
            relationType: RELATION_TYPE_SUPPORTS,
            status: RELATION_STATUS_SUGGESTED,
            fromCardTitle: "原则卡",
            toCardTitle: "案例卡",
          },
        ],
        confirmed: [],
      }),
      [sampleCard("card-a", "原则卡"), sampleCard("card-b", "案例卡")],
    );
    assert.match(html, /data-testid="relations-surface"/);
    assert.match(html, /data-testid="suggested-relations"/);
    assert.match(html, /data-testid="relation-status-code">suggested/);
    assert.match(html, /data-testid="confirm-relation"/);
    assert.match(html, /data-testid="reject-relation"/);
    assert.match(html, /data-testid="suggest-relation"/);
    assert.match(html, /data-testid="confirmed-relations-empty"/);
    assert.doesNotMatch(html, /data-testid="confirmed-relations"/);
    assert.doesNotMatch(html, /data-testid="auto-confirm-relation"/);
    assert.doesNotMatch(html, /data-testid="auto-suggest"/);
    assert.equal(relationStatusLabel(RELATION_STATUS_SUGGESTED), "建议");
    assert.equal(relationStatusLabel(RELATION_STATUS_VERIFIED), "已确认");
    assert.equal(relationStatusLabel(RELATION_STATUS_REJECTED), "已驳回");
  });

  it("shows a confirmed relation only in the formal list after user confirm", () => {
    const html = renderRelationsRoute(
      routeState({
        suggested: [],
        confirmed: [
          {
            id: "rel-confirmed",
            fromCardId: "card-a",
            toCardId: "card-b",
            relationType: RELATION_TYPE_RELATED_TO,
            status: RELATION_STATUS_VERIFIED,
            fromCardTitle: "原则卡",
            toCardTitle: "方法卡",
          },
        ],
      }),
      [sampleCard("card-a", "原则卡"), sampleCard("card-b", "方法卡")],
    );
    assert.match(html, /data-testid="confirmed-relations"/);
    assert.match(html, /data-testid="relation-status-code">verified_by_user/);
    assert.match(html, /data-testid="suggested-relations-empty"/);
    assert.doesNotMatch(html, /data-testid="confirm-relation"/);
  });

  it("suggests, confirms, and rejects relations through the catalog without auto-promoting", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const fromCard = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const toCard = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      const cards = listKnowledgeCardViews(workspace.db);
      assert.equal(cards.length, 2);

      const suggested = suggestRelation({
        db: workspace.db,
        fromCardId: fromCard.id,
        toCardId: toCard.id,
        relationType: RELATION_TYPE_SUPPORTS,
      });
      let lists = listRelationViews(workspace.db);
      assert.equal(lists.suggested.length, 1);
      assert.equal(lists.confirmed.length, 0);
      assert.equal(lists.suggested[0]?.id, suggested.id);
      assert.equal(lists.suggested[0]?.fromCardTitle, fromCard.title);
      assert.equal(listConfirmedRelations(workspace.db).length, 0);

      const htmlSuggested = renderRelationsRoute(routeState(lists), cards);
      assert.match(htmlSuggested, new RegExp(`data-relation-id="${suggested.id}"`));
      assert.match(htmlSuggested, /data-testid="confirmed-relations-empty"/);

      confirmRelation({ db: workspace.db, relationId: suggested.id });
      lists = listRelationViews(workspace.db);
      assert.equal(lists.suggested.length, 0);
      assert.equal(lists.confirmed.length, 1);
      assert.equal(lists.confirmed[0]?.status, RELATION_STATUS_VERIFIED);
      assert.equal(lists.confirmed[0]?.relationType, RELATION_TYPE_SUPPORTS);

      const toReject = suggestRelation({
        db: workspace.db,
        fromCardId: toCard.id,
        toCardId: fromCard.id,
        relationType: RELATION_TYPE_RELATED_TO,
      });
      rejectRelation({ db: workspace.db, relationId: toReject.id });
      lists = listRelationViews(workspace.db);
      assert.equal(lists.suggested.some((relation) => relation.id === toReject.id), false);
      assert.equal(lists.confirmed.some((relation) => relation.id === toReject.id), false);
      assert.equal(listSuggestedRelations(workspace.db).length, 0);
      assert.equal(listConfirmedRelations(workspace.db).length, 1);

      workspace.deleteKnowledgeCard(fromCard.id);
      lists = listRelationViews(workspace.db);
      assert.equal(lists.suggested.length, 0);
      assert.equal(lists.confirmed.length, 0);
      const remaining = (
        workspace.db.prepare(`SELECT COUNT(*) AS n FROM knowledge_relations`).get() as { n: number }
      ).n;
      assert.equal(remaining, 0);
    } finally {
      workspace.close();
    }
  });

  it("appends relation IPC to the existing bridge and does not rewrite knowledge merge/delete", () => {
    const preload = fs.readFileSync(PRELOAD_SOURCE, "utf8");
    assert.match(preload, /suggestRelation:/);
    assert.match(preload, /confirmRelation:/);
    assert.match(preload, /rejectRelation:/);
    assert.match(preload, /listSuggestedRelations:/);
    assert.match(preload, /listConfirmedRelations:/);
    assert.match(preload, /relations:suggest/);
    assert.match(preload, /relations:confirm/);
    assert.match(preload, /relations:reject/);

    const main = fs.readFileSync(MAIN_SOURCE, "utf8");
    assert.match(main, /relations:suggest/);
    assert.match(main, /relations:confirm/);
    assert.match(main, /DEFAULT_ROUTE_ID/);

    const knowledge = fs.readFileSync(KNOWLEDGE_SOURCE, "utf8");
    assert.doesNotMatch(knowledge, /INSERT INTO knowledge_relations/);

    const bridge: BookskillDesktopBridge = {
      getShellInfo: async () => {
        throw new Error("unused");
      },
      listLibraryBooks: async () => [],
      loadLibraryBook: async () => {
        throw new Error("unused");
      },
      loadAnnotations: async () => [],
      createExcerpt: async () => [],
      listKnowledgeCards: async () => [],
      listKnowledgeBooks: async () => [],
      draftKnowledgeCard: async () => [],
      updateKnowledgeCard: async () => [],
      confirmKnowledgeCard: async () => [],
      mergeKnowledgeCards: async () => ({ cards: [], locatorProof: [] }),
      deleteKnowledgeCard: async () => ({ cards: [], locatorProof: [] }),
      searchLibrary: async () => ({
        query: "",
        mode: "fulltext",
        fallback: "none",
        backend: "local_deterministic",
        results: [],
      }),
      listSuggestedRelations: async () => [],
      listConfirmedRelations: async () => [],
      suggestRelation: async () => ({ suggested: [], confirmed: [] }),
      confirmRelation: async () => ({ suggested: [], confirmed: [] }),
      rejectRelation: async () => ({ suggested: [], confirmed: [] }),
      importBook: async () => [],
      importBookFile: async () => [],
      chooseAndImport: async () => ({ canceled: true, books: [] }),
      startConversation: async () => ({ id: "", title: "", turns: [] }),
      ask: async () => ({ id: "", title: "", turns: [] }),
      loadConversation: async () => ({ id: "", title: "", turns: [] }),
      listConversations: async () => [],
      listSkillTemplates: async () => [],
      instantiateSkillTemplate: async () => {
        throw new Error("unused");
      },
      createBlankSkill: async () => {
        throw new Error("unused");
      },
      listSkills: async () => [],
      loadSkill: async () => {
        throw new Error("unused");
      },
      saveSkill: async () => {
        throw new Error("unused");
      },
      updateSkillMetadata: async () => {
        throw new Error("unused");
      },
      transitionSkillStatus: async () => {
        throw new Error("unused");
      },
      instantiateConceptCard: async () => [],
      startDistill: async () => ({ status: "failed", reason: "unused", preview: null }),
      importDistillationMarkdown: async () => ({ ok: false, preview: null }),
      loadDistillation: async () => {
        throw new Error("unused");
      },
      listDistillations: async () => [],
      attachDistillationToChat: async () => {
        throw new Error("unused");
      },
      loadDistillationChatContext: async () => null,
    };
    assert.equal(typeof bridge.suggestRelation, "function");
    assert.equal(emptyKnowledgeUiState().selectedCardId, null);
  });
});
