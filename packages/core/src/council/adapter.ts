import { SUNZI_DECISION_SEAT_ID } from "./seats.ts";
import type {
  CouncilAdapter,
  CouncilAdapterContext,
  CouncilCitation,
  DistillQuote,
  ParsedDistillFixture,
} from "./types.ts";

/** Preferred 金句 for the Sunzi decision seat when the question does not point at another passage. */
export const SUNZI_DECISION_DEFAULT_QUOTE = "知彼知己，百戰不殆；不知彼而知己，一勝一負；不知彼不知己，每戰必殆。";

/**
 * Deterministic, fixture-backed council adapter for tests.
 * Replies only quote text that already appears in the allowed distill fixtures.
 * Does not call an external hosted model.
 */
export function createFixtureCouncilAdapter(): CouncilAdapter {
  return (context) => {
    if (context.role === "summary") {
      return summarizeRoundtable(context);
    }
    const source = context.sources[0];
    if (!source) {
      throw new Error("Council adapter received no retrieval sources");
    }
    const quote = pickQuote(context, source);
    const citation: CouncilCitation = {
      quote: quote.text,
      source_filename: source.filename,
      attribution: quote.attribution,
    };
    const seatName = context.seat?.name ?? "席位";
    const bookTitle = context.seat?.book_title ?? source.bookTitle;
    const content = [
      `${seatName}依据《${bookTitle}》回答：`,
      context.question.trim(),
      "",
      `书中可引用的原句是：「${quote.text}」——${quote.attribution}。`,
      "以上引用逐字取自定稿夹具，不是另行编造的原文。",
      `来源：${source.filename}`,
    ].join("\n");
    return { content, citations: [citation] };
  };
}

function pickQuote(context: CouncilAdapterContext, source: ParsedDistillFixture): DistillQuote {
  const question = context.question;
  const matched = source.quotes.find((quote) => question.includes(quote.text) || question.includes(`「${quote.text}」`));
  if (matched) {
    return matched;
  }
  if (context.seat?.seat_id === SUNZI_DECISION_SEAT_ID) {
    const preferred = source.quotes.find((quote) => quote.text === SUNZI_DECISION_DEFAULT_QUOTE);
    if (preferred) {
      return preferred;
    }
  }
  const first = source.quotes[0];
  if (!first) {
    throw new Error(`No quotes available in ${source.filename}`);
  }
  return first;
}

function summarizeRoundtable(context: CouncilAdapterContext): { content: string; citations: CouncilCitation[] } {
  if (context.priorUtterances.length === 0) {
    throw new Error("Roundtable summary requires prior seat utterances");
  }
  const citations: CouncilCitation[] = [];
  const lines = ["圆桌总结：各位席位已依次发言，综合如下。", ""];
  for (const utterance of context.priorUtterances) {
    const citation = utterance.citations[0];
    if (citation) {
      citations.push({ ...citation });
      lines.push(
        `${utterance.speaker}（${utterance.source_filename}）引用「${citation.quote}」${citation.attribution ? `——${citation.attribution}` : ""}。`,
      );
    } else {
      lines.push(`${utterance.speaker}（${utterance.source_filename}）已发表意见。`);
    }
  }
  lines.push("", "总结只复述各席已给出的夹具原文，不另编造出处。");
  const filenames = [...new Set(citations.map((item) => item.source_filename))];
  if (filenames.length > 0) {
    lines.push(`来源：${filenames.join("、")}`);
  }
  return { content: lines.join("\n"), citations };
}
