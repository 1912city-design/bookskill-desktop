import { loadSkill, startConversation, SKILL_STATUS_DRAFT, SKILL_STATUS_PUBLISHED } from "@bookskill/core";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { ChatConversationView } from "../renderer/chat/types.ts";
import type {
  DistillChatContext,
  DistillationPreviewView,
  DistillationValidationError,
} from "../renderer/distill/types.ts";
import { loadConversationView } from "./conversation-path.ts";
import {
  buildDistillationPreview,
  importDistillation,
  loadDistillation,
  type ImportDistillationResult,
} from "./distill-adapter.ts";

export type DistillModelAdapter = {
  generate(input: { db: DatabaseSync; dataDir: string; bookId: string }): string | Promise<string>;
};

let configuredModelAdapter: DistillModelAdapter | null = null;

export function setDistillModelAdapter(adapter: DistillModelAdapter | null): void {
  configuredModelAdapter = adapter;
}

export function getDistillModelAdapter(): DistillModelAdapter | null {
  return configuredModelAdapter;
}

export const NO_MODEL_ADAPTER_REASON =
  "未配置模型适配器，无法生成蒸馏结果。请导入已有的 5 段蒸馏 Markdown，或等待模型适配层就绪。";

export type StartDistillOptions = {
  db: DatabaseSync;
  dataDir: string;
  bookId: string;
  modelAdapter?: DistillModelAdapter | null;
};

export type StartDistillResult =
  | { status: "failed"; reason: string; preview: null }
  | { status: "ready"; preview: DistillationPreviewView; reason: null }
  | { status: "invalid"; reason: string; errors: DistillationValidationError[]; preview: null };

export type AttachDistillationToChatOptions = {
  db: DatabaseSync;
  dataDir: string;
  distillationId: string;
  skillId?: string;
};

export type AttachDistillationToChatResult = {
  conversation: ChatConversationView;
  context: DistillChatContext;
  skillStatus: string;
};

function contextDir(dataDir: string): string {
  return path.join(dataDir, "conversations", "distill-context");
}

function contextPath(dataDir: string, conversationId: string): string {
  return path.join(contextDir(dataDir), `${conversationId}.json`);
}

export function saveDistillationChatContext(dataDir: string, context: DistillChatContext): void {
  fs.mkdirSync(contextDir(dataDir), { recursive: true });
  fs.writeFileSync(
    contextPath(dataDir, context.conversationId),
    `${JSON.stringify(context, null, 2)}\n`,
    "utf8",
  );
}

export function loadDistillationChatContext(
  dataDir: string,
  conversationId: string,
): DistillChatContext | null {
  const file = contextPath(dataDir, conversationId);
  if (!fs.existsSync(file)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as DistillChatContext;
}

export function startDistill(options: StartDistillOptions): StartDistillResult | Promise<StartDistillResult> {
  const adapter = options.modelAdapter ?? getDistillModelAdapter();
  if (!adapter) {
    return {
      status: "failed",
      reason: NO_MODEL_ADAPTER_REASON,
      preview: null,
    };
  }
  const finish = (markdown: string): StartDistillResult => {
    const imported = importDistillation({
      db: options.db,
      dataDir: options.dataDir,
      markdown,
      bookId: options.bookId,
    });
    if (!imported.ok) {
      return {
        status: "invalid",
        reason: imported.errors.map((error) => error.message).join(" "),
        errors: imported.errors,
        preview: null,
      };
    }
    return { status: "ready", preview: imported.preview, reason: null };
  };
  const generated = adapter.generate({
    db: options.db,
    dataDir: options.dataDir,
    bookId: options.bookId,
  });
  if (typeof generated === "string") {
    return finish(generated);
  }
  return generated.then(finish);
}

export function importDistillationMarkdown(options: {
  db: DatabaseSync;
  dataDir: string;
  markdown: string;
  sourceFilename?: string;
  bookId?: string;
}): ImportDistillationResult {
  return importDistillation(options);
}

export function attachDistillationToChat(
  options: AttachDistillationToChatOptions,
): AttachDistillationToChatResult {
  const record = loadDistillation(options.dataDir, options.distillationId);
  const selected =
    (options.skillId
      ? record.skillRefs.find((ref) => ref.skillId === options.skillId)
      : record.skillRefs[0]) ?? null;
  if (!selected) {
    throw new Error("蒸馏结果中没有可加入对话的 draft Skill。");
  }
  const skill = loadSkill(options.db, selected.skillId);
  if (skill.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("已发布的 Skill 不能由蒸馏流程自动加入对话。");
  }
  if (skill.status !== SKILL_STATUS_DRAFT) {
    throw new Error("加入对话时 Skill 必须保持 draft，蒸馏流程不会改写状态。");
  }
  if (!skill.currentVersionId) {
    throw new Error("draft Skill 没有当前版本，无法加入对话。");
  }
  const started = startConversation({
    db: options.db,
    title: record.distillation.title || "蒸馏对话",
    skillId: skill.id,
    skillVersionId: skill.currentVersionId,
    selectionMethod: "manual",
  });
  const stillDraft = loadSkill(options.db, skill.id);
  if (stillDraft.status !== SKILL_STATUS_DRAFT) {
    throw new Error("加入对话后 Skill 状态被改写，这是不允许的。");
  }
  const context: DistillChatContext = {
    conversationId: started.id,
    bookId: record.distillation.book_id || null,
    sourceFilename: record.distillation.source_filename,
    distillationId: record.id,
    skillId: skill.id,
    skillVersionId: skill.currentVersionId,
    skillName: skill.name,
    skillStatus: stillDraft.status,
  };
  saveDistillationChatContext(options.dataDir, context);
  return {
    conversation: loadConversationView(options.db, started.id),
    context,
    skillStatus: stillDraft.status,
  };
}

export function previewFromStored(dataDir: string, id: string): DistillationPreviewView {
  const record = loadDistillation(dataDir, id);
  return buildDistillationPreview(record.distillation, {
    id: record.id,
    markdown: record.markdown,
    skillRefs: record.skillRefs,
  });
}
