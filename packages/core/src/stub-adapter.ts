import {
  HOLLOW_ECHO_LABEL,
  HOLLOW_ECHO_PARAGRAPH_ID,
  HOLLOW_ECHO_SENTENCE,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  UNSOURCED_INFERENCE_LABEL,
} from "./constants.ts";
import type {
  AnswerClaim,
  AssistantAnswer,
  ImportedBook,
  KnowledgeCardRecord,
  SkillInputSpec,
  SkillVersionRecord,
} from "./types.ts";
import { normalizeWhitespace } from "./util.ts";

export type StubAdapterContext = {
  skillVersion: SkillVersionRecord;
  books: ImportedBook[];
  knowledgeCards: KnowledgeCardRecord[];
  userMessages: string[];
  confirmedInputs: Record<string, string>;
};

const PROJECT_NAME_RE =
  /(?:项目(?:名称)?|project(?:[_ ]?name)?)\s*(?:是|为|叫|[:：=])\s*[「「""']?(.+?)[」」""']?(?:[。.!！]?)$/i;

/**
 * Deterministic local Skill adapter. No network, no API key, no live model.
 */
export function runStubAdapter(context: StubAdapterContext): AssistantAnswer {
  const latest = context.userMessages[context.userMessages.length - 1] ?? "";
  const confirmedInputs = { ...context.confirmedInputs };
  const extracted = extractProjectName(latest);
  if (extracted && !confirmedInputs.project_name) {
    confirmedInputs.project_name = extracted;
  }

  const missing = missingRequiredInputs(context.skillVersion.inputs, confirmedInputs);
  if (missing.length > 0) {
    return {
      kind: "clarify",
      content: `要运行 Skill「项目复盘准备」${context.skillVersion.version}，还需要：${missing
        .map(describeInput)
        .join("、")}。请先补充这些输入。`,
      missingInputs: missing,
      claims: [],
      confirmedInputs,
    };
  }

  if (containsHollowEcho(latest)) {
    return hollowEchoAnswer(context, confirmedInputs, latest);
  }

  if (/不一致|两段|不同意|争议/.test(latest)) {
    return disagreementAnswer(context, confirmedInputs);
  }

  if (/清单|检查|checklist/.test(latest)) {
    return checklistAnswer(context, confirmedInputs);
  }

  if (/出处|来源|原则|知识卡|P1\.3|原书/.test(latest)) {
    return principleSourceAnswer(context, confirmedInputs);
  }

  return retrospectiveAnswer(context, confirmedInputs);
}

function missingRequiredInputs(inputs: SkillInputSpec[], confirmed: Record<string, string>): string[] {
  return inputs.filter((input) => input.required && !confirmed[input.name]?.trim()).map((input) => input.name);
}

function describeInput(name: string): string {
  if (name === "project_name") {
    return "要复盘的项目名称";
  }
  return name;
}

function extractProjectName(message: string): string | null {
  const match = message.trim().match(PROJECT_NAME_RE);
  if (!match?.[1]) {
    return null;
  }
  return normalizeWhitespace(match[1]);
}

function containsHollowEcho(message: string): boolean {
  return message.toLowerCase().includes(HOLLOW_ECHO_SENTENCE.toLowerCase()) ||
    /cedar trees sing at noon/i.test(message);
}

function findChunk(
  books: ImportedBook[],
  paragraphId: string,
): { book: ImportedBook; chunk: ImportedBook["chunks"][number] } | null {
  for (const book of books) {
    const chunk = book.chunks.find((item) => item.location.paragraphId === paragraphId);
    if (chunk) {
      return { book, chunk };
    }
  }
  return null;
}

function cardForParagraph(cards: KnowledgeCardRecord[], paragraphId: string): KnowledgeCardRecord | null {
  return cards.find((card) => card.sources.some((source) => source.paragraphId === paragraphId)) ?? null;
}

function sourcedClaim(
  id: string,
  text: string,
  hit: { book: ImportedBook; chunk: ImportedBook["chunks"][number] },
  cardId: string | null,
): AnswerClaim {
  return {
    id,
    text,
    grounding: "sourced",
    label: null,
    sourceChunkId: hit.chunk.id,
    knowledgeCardId: cardId,
    paragraphId: hit.chunk.location.paragraphId,
    chapter: hit.chunk.chapter,
    page: hit.chunk.page,
    bookTitle: hit.book.title,
  };
}

function unsourcedClaim(id: string, text: string, label: string, extras?: Partial<AnswerClaim>): AnswerClaim {
  return {
    id,
    text,
    grounding: "unsourced",
    label,
    sourceChunkId: extras?.sourceChunkId ?? null,
    knowledgeCardId: extras?.knowledgeCardId ?? null,
    paragraphId: extras?.paragraphId ?? null,
    chapter: extras?.chapter ?? null,
    page: extras?.page ?? null,
    bookTitle: extras?.bookTitle ?? null,
  };
}

function formatAnswer(lead: string, claims: AnswerClaim[]): string {
  const blocks = claims.map((claim) => {
    if (claim.grounding === "sourced") {
      const page = claim.page ? `，页码 ${claim.page}` : "";
      return `来源：${claim.bookTitle ?? "原书"} / ${claim.chapter ?? "未知章节"} / [${claim.paragraphId}]${page}\n${claim.text}`;
    }
    const pointer =
      claim.paragraphId
        ? `（可指向反例段落 [${claim.paragraphId}] ${claim.chapter ?? ""}，但这不是书中结论）`
        : "";
    return `标注：${claim.label ?? UNSOURCED_INFERENCE_LABEL}${pointer}\n${claim.text}`;
  });
  return `${lead}\n\n${blocks.join("\n\n")}`;
}

function principleSourceAnswer(context: StubAdapterContext, confirmedInputs: Record<string, string>): AssistantAnswer {
  const hit = findChunk(context.books, PRINCIPLE_PARAGRAPH_ID);
  if (!hit) {
    throw new Error("Cannot answer from sources: [P1.3] is missing");
  }
  const card = cardForParagraph(context.knowledgeCards, PRINCIPLE_PARAGRAPH_ID);
  const claims: AnswerClaim[] = [
    sourcedClaim(
      "claim-principle",
      `原书原则：${PRINCIPLE_SENTENCE}`,
      hit,
      card?.id ?? null,
    ),
  ];
  const lead = `当前 Skill 版本 ${context.skillVersion.version} 绑定不变。这条原则来自《${hit.book.title}》${hit.chunk.chapter ?? ""}的 [${PRINCIPLE_PARAGRAPH_ID}]，不是模型自行提出的结论。`;
  return {
    kind: "answer",
    content: formatAnswer(lead, claims),
    missingInputs: [],
    claims,
    confirmedInputs,
  };
}

function hollowEchoAnswer(
  context: StubAdapterContext,
  confirmedInputs: Record<string, string>,
  _message: string,
): AssistantAnswer {
  const hit = findChunk(context.books, HOLLOW_ECHO_PARAGRAPH_ID);
  const claims: AnswerClaim[] = [
    unsourcedClaim(
      "claim-hollow-echo",
      `“${HOLLOW_ECHO_SENTENCE}” 不是书中结论，而是空洞回声反例。不得把它当作已引用的原则或事实。`,
      HOLLOW_ECHO_LABEL,
      hit
        ? {
            sourceChunkId: hit.chunk.id,
            paragraphId: HOLLOW_ECHO_PARAGRAPH_ID,
            chapter: hit.chunk.chapter,
            page: hit.chunk.page,
            bookTitle: hit.book.title,
          }
        : undefined,
    ),
  ];
  const lead = hit
    ? `当前 Skill 版本 ${context.skillVersion.version} 绑定不变。关于“${HOLLOW_ECHO_SENTENCE}”，产品可以指向《${hit.book.title}》${hit.chunk.chapter ?? ""}的 [${HOLLOW_ECHO_PARAGRAPH_ID}] 作为反例位置，但必须标注为${HOLLOW_ECHO_LABEL}，不得伪装成书中结论。`
    : `当前 Skill 版本 ${context.skillVersion.version} 绑定不变。这句空洞回声没有可作为书中结论的来源，必须标注为${HOLLOW_ECHO_LABEL}。`;
  return {
    kind: "answer",
    content: formatAnswer(lead, claims),
    missingInputs: [],
    claims,
    confirmedInputs,
  };
}

function disagreementAnswer(context: StubAdapterContext, confirmedInputs: Record<string, string>): AssistantAnswer {
  const hit = findChunk(context.books, "P1.5");
  const claims: AnswerClaim[] = [];
  if (hit) {
    claims.push(
      sourcedClaim(
        "claim-both-sides",
        hit.chunk.text,
        hit,
        cardForParagraph(context.knowledgeCards, "P1.5")?.id ?? null,
      ),
    );
  }
  claims.push(
    unsourcedClaim(
      "claim-process",
      "复盘时如果两段材料冲突，建议先并列列出双方原文，再决定是否需要更多证据。",
      UNSOURCED_INFERENCE_LABEL,
    ),
  );
  const lead = `当前 Skill 版本 ${context.skillVersion.version} 绑定不变。下面区分了原书规则和${UNSOURCED_INFERENCE_LABEL}。`;
  return {
    kind: "answer",
    content: formatAnswer(lead, claims),
    missingInputs: [],
    claims,
    confirmedInputs,
  };
}

function checklistAnswer(context: StubAdapterContext, confirmedInputs: Record<string, string>): AssistantAnswer {
  const hit = findChunk(context.books, PRINCIPLE_PARAGRAPH_ID);
  if (!hit) {
    throw new Error("Cannot build a checklist without [P1.3]");
  }
  const card = cardForParagraph(context.knowledgeCards, PRINCIPLE_PARAGRAPH_ID);
  const claims: AnswerClaim[] = [
    sourcedClaim("claim-principle-check", `复盘清单必须遵守：${PRINCIPLE_SENTENCE}`, hit, card?.id ?? null),
    unsourcedClaim(
      "claim-checklist-items",
      `针对「${confirmedInputs.project_name}」的建议检查项：目标是否写清、证据是否带来源、无来源判断是否已标注、行动项是否可执行。这些条目是${UNSOURCED_INFERENCE_LABEL}，不是书中原句。`,
      UNSOURCED_INFERENCE_LABEL,
    ),
  ];
  const lead = `当前 Skill 版本 ${context.skillVersion.version} 绑定不变。清单同时包含原书原则和${UNSOURCED_INFERENCE_LABEL}。`;
  return {
    kind: "answer",
    content: formatAnswer(lead, claims),
    missingInputs: [],
    claims,
    confirmedInputs,
  };
}

function retrospectiveAnswer(context: StubAdapterContext, confirmedInputs: Record<string, string>): AssistantAnswer {
  const hit = findChunk(context.books, PRINCIPLE_PARAGRAPH_ID);
  if (!hit) {
    throw new Error("Cannot prepare a retrospective without [P1.3]");
  }
  const card = cardForParagraph(context.knowledgeCards, PRINCIPLE_PARAGRAPH_ID);
  const claims: AnswerClaim[] = [
    sourcedClaim(
      "claim-principle-use",
      `准备「${confirmedInputs.project_name}」的复盘时，每条结论都要能指向来源段落。原则是：${PRINCIPLE_SENTENCE}`,
      hit,
      card?.id ?? null,
    ),
    unsourcedClaim(
      "claim-agenda",
      "建议议程可以包括：事实回顾、分歧整理、改进项。该议程是一般推断，不是书中规定的流程。",
      UNSOURCED_INFERENCE_LABEL,
    ),
  ];
  const lead = `当前 Skill 版本 ${context.skillVersion.version} 已绑定，正在为「${confirmedInputs.project_name}」准备复盘。回答区分了原书来源与${UNSOURCED_INFERENCE_LABEL}。`;
  return {
    kind: "answer",
    content: formatAnswer(lead, claims),
    missingInputs: [],
    claims,
    confirmedInputs,
  };
}
