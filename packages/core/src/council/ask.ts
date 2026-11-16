import {
  ensureSourceFilenameInContent,
  uniqueSourceFilenames,
  validateCouncilCitations,
} from "./citations.ts";
import { getCouncilSeat, getCouncilSeatSources } from "./establish.ts";
import { isCouncilSeatId, listFixedCouncilSeatIds } from "./seats.ts";
import type {
  CouncilAdapter,
  CouncilAskResult,
  CouncilRegistry,
  CouncilRoundtableResult,
  CouncilSeatId,
  CouncilUtterance,
  ParsedDistillFixture,
} from "./types.ts";

export type AskCouncilSeatOptions = {
  registry: CouncilRegistry;
  seatId: string;
  question: string;
  adapter: CouncilAdapter;
};

export type RunCouncilRoundtableOptions = {
  registry: CouncilRegistry;
  question: string;
  adapter: CouncilAdapter;
  seatIds?: string[];
};

export function askCouncilSeat(options: AskCouncilSeatOptions): CouncilAskResult {
  if (!isCouncilSeatId(options.seatId)) {
    throw new Error(`Unknown council seat: ${options.seatId}`);
  }
  const question = options.question.trim();
  if (!question) {
    throw new Error("Council question must not be empty");
  }
  const seat = getCouncilSeat(options.registry, options.seatId);
  const source = getCouncilSeatSources(options.registry, options.seatId);
  const reply = options.adapter({
    seat,
    question,
    sources: [source],
    priorUtterances: [],
    role: "seat",
  });
  validateCouncilCitations(reply.citations, [source]);
  const utterance: CouncilUtterance = {
    kind: "seat",
    seat_id: seat.seat_id,
    speaker: seat.name,
    content: ensureSourceFilenameInContent(reply.content, seat.source_filename),
    source_filename: seat.source_filename,
    citations: reply.citations.map((item) => ({ ...item })),
  };
  return { seat, question, utterance };
}

export function runCouncilRoundtable(options: RunCouncilRoundtableOptions): CouncilRoundtableResult {
  const question = options.question.trim();
  if (!question) {
    throw new Error("Council question must not be empty");
  }
  const seatIds = resolveRoundtableSeatIds(options.seatIds);
  const utterances: CouncilUtterance[] = [];
  for (const seatId of seatIds) {
    const seat = getCouncilSeat(options.registry, seatId);
    const source = getCouncilSeatSources(options.registry, seatId);
    const reply = options.adapter({
      seat,
      question,
      sources: [source],
      priorUtterances: utterances.map(cloneUtterance),
      role: "seat",
    });
    validateCouncilCitations(reply.citations, [source]);
    utterances.push({
      kind: "seat",
      seat_id: seat.seat_id,
      speaker: seat.name,
      content: ensureSourceFilenameInContent(reply.content, seat.source_filename),
      source_filename: seat.source_filename,
      citations: reply.citations.map((item) => ({ ...item })),
    });
  }

  const participatingSources: ParsedDistillFixture[] = seatIds.map((seatId) =>
    getCouncilSeatSources(options.registry, seatId),
  );
  const summaryReply = options.adapter({
    seat: null,
    question,
    sources: participatingSources,
    priorUtterances: utterances.map(cloneUtterance),
    role: "summary",
  });
  validateCouncilCitations(summaryReply.citations, participatingSources);
  const summarySource = uniqueSourceFilenames([
    ...summaryReply.citations.map((item) => item.source_filename),
    ...utterances.map((item) => item.source_filename),
  ]);
  utterances.push({
    kind: "summary",
    seat_id: null,
    speaker: "圆桌总结",
    content: ensureSourceFilenameInContent(summaryReply.content, summarySource),
    source_filename: summarySource,
    citations: summaryReply.citations.map((item) => ({ ...item })),
  });

  return { question, seat_ids: seatIds, utterances };
}

function resolveRoundtableSeatIds(requested?: string[]): CouncilSeatId[] {
  const ids = (requested ?? listFixedCouncilSeatIds()).map((seatId) => {
    if (!isCouncilSeatId(seatId)) {
      throw new Error(`Unknown council seat: ${seatId}`);
    }
    return seatId;
  });
  const unique = [...new Set(ids)];
  if (unique.length < 2) {
    throw new Error("A council roundtable requires at least two seats");
  }
  return unique;
}

function cloneUtterance(utterance: CouncilUtterance): CouncilUtterance {
  return {
    ...utterance,
    citations: utterance.citations.map((item) => ({ ...item })),
  };
}
