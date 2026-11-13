import assert from "node:assert/strict";
import fs from "node:fs";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_SKILL_NAME,
  DEFAULT_SKILL_VERSION,
  HOLLOW_ECHO_LABEL,
  HOLLOW_ECHO_PARAGRAPH_ID,
  HOLLOW_ECHO_SENTENCE,
  KNOWLEDGE_CARD_TYPE_CASE,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  UNSOURCED_INFERENCE_LABEL,
  openSliceWorkspace,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, PDF_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

describe("VERT-001 book-to-skill thin slice", () => {
  it("imports, cards, Skill, five follow-ups, citations, feedback, and survives reopen", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    let conversationId = "";
    let skillId = "";
    let skillVersionId = "";
    let principleCardId = "";
    let runId = "";
    let feedbackId = "";
    let caseCardId = "";
    let epubBookId = "";
    let pdfBookId = "";

    try {
      const epub = workspace.importBook(EPUB_FIXTURE);
      const pdf = workspace.importBook(PDF_FIXTURE);
      epubBookId = epub.id;
      pdfBookId = pdf.id;
      assert.equal(epub.format, "epub");
      assert.equal(pdf.format, "pdf");
      assert.ok(workspace.findChunkByParagraphId(epub, PRINCIPLE_PARAGRAPH_ID));
      assert.ok(workspace.findChunkByParagraphId(pdf, HOLLOW_ECHO_PARAGRAPH_ID));

      const draft = workspace.draftKnowledgeCardFromLocator(epub.id, PRINCIPLE_PARAGRAPH_ID);
      const card = workspace.confirmKnowledgeCard({
        cardId: draft.id,
        title: "知识卡必须引用段落定位符",
      });
      principleCardId = card.id;
      assert.equal(card.sources[0]?.paragraphId, PRINCIPLE_PARAGRAPH_ID);

      const throwaway = workspace.draftKnowledgeCardFromLocator(epub.id, "P2.4");
      workspace.deleteKnowledgeCard(throwaway.id);
      assert.equal(workspace.loadBook(epub.id).id, epub.id);

      const created = workspace.createRetrospectiveSkill(card.id);
      skillId = created.skill.id;
      skillVersionId = created.version.id;
      assert.equal(created.skill.name, DEFAULT_SKILL_NAME);
      assert.equal(created.version.version, DEFAULT_SKILL_VERSION);
      assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);

      const recommendations = workspace.recommendSkills("帮我准备一次项目复盘");
      assert.ok(recommendations.length >= 1);
      assert.equal(recommendations[0]?.skill.id, skillId);
      assert.match(recommendations[0]?.reason ?? "", /项目复盘/);

      const conversation = workspace.startConversation({
        title: "Harbor Lane 复盘",
        skillId,
        skillVersionId,
        selectionMethod: "recommended",
      });
      conversationId = conversation.id;

      const clarify = workspace.ask({
        conversationId,
        message: "帮我准备一次项目复盘",
      });
      assert.equal(clarify.skillVersionId, skillVersionId);
      assert.equal(clarify.answer.kind, "clarify");
      assert.deepEqual(clarify.answer.missingInputs, ["project_name"]);

      const prepared = workspace.ask({
        conversationId,
        message: "项目是 Harbor Lane 灯塔索引升级",
      });
      assert.equal(prepared.skillVersionId, skillVersionId);
      assert.equal(prepared.answer.kind, "answer");
      assert.equal(prepared.answer.confirmedInputs.project_name, "Harbor Lane 灯塔索引升级");
      const sourced = prepared.answer.claims.find((claim) => claim.grounding === "sourced");
      assert.ok(sourced);
      assert.equal(sourced?.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.match(sourced?.text ?? "", new RegExp(PRINCIPLE_SENTENCE));
      assert.match(prepared.answer.content, /\[P1\.3\]/);
      const inferred = prepared.answer.claims.find((claim) => claim.grounding === "unsourced");
      assert.equal(inferred?.label, UNSOURCED_INFERENCE_LABEL);
      assert.doesNotMatch(prepared.answer.content, new RegExp(`${HOLLOW_ECHO_SENTENCE}.*书中结论`));

      const sourceAsk = workspace.ask({
        conversationId,
        message: "这条原则的原书出处是什么？",
      });
      assert.equal(sourceAsk.skillVersionId, skillVersionId);
      assert.ok(sourceAsk.answer.claims.every((claim) => claim.grounding === "sourced"));
      assert.match(sourceAsk.assistantTurn.content, /BookSkill Test Primer/);
      assert.match(sourceAsk.assistantTurn.content, /\[P1\.3\]/);
      const evidence = workspace.loadEvidenceForTurn(sourceAsk.assistantTurn.id);
      assert.ok(evidence.some((item) => item.knowledgeCardId === principleCardId));

      const echoAsk = workspace.ask({
        conversationId,
        message: `${HOLLOW_ECHO_SENTENCE} 这是书里的结论吗？`,
      });
      assert.equal(echoAsk.skillVersionId, skillVersionId);
      const echoClaim = echoAsk.answer.claims.find((claim) => claim.id === "claim-hollow-echo");
      assert.ok(echoClaim);
      assert.equal(echoClaim?.grounding, "unsourced");
      assert.equal(echoClaim?.label, HOLLOW_ECHO_LABEL);
      assert.equal(echoClaim?.paragraphId, HOLLOW_ECHO_PARAGRAPH_ID);
      assert.match(echoAsk.assistantTurn.content, new RegExp(HOLLOW_ECHO_LABEL));
      assert.match(echoAsk.assistantTurn.content, /不是书中结论|不得伪装成书中结论/);
      assert.doesNotMatch(echoAsk.assistantTurn.content, /这是书中的原则|extracted principle|书中结论是 “Cedar/);

      const disagree = workspace.ask({
        conversationId,
        message: "如果两段意见不一致该怎么引用？",
      });
      assert.equal(disagree.skillVersionId, skillVersionId);
      assert.ok(disagree.answer.claims.some((claim) => claim.paragraphId === "P1.5" && claim.grounding === "sourced"));
      assert.ok(disagree.answer.claims.some((claim) => claim.label === UNSOURCED_INFERENCE_LABEL));

      const checklist = workspace.ask({
        conversationId,
        message: "请根据刚才的原则列一个检查清单",
      });
      assert.equal(checklist.skillVersionId, skillVersionId);
      assert.equal(checklist.conversation.turns.filter((turn) => turn.role === "user").length, 6);
      assert.ok(checklist.skillRun);
      runId = checklist.skillRun?.id ?? "";
      assert.equal(checklist.skillRun?.skillVersionId, skillVersionId);

      const bound = workspace.loadConversation(conversationId);
      assert.ok(bound.turns.every(() => bound.skillVersionId === skillVersionId));
      assert.equal(bound.selectionMethod, "recommended");

      const saved = workspace.saveFeedback({
        skillRunId: runId,
        rating: 5,
        reason: "来源清楚，空洞回声没有被当成书中结论。",
      });
      feedbackId = saved.feedback.id;
      caseCardId = saved.card.id;
      assert.equal(saved.feedback.rating, 5);
      assert.equal(saved.card.type, KNOWLEDGE_CARD_TYPE_CASE);
      assert.equal(saved.skillRun.skillVersionId, skillVersionId);

      const previousSnapshot = {
        inputs: created.version.inputs,
        steps: created.version.steps,
        rules: created.version.rules,
        outputSchema: created.version.outputSchema,
        permissions: created.version.permissions,
        createdAt: created.version.createdAt,
        version: created.version.version,
      };
      const bumped = workspace.createSkillVersion({
        skillId,
        version: "1.0.1",
        status: SKILL_STATUS_DRAFT,
        inputs: created.version.inputs,
        steps: created.version.steps,
        rules: [...(created.version.rules as unknown[]), "根据反馈补充空洞回声检查。"],
        outputSchema: created.version.outputSchema,
        permissions: created.version.permissions,
        knowledgeCardIds: created.version.knowledgeCardIds,
      });
      assert.notEqual(bumped.version.id, skillVersionId);
      assert.equal(bumped.previousVersion.id, skillVersionId);
      assert.equal(bumped.previousVersion.version, DEFAULT_SKILL_VERSION);
      assert.deepEqual(
        {
          inputs: bumped.previousVersion.inputs,
          steps: bumped.previousVersion.steps,
          rules: bumped.previousVersion.rules,
          outputSchema: bumped.previousVersion.outputSchema,
          permissions: bumped.previousVersion.permissions,
          createdAt: bumped.previousVersion.createdAt,
          version: bumped.previousVersion.version,
        },
        previousSnapshot,
      );
      assert.notEqual(bumped.skill.status, SKILL_STATUS_PUBLISHED);
      const rebound = workspace.loadConversation(conversationId);
      assert.equal(rebound.skillVersionId, skillVersionId);

      const before = workspace.snapshot();
      assert.equal(before.books, 2);
      assert.ok(before.knowledgeCards >= 2);
      assert.equal(before.skills, 1);
      assert.equal(before.conversations, 1);
      assert.equal(before.feedback, 1);
      assert.equal(before.schemaVersion, 2);
      assert.ok(fs.existsSync(before.dbPath));
    } finally {
      workspace.close();
    }

    const reopened = openSliceWorkspace({ env: temp.env, platform: "linux" });
    try {
      const epub = reopened.loadBook(epubBookId);
      const pdf = reopened.loadBook(pdfBookId);
      assert.equal(epub.title, "BookSkill Test Primer");
      assert.equal(pdf.format, "pdf");
      assert.equal(
        reopened.findChunkByParagraphId(epub, PRINCIPLE_PARAGRAPH_ID).location.paragraphId,
        PRINCIPLE_PARAGRAPH_ID,
      );
      const card = reopened.loadKnowledgeCard(principleCardId);
      assert.equal(card.sources[0]?.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      const conversation = reopened.loadConversation(conversationId);
      assert.equal(conversation.skillVersionId, skillVersionId);
      assert.equal(conversation.turns.filter((turn) => turn.role === "user").length, 6);
      const evidenceTurns = conversation.turns.filter((turn) => turn.role === "assistant").slice(1);
      assert.ok(evidenceTurns.length >= 1);
      const refs = reopened.loadEvidenceForTurn(evidenceTurns[0]!.id);
      assert.ok(refs.length >= 1);
      const skill = reopened.loadSkill(skillId);
      const originalVersion = reopened.loadSkillVersion(skillVersionId);
      assert.equal(originalVersion.version, DEFAULT_SKILL_VERSION);
      assert.ok(skill.currentVersionId);
      assert.notEqual(skill.currentVersionId, skillVersionId);
      const caseCard = reopened.loadKnowledgeCard(caseCardId);
      assert.equal(caseCard.type, KNOWLEDGE_CARD_TYPE_CASE);
      const feedbackRows = reopened.db.prepare(`SELECT id, rating FROM feedback WHERE id = ?`).get(feedbackId) as {
        id: string;
        rating: number;
      };
      assert.equal(feedbackRows.rating, 5);
      const snapshot = reopened.snapshot();
      assert.equal(snapshot.books, 2);
      assert.equal(snapshot.feedback, 1);
      assert.equal(snapshot.dataDir, temp.dataDir);
    } finally {
      reopened.close();
    }
  });
});
