import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  PRINCIPLE_PARAGRAPH_ID,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SKILL_STATUS_TESTED,
  confirmKnowledgeCard,
  createSkill,
  createSkillVersion,
  deleteKnowledgeCard,
  listKnowledgeCardRevisions,
  listSkillVersions,
  listSkills,
  loadKnowledgeCard,
  loadKnowledgeCardRevision,
  loadSkillVersion,
  mergeKnowledgeCards,
  rollbackKnowledgeCardToRevision,
  rollbackSkillToVersion,
  summarizeKnowledgeCardRevisionDiff,
  summarizeSkillVersionDiff,
  transitionSkillStatus,
  updateKnowledgeCard,
  updateSkillMetadata,
} from "../src/index.ts";
import type { KnowledgeCardRevisionRecord, SkillVersionRecord } from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function snapshotVersion(version: SkillVersionRecord) {
  return {
    inputs: version.inputs,
    steps: version.steps,
    rules: version.rules,
    outputSchema: version.outputSchema,
    permissions: version.permissions,
    knowledgeCardIds: version.knowledgeCardIds,
  };
}

function snapshotRevision(revision: KnowledgeCardRevisionRecord) {
  return {
    id: revision.id,
    cardId: revision.cardId,
    revision: revision.revision,
    title: revision.title,
    type: revision.type,
    content: revision.content,
    conditions: revision.conditions,
    limitations: revision.limitations,
    status: revision.status,
    createdAt: revision.createdAt,
  };
}

describe("VER-001 skill version history", () => {
  it("lists versions, rolls back to the first snapshot, and keeps history append-only", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const created = createSkill({
        db: workspace.db,
        name: "Review prep",
        domain: "专业",
        purpose: "Prepare a sourced project review.",
        status: SKILL_STATUS_TESTED,
        version: "1.0.0",
        inputs: [{ name: "project_name", required: true, description: "Project to review" }],
        steps: [{ id: "collect", text: "Collect the project name." }],
        rules: ["Cite a paragraph locator for every book claim."],
        outputSchema: { type: "object" },
        permissions: { network: false, writeFiles: false },
      });
      const firstSnapshot = snapshotVersion(created.version);
      assert.equal(created.skill.status, SKILL_STATUS_TESTED);
      assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);

      const listedSkills = listSkills(workspace.db);
      assert.equal(listedSkills.length, 1);
      assert.equal(listedSkills[0]?.id, created.skill.id);

      const second = createSkillVersion({
        db: workspace.db,
        skillId: created.skill.id,
        version: "1.1.0",
        inputs: [{ name: "project_name", required: true, description: "Updated project input" }],
        steps: [
          { id: "collect", text: "Collect the project name." },
          { id: "cite", text: "Cite the confirmed card." },
        ],
        rules: ["Flag unsourced inferences."],
        outputSchema: { type: "object", properties: { content: { type: "string" } } },
        permissions: { network: false, writeFiles: false, modelProvider: "local-stub" },
      });
      assert.notEqual(second.skill.status, SKILL_STATUS_PUBLISHED);
      const versionsAfterEdit = listSkillVersions(workspace.db, created.skill.id);
      assert.ok(versionsAfterEdit.length >= 2);
      assert.equal(versionsAfterEdit[0]?.id, created.version.id);
      assert.equal(versionsAfterEdit[1]?.id, second.version.id);
      assert.deepEqual(
        summarizeSkillVersionDiff(created.version, second.version).sort(),
        ["inputs", "knowledgeCardIds", "outputSchema", "permissions", "rules", "steps"].filter((field) =>
          JSON.stringify(firstSnapshot[field as keyof typeof firstSnapshot]) !==
          JSON.stringify(snapshotVersion(second.version)[field as keyof typeof firstSnapshot]),
        ).sort(),
      );
      assert.ok(summarizeSkillVersionDiff(created.version, second.version).includes("steps"));

      const firstRowBefore = loadSkillVersion(workspace.db, created.version.id);
      const secondRowBefore = loadSkillVersion(workspace.db, second.version.id);

      const rolled = rollbackSkillToVersion({
        db: workspace.db,
        skillId: created.skill.id,
        versionId: created.version.id,
      });
      assert.equal(rolled.skill.currentVersionId, rolled.version.id);
      assert.notEqual(rolled.version.id, created.version.id);
      assert.notEqual(rolled.version.id, second.version.id);
      assert.match(rolled.version.version, /^1\.0\.0\+rollback-[0-9a-f]{8}$/i);
      assert.deepEqual(snapshotVersion(rolled.version), firstSnapshot);
      assert.notEqual(rolled.skill.status, SKILL_STATUS_PUBLISHED);
      assert.equal(rolled.skill.status, SKILL_STATUS_DRAFT);
      assert.equal(rolled.rolledBackFrom.id, second.version.id);

      const history = listSkillVersions(workspace.db, created.skill.id);
      assert.ok(history.length >= 3);
      assert.equal(history.length, 3);
      assert.deepEqual(
        history.map((row) => row.id),
        [created.version.id, second.version.id, rolled.version.id],
      );

      const firstRowAfter = loadSkillVersion(workspace.db, created.version.id);
      const secondRowAfter = loadSkillVersion(workspace.db, second.version.id);
      assert.deepEqual(snapshotVersion(firstRowAfter), snapshotVersion(firstRowBefore));
      assert.deepEqual(snapshotVersion(secondRowAfter), snapshotVersion(secondRowBefore));
      assert.equal(firstRowAfter.version, firstRowBefore.version);
      assert.equal(firstRowAfter.createdAt, firstRowBefore.createdAt);
      assert.equal(secondRowAfter.version, secondRowBefore.version);
      assert.equal(secondRowAfter.createdAt, secondRowBefore.createdAt);

      const current = loadSkillVersion(workspace.db, rolled.skill.currentVersionId!);
      assert.deepEqual(snapshotVersion(current), firstSnapshot);
    } finally {
      workspace.close();
    }
  });

  it("demotes a published skill to draft on rollback and never auto-publishes", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const created = createSkill({
        db: workspace.db,
        name: "Published rollback probe",
        domain: "专业",
        purpose: "Prove rollback does not stay published.",
        inputs: [{ name: "topic", required: true, description: "Topic" }],
        steps: [{ id: "ask", text: "Ask for the topic." }],
        rules: ["Do not auto-publish."],
        outputSchema: { type: "object" },
        permissions: { network: false },
      });
      assert.throws(
        () =>
          createSkill({
            db: workspace.db,
            name: "Blocked publish",
            domain: "专业",
            purpose: "Must not auto-publish on create.",
            status: SKILL_STATUS_PUBLISHED,
            inputs: [],
            steps: [],
            rules: [],
            outputSchema: {},
            permissions: {},
          }),
        /must not be auto-published/,
      );

      const published = transitionSkillStatus({
        db: workspace.db,
        skillId: created.skill.id,
        status: SKILL_STATUS_PUBLISHED,
      });
      assert.equal(published.status, SKILL_STATUS_PUBLISHED);

      const second = createSkillVersion({
        db: workspace.db,
        skillId: created.skill.id,
        version: "1.1.0",
        inputs: [{ name: "topic", required: true, description: "Updated topic" }],
        steps: [{ id: "ask", text: "Ask again." }],
        rules: ["Still do not auto-publish."],
        outputSchema: { type: "object" },
        permissions: { network: false },
      });
      assert.notEqual(second.skill.status, SKILL_STATUS_PUBLISHED);
      assert.equal(second.skill.status, SKILL_STATUS_DRAFT);

      const republished = transitionSkillStatus({
        db: workspace.db,
        skillId: created.skill.id,
        status: SKILL_STATUS_PUBLISHED,
      });
      assert.equal(republished.status, SKILL_STATUS_PUBLISHED);

      const rolled = rollbackSkillToVersion({
        db: workspace.db,
        skillId: created.skill.id,
        versionId: created.version.id,
      });
      assert.equal(rolled.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(rolled.skill.status, SKILL_STATUS_PUBLISHED);
      assert.deepEqual(snapshotVersion(rolled.version), snapshotVersion(created.version));
      assert.ok(listSkillVersions(workspace.db, created.skill.id).length >= 3);
    } finally {
      workspace.close();
    }
  });

  it("updates skill metadata without changing status", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const created = createSkill({
        db: workspace.db,
        name: "Original name",
        domain: "专业",
        purpose: "Original purpose",
        status: SKILL_STATUS_TESTED,
        inputs: [],
        steps: [],
        rules: [],
        outputSchema: {},
        permissions: {},
      });
      const updated = updateSkillMetadata({
        db: workspace.db,
        skillId: created.skill.id,
        name: "Renamed skill",
        purpose: "Updated purpose",
      });
      assert.equal(updated.name, "Renamed skill");
      assert.equal(updated.domain, "专业");
      assert.equal(updated.purpose, "Updated purpose");
      assert.equal(updated.status, SKILL_STATUS_TESTED);
    } finally {
      workspace.close();
    }
  });
});

describe("VER-001 knowledge card revisions", () => {
  it("appends revisions on draft, edit, and confirm, and rolls back body without auto-confirming", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const afterDraft = listKnowledgeCardRevisions(workspace.db, draft.id);
      assert.equal(afterDraft.length, 1);
      assert.equal(afterDraft[0]?.revision, 1);
      assert.equal(afterDraft[0]?.title, draft.title);
      assert.equal(afterDraft[0]?.content, draft.content);
      assert.equal(afterDraft[0]?.status, KNOWLEDGE_CARD_STATUS_DRAFT);

      const preEdit = afterDraft[0]!;
      const edited = updateKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
        title: "Edited title",
        content: "Edited body that must be rollbackable.",
        conditions: "only while testing rollback",
        limitations: "do not auto-confirm",
      });
      assert.equal(edited.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      const afterEdit = listKnowledgeCardRevisions(workspace.db, draft.id);
      assert.equal(afterEdit.length, 2);
      assert.equal(afterEdit[1]?.title, "Edited title");
      assert.equal(afterEdit[1]?.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.deepEqual(snapshotRevision(afterEdit[0]!), snapshotRevision(preEdit));
      assert.ok(summarizeKnowledgeCardRevisionDiff(afterEdit[0]!, afterEdit[1]!).includes("title"));
      assert.ok(summarizeKnowledgeCardRevisionDiff(afterEdit[0]!, afterEdit[1]!).includes("content"));

      const confirmed = confirmKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
      });
      assert.equal(confirmed.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      const afterConfirm = listKnowledgeCardRevisions(workspace.db, draft.id);
      assert.equal(afterConfirm.length, 3);
      assert.equal(afterConfirm[2]?.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(afterConfirm[2]?.title, "Edited title");
      const rowsBeforeRollback = afterConfirm.map(snapshotRevision);

      const rolledToDraftBody = rollbackKnowledgeCardToRevision({
        db: workspace.db,
        cardId: draft.id,
        revisionId: preEdit.id,
      });
      assert.equal(rolledToDraftBody.title, preEdit.title);
      assert.equal(rolledToDraftBody.content, preEdit.content);
      assert.equal(rolledToDraftBody.conditions, preEdit.conditions);
      assert.equal(rolledToDraftBody.limitations, preEdit.limitations);
      assert.equal(rolledToDraftBody.type, preEdit.type);
      assert.equal(rolledToDraftBody.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.notEqual(rolledToDraftBody.status, KNOWLEDGE_CARD_STATUS_DRAFT);

      const afterRollback = listKnowledgeCardRevisions(workspace.db, draft.id);
      assert.equal(afterRollback.length, 4);
      assert.equal(afterRollback[3]?.title, preEdit.title);
      assert.equal(afterRollback[3]?.content, preEdit.content);
      assert.equal(afterRollback[3]?.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.deepEqual(afterRollback.slice(0, 3).map(snapshotRevision), rowsBeforeRollback);

      const loaded = loadKnowledgeCardRevision(workspace.db, preEdit.id);
      assert.deepEqual(snapshotRevision(loaded), snapshotRevision(preEdit));

      const reconfirmed = confirmKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
        title: "Confirmed after rollback",
      });
      assert.equal(reconfirmed.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(reconfirmed.title, "Confirmed after rollback");
      assert.equal(listKnowledgeCardRevisions(workspace.db, draft.id).length, 5);
    } finally {
      workspace.close();
    }
  });

  it("keeps a draft draft when rolling back, and does not rewrite earlier revision rows", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const original = listKnowledgeCardRevisions(workspace.db, draft.id)[0]!;
      const edited = updateKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
        title: "Temporary edit",
        content: "This edit should be rolled back while the card stays a draft.",
      });
      assert.equal(edited.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      const before = listKnowledgeCardRevisions(workspace.db, draft.id).map(snapshotRevision);

      const rolled = rollbackKnowledgeCardToRevision({
        db: workspace.db,
        cardId: draft.id,
        revisionId: original.id,
      });
      assert.equal(rolled.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.notEqual(rolled.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(rolled.title, original.title);
      assert.equal(rolled.content, original.content);

      const after = listKnowledgeCardRevisions(workspace.db, draft.id);
      assert.equal(after.length, 3);
      assert.deepEqual(after.slice(0, 2).map(snapshotRevision), before);
    } finally {
      workspace.close();
    }
  });

  it("deletes revision rows with the card and leaves the book and source chunks", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const chunkCount = book.chunks.length;
      const draft = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      updateKnowledgeCard({
        db: workspace.db,
        cardId: draft.id,
        title: "Soon deleted",
      });
      assert.equal(listKnowledgeCardRevisions(workspace.db, draft.id).length, 2);

      deleteKnowledgeCard(workspace.db, draft.id);
      assert.throws(() => loadKnowledgeCard(workspace.db, draft.id), /not found/);
      const leftover = workspace.db
        .prepare(`SELECT COUNT(*) AS n FROM knowledge_card_revisions WHERE card_id = ?`)
        .get(draft.id) as { n: number };
      assert.equal(leftover.n, 0);
      const reloaded = workspace.loadBook(book.id);
      assert.equal(reloaded.title, "BookSkill Test Primer");
      assert.equal(reloaded.chunks.length, chunkCount);
      assert.ok(reloaded.chunks.some((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID));
    } finally {
      workspace.close();
    }
  });

  it("merges without changing surviving status, appends a survivor revision, and cleans absorbed history", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const chunkCount = book.chunks.length;
      const surviving = workspace.draftKnowledgeCardFromLocator(book.id, PRINCIPLE_PARAGRAPH_ID);
      const absorbed = workspace.draftKnowledgeCardFromLocator(book.id, "P1.5");
      assert.equal(listKnowledgeCardRevisions(workspace.db, surviving.id).length, 1);
      assert.equal(listKnowledgeCardRevisions(workspace.db, absorbed.id).length, 1);

      const merged = mergeKnowledgeCards({
        db: workspace.db,
        survivingCardId: surviving.id,
        absorbedCardId: absorbed.id,
      });
      assert.equal(merged.id, surviving.id);
      assert.equal(merged.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(merged.sources.length, 2);
      assert.throws(() => loadKnowledgeCard(workspace.db, absorbed.id), /not found/);

      const survivorRevisions = listKnowledgeCardRevisions(workspace.db, surviving.id);
      assert.equal(survivorRevisions.length, 2);
      assert.equal(survivorRevisions[1]?.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.equal(survivorRevisions[1]?.title, surviving.title);
      const absorbedLeftover = workspace.db
        .prepare(`SELECT COUNT(*) AS n FROM knowledge_card_revisions WHERE card_id = ?`)
        .get(absorbed.id) as { n: number };
      assert.equal(absorbedLeftover.n, 0);

      const relationCount = (
        workspace.db.prepare(`SELECT COUNT(*) AS n FROM knowledge_relations`).get() as { n: number }
      ).n;
      assert.equal(relationCount, 0);
      const reloadedBook = workspace.loadBook(book.id);
      assert.equal(reloadedBook.chunks.length, chunkCount);
    } finally {
      workspace.close();
    }
  });
});
