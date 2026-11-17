import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  KNOWLEDGE_CARD_TYPE_CASE,
  UNCONFIRMED_LOCATION_LABEL,
} from "../constants.ts";
import { loadConversation } from "../conversation.ts";
import { loadKnowledgeCard } from "../knowledge.ts";
import { appendKnowledgeCardRevision } from "../knowledge-revisions.ts";
import { newId, nowIso, withTransaction } from "../util.ts";
import type {
  DepositConversationKnowledgeDraftOptions,
  DepositConversationKnowledgeDraftResult,
} from "./types.ts";

const DEFAULT_CONDITIONS = "由用户在对话后手动沉淀的知识点草稿，不是自动确认的知识卡，也不是自动发布的 Skill。";

export function depositConversationKnowledgeDraft(
  options: DepositConversationKnowledgeDraftOptions,
): DepositConversationKnowledgeDraftResult {
  const title = options.title.trim();
  const content = options.content.trim();
  if (title.length === 0) {
    throw new Error("A conversation knowledge draft needs a title");
  }
  if (content.length === 0) {
    throw new Error("A conversation knowledge draft needs content");
  }

  const conversation = loadConversation(options.db, options.conversationId);
  const turnId = options.turnId ?? null;
  if (turnId) {
    const turn = conversation.turns.find((item) => item.id === turnId);
    if (!turn) {
      throw new Error(`Conversation turn ${turnId} does not belong to conversation ${conversation.id}`);
    }
  }

  const stamp = nowIso(options.now);
  const cardId = newId();
  const conditions = options.conditions === undefined ? DEFAULT_CONDITIONS : options.conditions;
  const limitations =
    options.limitations === undefined
      ? `${UNCONFIRMED_LOCATION_LABEL}。此草稿由用户在对话后手动沉淀，不得视为已确认知识卡。对话 ${conversation.id}${turnId ? `，回合 ${turnId}` : ""}。`
      : options.limitations;

  withTransaction(options.db, () => {
    options.db
      .prepare(
        `INSERT INTO knowledge_cards(id, title, type, content, conditions, limitations, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        cardId,
        title,
        KNOWLEDGE_CARD_TYPE_CASE,
        content,
        conditions,
        limitations,
        KNOWLEDGE_CARD_STATUS_DRAFT,
        stamp,
        stamp,
      );
    appendKnowledgeCardRevision(
      options.db,
      {
        cardId,
        title,
        type: KNOWLEDGE_CARD_TYPE_CASE,
        content,
        conditions,
        limitations,
        status: KNOWLEDGE_CARD_STATUS_DRAFT,
      },
      stamp,
    );
  });

  const card = loadKnowledgeCard(options.db, cardId);
  if (card.status !== KNOWLEDGE_CARD_STATUS_DRAFT) {
    throw new Error("Conversation knowledge deposit must stay draft and must not write verified_by_user");
  }
  if (card.sources.length > 0) {
    throw new Error("Conversation knowledge deposit must not invent locators");
  }

  return {
    card,
    conversationId: conversation.id,
    turnId,
  };
}
