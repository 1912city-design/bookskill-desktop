import {
  ask,
  createSkill,
  DEFAULT_SKILL_DOMAIN,
  DEFAULT_SKILL_VERSION,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  listKnowledgeCards,
  loadConversation,
  loadEvidenceForTurn,
  SKILL_STATUS_PUBLISHED,
  SKILL_STATUS_TESTED,
  startConversation,
  UNSOURCED_INFERENCE_LABEL,
  type AnswerClaim,
  type SkillInputSpec,
} from "@bookskill/core";
import type { DatabaseSync } from "node:sqlite";
import type {
  ChatClaimView,
  ChatConversationSummary,
  ChatConversationView,
  ChatTurnView,
} from "../renderer/chat/types.ts";

export const SHELL_SKILL_NAME = "本机问题对话";
export const SHELL_SKILL_PURPOSE =
  "根据可追溯的知识卡原则，帮助准备一次项目复盘，并明确区分书中来源与无来源推断。";

export type ShellSkillRef = {
  skillId: string;
  skillVersionId: string;
};

type SkillRow = {
  skill_id: string;
  current_version_id: string | null;
  inputs_json: string;
  status: string;
};

type ChunkRow = {
  chapter: string | null;
  page: number | null;
  location_json: string | null;
  text: string;
  book_title: string;
};

/**
 * Create or reuse an unpublished/tested local stub skill with no required
 * inputs, so a first question like「这条原则的原书出处是什么？」can return
 * sourced claims without a clarify round-trip. Never publishes a Skill.
 * May bind an already-confirmed knowledge card, but never auto-confirms a draft.
 */
export function ensureShellSkill(db: DatabaseSync): ShellSkillRef {
  const existing = findShellSkill(db);
  if (existing) {
    return existing;
  }

  const confirmedIds = listKnowledgeCards(db)
    .filter((card) => card.status === KNOWLEDGE_CARD_STATUS_VERIFIED)
    .map((card) => card.id);

  const created = createSkill({
    db,
    name: SHELL_SKILL_NAME,
    domain: DEFAULT_SKILL_DOMAIN,
    purpose: SHELL_SKILL_PURPOSE,
    status: SKILL_STATUS_TESTED,
    version: DEFAULT_SKILL_VERSION,
    inputs: [],
    steps: [
      { id: "collect", text: "确认问题与本次上下文。" },
      { id: "cite", text: "用已导入书籍和可追溯的知识卡组织回答。" },
      { id: "flag", text: "把没有来源的内容明确标注出来。" },
    ],
    rules: [
      "每次给出书中结论时必须引用段落定位符。",
      "没有来源的内容必须标注为模型建议/一般推断。",
      "空洞回声句子不得伪装成书中结论。",
      "对话期间不得切换 Skill 版本。",
      "不得自动把草稿发布为正式 Skill。",
    ],
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        claims: { type: "array" },
      },
    },
    permissions: {
      network: false,
      writeFiles: false,
      modelProvider: "local-stub",
    },
    knowledgeCardIds: confirmedIds.slice(0, 1),
  });

  if (created.skill.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("本机对话 Skill 不得被自动发布。");
  }
  if (!created.skill.currentVersionId) {
    throw new Error("本机对话 Skill 没有当前版本。");
  }
  return { skillId: created.skill.id, skillVersionId: created.skill.currentVersionId };
}

export function startProductConversation(
  db: DatabaseSync,
  title?: string,
): ChatConversationView {
  const skill = ensureShellSkill(db);
  const started = startConversation({
    db,
    title: titleFromMessage(title ?? "") || "问题对话",
    skillId: skill.skillId,
    skillVersionId: skill.skillVersionId,
    selectionMethod: "manual",
  });
  return loadConversationView(db, started.id);
}

export function askOnProductPath(
  db: DatabaseSync,
  input: { message: string; conversationId?: string; title?: string },
): ChatConversationView {
  const message = input.message.trim();
  if (!message) {
    throw new Error("请输入要问的问题。");
  }
  const skill = ensureShellSkill(db);
  const conversationId =
    input.conversationId?.trim() ||
    startConversation({
      db,
      title: titleFromMessage(input.title ?? message),
      skillId: skill.skillId,
      skillVersionId: skill.skillVersionId,
      selectionMethod: "manual",
    }).id;
  const result = ask({ db, conversationId, message });
  const view = loadConversationView(db, result.conversation.id);
  return {
    ...view,
    turns: view.turns.map((turn) =>
      turn.id === result.assistantTurn.id
        ? {
            ...turn,
            content: result.answer.content,
            claims: result.answer.claims.map(claimToView),
          }
        : turn,
    ),
  };
}

export function listConversationSummaries(db: DatabaseSync): ChatConversationSummary[] {
  const rows = db
    .prepare(
      `SELECT id, title, updated_at
       FROM conversations
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC, rowid DESC`,
    )
    .all() as Array<{ id: string; title: string; updated_at: string }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}

export function loadLatestConversationView(db: DatabaseSync): ChatConversationView | null {
  const row = db
    .prepare(
      `SELECT id FROM conversations
       WHERE deleted_at IS NULL
       ORDER BY updated_at DESC, rowid DESC
       LIMIT 1`,
    )
    .get() as { id: string } | undefined;
  return row ? loadConversationView(db, row.id) : null;
}

export function loadConversationView(db: DatabaseSync, conversationId: string): ChatConversationView {
  const conversation = loadConversation(db, conversationId);
  const turns: ChatTurnView[] = conversation.turns.map((turn) => ({
    id: turn.id,
    role: turn.role,
    content: turn.content,
    claims: turn.role === "assistant" ? claimsFromEvidence(db, turn.id) : [],
  }));
  return {
    id: conversation.id,
    title: conversation.title,
    turns,
  };
}

function findShellSkill(db: DatabaseSync): ShellSkillRef | null {
  const rows = db
    .prepare(
      `SELECT s.id AS skill_id, s.status, s.current_version_id, v.inputs_json
       FROM skills s
       JOIN skill_versions v ON v.id = s.current_version_id
       WHERE s.name = ?
       ORDER BY s.created_at, s.rowid`,
    )
    .all(SHELL_SKILL_NAME) as SkillRow[];
  for (const row of rows) {
    if (row.status === SKILL_STATUS_PUBLISHED || !row.current_version_id) {
      continue;
    }
    const inputs = JSON.parse(row.inputs_json) as SkillInputSpec[];
    if (inputs.some((item) => item.required)) {
      continue;
    }
    return { skillId: row.skill_id, skillVersionId: row.current_version_id };
  }
  return null;
}

function claimsFromEvidence(db: DatabaseSync, turnId: string): ChatClaimView[] {
  return loadEvidenceForTurn(db, turnId).map((ref) => {
    if (!ref.sourceChunkId) {
      return {
        id: ref.claimId ?? ref.id,
        text: "",
        grounding: "unsourced",
        label: UNSOURCED_INFERENCE_LABEL,
        paragraphId: null,
        chapter: null,
        page: null,
        bookTitle: null,
        sourceChunkId: null,
        knowledgeCardId: ref.knowledgeCardId,
      };
    }
    const row = db
      .prepare(
        `SELECT sc.chapter, sc.page, sc.location_json, sc.text, b.title AS book_title
         FROM source_chunks sc
         JOIN books b ON b.id = sc.book_id
         WHERE sc.id = ?`,
      )
      .get(ref.sourceChunkId) as ChunkRow | undefined;
    const location = row?.location_json ? (JSON.parse(row.location_json) as { paragraphId?: string | null }) : {};
    return {
      id: ref.claimId ?? ref.id,
      text: row?.text ?? "",
      grounding: "sourced",
      label: null,
      paragraphId: location.paragraphId ?? null,
      chapter: row?.chapter ?? null,
      page: row?.page ?? null,
      bookTitle: row?.book_title ?? null,
      sourceChunkId: ref.sourceChunkId,
      knowledgeCardId: ref.knowledgeCardId,
    };
  });
}

function claimToView(claim: AnswerClaim): ChatClaimView {
  return {
    id: claim.id,
    text: claim.text,
    grounding: claim.grounding,
    label: claim.label,
    paragraphId: claim.paragraphId,
    chapter: claim.chapter,
    page: claim.page,
    bookTitle: claim.bookTitle,
    sourceChunkId: claim.sourceChunkId,
    knowledgeCardId: claim.knowledgeCardId,
  };
}

function titleFromMessage(message: string): string {
  const compact = message.replaceAll(/\s+/g, " ").trim();
  if (!compact) {
    return "问题对话";
  }
  return compact.length > 40 ? `${compact.slice(0, 40)}…` : compact;
}
