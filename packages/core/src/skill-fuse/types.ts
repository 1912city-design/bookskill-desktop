import type { DatabaseSync } from "node:sqlite";
import type { KnowledgeCardRecord, SkillRecord, SkillVersionRecord } from "../types.ts";

export type FuseSkillsOptions = {
  db: DatabaseSync;
  leftSkillId: string;
  rightSkillId: string;
  name?: string;
  leftVersionId?: string;
  rightVersionId?: string;
  now?: Date;
};

export type FuseSkillsResult = {
  skill: SkillRecord;
  version: SkillVersionRecord;
  leftSkill: SkillRecord;
  rightSkill: SkillRecord;
  leftVersion: SkillVersionRecord;
  rightVersion: SkillVersionRecord;
};

export type DepositConversationKnowledgeDraftOptions = {
  db: DatabaseSync;
  conversationId: string;
  title: string;
  content: string;
  turnId?: string;
  conditions?: string | null;
  limitations?: string | null;
  now?: Date;
};

export type DepositConversationKnowledgeDraftResult = {
  card: KnowledgeCardRecord;
  conversationId: string;
  turnId: string | null;
};
