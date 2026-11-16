import type { DistillChatContext } from "../distill/types.ts";

export type ChatClaimView = {
  id: string;
  text: string;
  grounding: "sourced" | "unsourced";
  label: string | null;
  paragraphId: string | null;
  chapter: string | null;
  page: number | null;
  bookTitle: string | null;
  sourceChunkId: string | null;
  knowledgeCardId: string | null;
};

export type ChatTurnView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  claims: ChatClaimView[];
};

export type ChatConversationView = {
  id: string;
  title: string;
  turns: ChatTurnView[];
};

export type ChatConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type ChatUiState = {
  loaded: boolean;
  conversation: ChatConversationView | null;
  draftQuestion: string;
  error: string | null;
  statusMessage: string | null;
  distillContext?: DistillChatContext | null;
};

export function emptyChatUiState(): ChatUiState {
  return {
    loaded: false,
    conversation: null,
    draftQuestion: "",
    error: null,
    statusMessage: null,
    distillContext: null,
  };
}
