import type { SkillRecord } from "../types.ts";

export const COUNCIL_SEAT_IDS = ["sunzi-decision", "lunyu-conduct", "laozi-wuwei"] as const;

export type CouncilSeatId = (typeof COUNCIL_SEAT_IDS)[number];

export type CouncilCitation = {
  quote: string;
  source_filename: string;
  attribution?: string;
};

export type CouncilSeat = {
  seat_id: CouncilSeatId;
  name: string;
  based_on: string[];
  book_title: string;
  source_filename: string;
  system_prompt: string;
  skill_status: "draft";
  skill_id: string;
};

export type CouncilUtterance = {
  kind: "seat" | "summary";
  seat_id: CouncilSeatId | null;
  speaker: string;
  content: string;
  source_filename: string;
  citations: CouncilCitation[];
};

export type DistillQuote = {
  text: string;
  attribution: string;
};

export type DistillSkillDraft = {
  name: string;
  trigger: string;
  steps: string;
  output: string;
  body: string;
};

export type ParsedDistillFixture = {
  filename: string;
  bookTitle: string;
  markdown: string;
  sections: {
    positioning: string;
    principles: string;
    quotes: string;
    framework: string;
    skills: string;
  };
  quotes: DistillQuote[];
  skills: DistillSkillDraft[];
};

export type CouncilRegistry = {
  seats: CouncilSeat[];
  sources: Record<CouncilSeatId, ParsedDistillFixture>;
  skills: Record<CouncilSeatId, SkillRecord>;
};

export type CouncilAdapterContext = {
  seat: CouncilSeat | null;
  question: string;
  sources: ParsedDistillFixture[];
  priorUtterances: CouncilUtterance[];
  role: "seat" | "summary";
};

export type CouncilAdapterReply = {
  content: string;
  citations: CouncilCitation[];
};

export type CouncilAdapter = (context: CouncilAdapterContext) => CouncilAdapterReply;

export type CouncilAskResult = {
  seat: CouncilSeat;
  question: string;
  utterance: CouncilUtterance;
};

export type CouncilRoundtableResult = {
  question: string;
  seat_ids: CouncilSeatId[];
  utterances: CouncilUtterance[];
};
