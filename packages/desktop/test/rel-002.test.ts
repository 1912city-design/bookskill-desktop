import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  DISCOVERY_REASON_TYPE_RULE,
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_TYPE_CASE,
  KNOWLEDGE_CARD_TYPE_PRINCIPLE,
  RELATION_STATUS_REJECTED,
  RELATION_STATUS_SUGGESTED,
  RELATION_STATUS_VERIFIED,
  RELATION_TYPE_EXAMPLE_OF,
  RELATION_TYPE_RELATED_TO,
  RELATION_TYPE_SUPPORTS,
  listConfirmedRelations,
  listSuggestedRelations,
  openSliceWorkspace,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { DEFAULT_ROUTE_ID } from "../src/shared/navigation.ts";
import {
  confirmSuggestedRelations,
  discoverAndListRelationViews,
  listRelationViews,
  rejectSuggestedRelations,
} from "../src/renderer/relations/catalog.ts";
import { discoveryReasonLabel, type RelationsUiState } from "../src/renderer/relations/types.ts";
import { renderRelationsRoute } from "../src/renderer/relations/view.ts";
import { emptyKnowledgeUiState, type KnowledgeCardView } from "../src/renderer/knowledge/types.ts";
import type { BookskillDesktopBridge } from "../src/shared/shell-info.ts";
import type { DatabaseSync } from "node:sqlite";

const leftovers: string[] = [];
const MAIN_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/main/main.ts");
const PRELOAD_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/main/preload.cjs");
const NAV_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/shared/navigation.ts");
const KNOWLEDGE_SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../core/src/knowledge.ts");
const RELATIONS_CORE_SOURCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../core/src/relations.ts",
);

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-rel-002-"));
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

function sampleCard(id: string, title: string, type = "原则"): KnowledgeCardView {
  return {
    id,
    title,
    type,
    content: "sample",
    conditions: null,
    limitations: null,
    status: "draft",
    createdAt: "2026-11-16T14:00:00.000Z",
    updatedAt: "2026-11-16T14:00:00.000Z",
    sources: [],
  };
}

function insertCard(
  db: DatabaseSync,
  input: { title: string; type: string; content: string },
): string {
  const id = randomUUID();
  const stamp = "2026-11-16T14:00:00.000Z";
  db.prepare(
    `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, input.title, input.type, input.content, null, null, KNOWLEDGE_CARD_STATUS_DRAFT, stamp, stamp);
  return id;
}

describe("REL-002 relations discovery inbox", () => {
  it("keeps the default route on chat", () => {
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    const navSource = fs.readFileSync(NAV_SOURCE, "utf8");
    assert.match(navSource, /export const DEFAULT_ROUTE_ID: RouteId = "chat"/);
  });

  it("renders suggestion reasons and batch confirm/reject controls without auto-confirm", () => {
    const html = renderRelationsRoute(
      routeState({
        suggested: [
          {
            id: "rel-suggested",
            fromCardId: "card-a",
            toCardId: "card-b",
            relationType: RELATION_TYPE_EXAMPLE_OF,
            status: RELATION_STATUS_SUGGESTED,
            fromCardTitle: "案例卡",
            toCardTitle: "原则卡",
            reason: DISCOVERY_REASON_TYPE_RULE,
          },
        ],
        confirmed: [],
      }),
      [sampleCard("card-a", "案例卡", "案例"), sampleCard("card-b", "原则卡")],
    );
    assert.match(html, /data-testid="discover-relations"/);
    assert.match(html, /data-testid="confirm-selected-relations"/);
    assert.match(html, /data-testid="reject-selected-relations"/);
    assert.match(html, /data-testid="select-relation"/);
    assert.match(html, /data-testid="relation-reason" data-reason="type_rule"/);
    assert.match(html, /建议理由：类型规则（type_rule）/);
    assert.match(html, /data-testid="confirmed-relations-empty"/);
    assert.doesNotMatch(html, /data-testid="confirmed-relations"/);
    assert.doesNotMatch(html, /data-testid="auto-confirm-relation"/);
    assert.doesNotMatch(html, /data-testid="auto-suggest"/);
    assert.equal(discoveryReasonLabel("shared_source"), "共用来源段落（shared_source）");
    assert.equal(discoveryReasonLabel("text_overlap"), "标题/正文相似（text_overlap）");
  });

  it("discovers suggestions through the catalog, then batch confirms and rejects without auto-promoting", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const caseId = insertCard(workspace.db, {
        title: "Harbor delay case",
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content: "A harbor workshop filed a delayed shipment report with no overlapping vocabulary.",
      });
      const principleId = insertCard(workspace.db, {
        title: "Checklist principle",
        type: KNOWLEDGE_CARD_TYPE_PRINCIPLE,
        content: "Always rest the decision on a written checklist before approving a change.",
      });

      let lists = listRelationViews(workspace.db);
      assert.equal(lists.suggested.length, 0);
      assert.equal(lists.confirmed.length, 0);

      lists = discoverAndListRelationViews(workspace.db);
      assert.ok(lists.suggested.length >= 2);
      assert.equal(lists.confirmed.length, 0);
      assert.ok(lists.suggested.every((relation) => relation.status === RELATION_STATUS_SUGGESTED));
      const example = lists.suggested.find(
        (relation) => relation.fromCardId === caseId && relation.toCardId === principleId,
      );
      const support = lists.suggested.find(
        (relation) => relation.fromCardId === principleId && relation.toCardId === caseId,
      );
      assert.ok(example && support);
      assert.equal(example.reason, DISCOVERY_REASON_TYPE_RULE);
      assert.equal(example.relationType, RELATION_TYPE_EXAMPLE_OF);
      assert.equal(support.reason, DISCOVERY_REASON_TYPE_RULE);
      assert.equal(support.relationType, RELATION_TYPE_SUPPORTS);
      assert.equal(listConfirmedRelations(workspace.db).length, 0);

      const htmlSuggested = renderRelationsRoute(routeState(lists), [
        sampleCard(caseId, "Harbor delay case", "案例"),
        sampleCard(principleId, "Checklist principle"),
      ]);
      assert.match(htmlSuggested, new RegExp(`data-reason="${DISCOVERY_REASON_TYPE_RULE}"`));
      assert.match(htmlSuggested, /data-testid="confirmed-relations-empty"/);

      lists = confirmSuggestedRelations(workspace.db, [example.id]);
      assert.equal(lists.suggested.some((relation) => relation.id === example.id), false);
      assert.equal(lists.confirmed.some((relation) => relation.id === example.id && relation.status === RELATION_STATUS_VERIFIED), true);

      lists = rejectSuggestedRelations(workspace.db, [support.id]);
      assert.equal(lists.suggested.some((relation) => relation.id === support.id), false);
      assert.equal(lists.confirmed.some((relation) => relation.id === support.id), false);
      assert.equal(listSuggestedRelations(workspace.db).length, 0);
      assert.equal(listConfirmedRelations(workspace.db).length, 1);

      const again = discoverAndListRelationViews(workspace.db);
      assert.equal(again.suggested.some((relation) => relation.fromCardId === principleId && relation.toCardId === caseId), false);
      assert.equal(again.confirmed.some((relation) => relation.id === example.id), true);
    } finally {
      workspace.close();
    }
  });

  it("appends discovery IPC without rewriting merge/delete or the default route", () => {
    const preload = fs.readFileSync(PRELOAD_SOURCE, "utf8");
    assert.match(preload, /discoverKnowledgeRelations:/);
    assert.match(preload, /confirmSuggestedRelations:/);
    assert.match(preload, /rejectSuggestedRelations:/);
    assert.match(preload, /relations:discover/);
    assert.match(preload, /relations:confirmMany/);
    assert.match(preload, /relations:rejectMany/);

    const main = fs.readFileSync(MAIN_SOURCE, "utf8");
    assert.match(main, /relations:discover/);
    assert.match(main, /discoverAndListRelationViews/);
    assert.match(main, /DEFAULT_ROUTE_ID/);

    const knowledge = fs.readFileSync(KNOWLEDGE_SOURCE, "utf8");
    assert.doesNotMatch(knowledge, /INSERT INTO knowledge_relations/);

    const discoverSource = fs.readFileSync(RELATIONS_CORE_SOURCE, "utf8");
    const withoutComments = discoverSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const discoverStart = withoutComments.indexOf("export function discoverKnowledgeRelations");
    assert.ok(discoverStart >= 0);
    assert.doesNotMatch(withoutComments.slice(discoverStart), /RELATION_STATUS_VERIFIED|verified_by_user/);

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
      discoverKnowledgeRelations: async () => ({ suggested: [], confirmed: [] }),
      confirmSuggestedRelations: async () => ({ suggested: [], confirmed: [] }),
      rejectSuggestedRelations: async () => ({ suggested: [], confirmed: [] }),
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
    assert.equal(typeof bridge.discoverKnowledgeRelations, "function");
    assert.equal(emptyKnowledgeUiState().selectedCardId, null);
  });
});
