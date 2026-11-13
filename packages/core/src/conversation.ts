import type { DatabaseSync } from "node:sqlite";
import { KNOWLEDGE_CARD_STATUS_DRAFT, KNOWLEDGE_CARD_TYPE_CASE } from "./constants.ts";
import { loadBook } from "./import-book.ts";
import { loadKnowledgeCard } from "./knowledge.ts";
import { loadSkill, loadSkillVersion } from "./skills.ts";
import { runStubAdapter } from "./stub-adapter.ts";
import type {
  AssistantAnswer,
  CaseRecord,
  ConversationRecord,
  ConversationTurnRecord,
  FeedbackRecord,
  ImportedBook,
  KnowledgeCardRecord,
  SkillRunRecord,
} from "./types.ts";
import { newId, nowIso, withTransaction } from "./util.ts";

export type StartConversationOptions = {
  db: DatabaseSync;
  title: string;
  skillId: string;
  skillVersionId: string;
  selectionMethod: "recommended" | "manual";
  now?: Date;
};

export type AskOptions = {
  db: DatabaseSync;
  conversationId: string;
  message: string;
  now?: Date;
};

export type AskResult = {
  conversation: ConversationRecord;
  userTurn: ConversationTurnRecord;
  assistantTurn: ConversationTurnRecord;
  answer: AssistantAnswer;
  skillRun: SkillRunRecord | null;
  skillVersionId: string;
};

export type SaveFeedbackOptions = {
  db: DatabaseSync;
  skillRunId: string;
  rating: number;
  reason?: string;
  now?: Date;
};

export function startConversation(options: StartConversationOptions): ConversationRecord {
  const skill = loadSkill(options.db, options.skillId);
  const version = loadSkillVersion(options.db, options.skillVersionId);
  if (version.skillId !== skill.id) {
    throw new Error("Skill version does not belong to the selected Skill");
  }
  if (skill.currentVersionId && skill.currentVersionId !== version.id) {
    // Binding a historical version is allowed; we just record the chosen one.
  }
  const stamp = nowIso(options.now);
  const id = newId();
  withTransaction(options.db, () => {
    options.db
      .prepare(
        `INSERT INTO conversations(id, title, mode, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(id, options.title, "skill", stamp, stamp, null);
    options.db
      .prepare(
        `INSERT INTO conversation_skill_bindings(id, conversation_id, skill_id, skill_version_id, selection_method)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(newId(), id, skill.id, version.id, options.selectionMethod);
  });
  return loadConversation(options.db, id);
}

export function ask(options: AskOptions): AskResult {
  const conversation = loadConversation(options.db, options.conversationId);
  const boundVersionId = conversation.skillVersionId;
  const version = loadSkillVersion(options.db, boundVersionId);
  const books = loadWorkspaceBooks(options.db);
  const cards = version.knowledgeCardIds.map((id) => loadKnowledgeCard(options.db, id));
  const stamp = nowIso(options.now);

  return withTransaction(options.db, () => {
    const userTurnId = newId();
    options.db
      .prepare(
        `INSERT INTO conversation_turns(id, conversation_id, role, content, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(userTurnId, conversation.id, "user", options.message, stamp, "complete");

    const priorInputs = latestInputs(options.db, conversation.id);
    const userMessages = [...conversation.turns.filter((turn) => turn.role === "user").map((turn) => turn.content), options.message];
    const answer = runStubAdapter({
      skillVersion: version,
      books,
      knowledgeCards: cards,
      userMessages,
      confirmedInputs: priorInputs,
    });

    const assistantTurnId = newId();
    options.db
      .prepare(
        `INSERT INTO conversation_turns(id, conversation_id, role, content, created_at, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(assistantTurnId, conversation.id, "assistant", answer.content, stamp, "complete");

    for (const claim of answer.claims) {
      options.db
        .prepare(
          `INSERT INTO evidence_refs(id, turn_id, source_chunk_id, knowledge_card_id, claim_id)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(newId(), assistantTurnId, claim.sourceChunkId, claim.knowledgeCardId, claim.id);
    }

    let skillRun: SkillRunRecord | null = loadOpenSkillRun(options.db, conversation.id, boundVersionId);
    const runStatus = answer.kind === "clarify" ? "awaiting_input" : "succeeded";
    if (!skillRun) {
      const runId = newId();
      options.db
        .prepare(
          `INSERT INTO skill_runs(id, conversation_id, skill_version_id, inputs_json, result_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          runId,
          conversation.id,
          boundVersionId,
          JSON.stringify(answer.confirmedInputs),
          JSON.stringify({ kind: answer.kind, claims: answer.claims }),
          runStatus,
          stamp,
        );
      skillRun = loadSkillRun(options.db, runId);
    } else {
      options.db
        .prepare(`UPDATE skill_runs SET inputs_json = ?, result_json = ?, status = ? WHERE id = ?`)
        .run(
          JSON.stringify(answer.confirmedInputs),
          JSON.stringify({ kind: answer.kind, claims: answer.claims }),
          runStatus,
          skillRun.id,
        );
      skillRun = loadSkillRun(options.db, skillRun.id);
    }

    options.db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(stamp, conversation.id);

    const updated = loadConversation(options.db, conversation.id);
    const userTurn = updated.turns.find((turn) => turn.id === userTurnId);
    const assistantTurn = updated.turns.find((turn) => turn.id === assistantTurnId);
    if (!userTurn || !assistantTurn) {
      throw new Error("Failed to reload conversation turns");
    }
    if (updated.skillVersionId !== boundVersionId) {
      throw new Error("Skill version binding changed mid-conversation");
    }
    return {
      conversation: updated,
      userTurn,
      assistantTurn,
      answer,
      skillRun,
      skillVersionId: boundVersionId,
    } satisfies AskResult;
  });
}

export function saveFeedback(options: SaveFeedbackOptions): CaseRecord {
  const run = loadSkillRun(options.db, options.skillRunId);
  const stamp = nowIso(options.now);
  const feedbackId = newId();
  const cardId = newId();
  withTransaction(options.db, () => {
    options.db
      .prepare(
        `INSERT INTO feedback(id, skill_run_id, rating, reason, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(feedbackId, run.id, options.rating, options.reason ?? null, stamp);
    options.db
      .prepare(
        `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        cardId,
        `项目复盘运行案例`,
        KNOWLEDGE_CARD_TYPE_CASE,
        JSON.stringify({
          skillRunId: run.id,
          skillVersionId: run.skillVersionId,
          inputs: run.inputs,
          rating: options.rating,
          reason: options.reason ?? null,
        }),
        "由用户反馈生成的案例记录，不是自动发布的 Skill。",
        "不得覆盖既有 Skill 版本。",
        KNOWLEDGE_CARD_STATUS_DRAFT,
        stamp,
        stamp,
      );
  });
  return {
    card: loadKnowledgeCard(options.db, cardId),
    feedback: loadFeedback(options.db, feedbackId),
    skillRun: loadSkillRun(options.db, run.id),
  };
}

export function loadConversation(db: DatabaseSync, conversationId: string): ConversationRecord {
  const row = db
    .prepare(
      `SELECT id, title, mode, created_at, updated_at FROM conversations WHERE id = ?`,
    )
    .get(conversationId) as
    | { id: string; title: string; mode: string; created_at: string; updated_at: string }
    | undefined;
  if (!row) {
    throw new Error(`Conversation not found: ${conversationId}`);
  }
  const binding = db
    .prepare(
      `SELECT skill_id, skill_version_id, selection_method
       FROM conversation_skill_bindings WHERE conversation_id = ?`,
    )
    .get(conversationId) as
    | { skill_id: string; skill_version_id: string; selection_method: string }
    | undefined;
  if (!binding) {
    throw new Error(`Conversation ${conversationId} is missing a Skill binding`);
  }
  const turns = db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at, status
       FROM conversation_turns WHERE conversation_id = ? ORDER BY created_at, rowid`,
    )
    .all(conversationId) as Array<{
    id: string;
    conversation_id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
    status: string;
  }>;
  return {
    id: row.id,
    title: row.title,
    mode: row.mode,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    skillId: binding.skill_id,
    skillVersionId: binding.skill_version_id,
    selectionMethod: binding.selection_method,
    turns: turns.map((turn) => ({
      id: turn.id,
      conversationId: turn.conversation_id,
      role: turn.role,
      content: turn.content,
      createdAt: turn.created_at,
      status: turn.status,
    })),
  };
}

export function loadSkillRun(db: DatabaseSync, runId: string): SkillRunRecord {
  const row = db
    .prepare(
      `SELECT id, conversation_id, skill_version_id, inputs_json, result_json, status, created_at
       FROM skill_runs WHERE id = ?`,
    )
    .get(runId) as
    | {
        id: string;
        conversation_id: string;
        skill_version_id: string;
        inputs_json: string;
        result_json: string | null;
        status: string;
        created_at: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`Skill run not found: ${runId}`);
  }
  return {
    id: row.id,
    conversationId: row.conversation_id,
    skillVersionId: row.skill_version_id,
    inputs: JSON.parse(row.inputs_json) as Record<string, string>,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function loadFeedback(db: DatabaseSync, feedbackId: string): FeedbackRecord {
  const row = db
    .prepare(`SELECT id, skill_run_id, rating, reason, created_at FROM feedback WHERE id = ?`)
    .get(feedbackId) as
    | { id: string; skill_run_id: string; rating: number; reason: string | null; created_at: string }
    | undefined;
  if (!row) {
    throw new Error(`Feedback not found: ${feedbackId}`);
  }
  return {
    id: row.id,
    skillRunId: row.skill_run_id,
    rating: row.rating,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export function loadEvidenceForTurn(db: DatabaseSync, turnId: string): Array<{
  id: string;
  sourceChunkId: string | null;
  knowledgeCardId: string | null;
  claimId: string | null;
}> {
  const rows = db
    .prepare(
      `SELECT id, source_chunk_id, knowledge_card_id, claim_id FROM evidence_refs WHERE turn_id = ? ORDER BY rowid`,
    )
    .all(turnId) as Array<{
    id: string;
    source_chunk_id: string | null;
    knowledge_card_id: string | null;
    claim_id: string | null;
  }>;
  return rows.map((row) => ({
    id: row.id,
    sourceChunkId: row.source_chunk_id,
    knowledgeCardId: row.knowledge_card_id,
    claimId: row.claim_id,
  }));
}

function loadOpenSkillRun(db: DatabaseSync, conversationId: string, skillVersionId: string): SkillRunRecord | null {
  const row = db
    .prepare(
      `SELECT id FROM skill_runs
       WHERE conversation_id = ? AND skill_version_id = ?
       ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(conversationId, skillVersionId) as { id: string } | undefined;
  return row ? loadSkillRun(db, row.id) : null;
}

function latestInputs(db: DatabaseSync, conversationId: string): Record<string, string> {
  const row = db
    .prepare(
      `SELECT inputs_json FROM skill_runs WHERE conversation_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(conversationId) as { inputs_json: string } | undefined;
  return row ? (JSON.parse(row.inputs_json) as Record<string, string>) : {};
}

function loadWorkspaceBooks(db: DatabaseSync): ImportedBook[] {
  const rows = db.prepare(`SELECT id FROM books ORDER BY created_at, rowid`).all() as Array<{ id: string }>;
  return rows.map((row) => loadBook(db, row.id));
}
