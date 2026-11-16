import type { DatabaseSync } from "node:sqlite";
import { SKILL_STATUS_DRAFT, SKILL_STATUS_PUBLISHED } from "../constants.ts";
import { createSkill, loadSkill } from "../skills.ts";
import type { SkillRecord } from "../types.ts";
import { loadCouncilFixtures } from "./parse-fixture.ts";
import { COUNCIL_SKILL_DOMAIN, FIXED_COUNCIL_SEATS, type FixedCouncilSeatDefinition } from "./seats.ts";
import type {
  CouncilRegistry,
  CouncilSeat,
  CouncilSeatId,
  DistillSkillDraft,
  ParsedDistillFixture,
} from "./types.ts";

export type EstablishCouncilSeatsOptions = {
  db: DatabaseSync;
  fixtureDir: string;
  now?: Date;
};

export function establishCouncilSeats(options: EstablishCouncilSeatsOptions): CouncilRegistry {
  const fixtures = loadCouncilFixtures(options.fixtureDir);
  const sources = {} as CouncilRegistry["sources"];
  const skills = {} as CouncilRegistry["skills"];
  const seats: CouncilSeat[] = [];

  for (const definition of FIXED_COUNCIL_SEATS) {
    const fixture = fixtures.find((item) => item.filename === definition.source_filename);
    if (!fixture) {
      throw new Error(`Missing distill fixture for seat ${definition.seat_id}: ${definition.source_filename}`);
    }
    const skillDraft = findBoundSkill(fixture, definition.based_on[0]);
    const skill = findOrCreateDraftSkill(options.db, {
      name: skillDraft.name,
      purpose: skillPurpose(definition.name, fixture.bookTitle, skillDraft),
      steps: skillDraft.steps,
      rules: skillRules(definition.source_filename),
      now: options.now,
    });
    if (skill.status === SKILL_STATUS_PUBLISHED) {
      throw new Error(`Council seat Skill must not be published: ${skill.name}`);
    }
    if (skill.status !== SKILL_STATUS_DRAFT) {
      throw new Error(`Council seat Skill must be draft, got ${skill.status} for ${skill.name}`);
    }
    const seat: CouncilSeat = {
      seat_id: definition.seat_id,
      name: definition.name,
      based_on: [...definition.based_on],
      book_title: definition.book_title,
      source_filename: definition.source_filename,
      system_prompt: buildSystemPrompt(definition, fixture, skillDraft),
      skill_status: "draft",
      skill_id: skill.id,
    };
    sources[definition.seat_id] = fixture;
    skills[definition.seat_id] = skill;
    seats.push(seat);
  }

  return { seats, sources, skills };
}

export function listCouncilSeats(registry: CouncilRegistry): CouncilSeat[] {
  return registry.seats.map((seat) => ({ ...seat, based_on: [...seat.based_on] }));
}

export function getCouncilSeat(registry: CouncilRegistry, seatId: string): CouncilSeat {
  const seat = registry.seats.find((item) => item.seat_id === seatId);
  if (!seat) {
    throw new Error(`Council seat not established: ${seatId}`);
  }
  return { ...seat, based_on: [...seat.based_on] };
}

export function getCouncilSeatSources(registry: CouncilRegistry, seatId: CouncilSeatId): ParsedDistillFixture {
  const sources = registry.sources[seatId];
  if (!sources) {
    throw new Error(`Council seat sources not established: ${seatId}`);
  }
  return sources;
}

function findBoundSkill(fixture: ParsedDistillFixture, skillName: string): DistillSkillDraft {
  const skill = fixture.skills.find((item) => item.name === skillName);
  if (!skill) {
    throw new Error(`Fixture ${fixture.filename} does not contain Skill「${skillName}」`);
  }
  return skill;
}

function skillPurpose(seatName: string, bookTitle: string, skill: DistillSkillDraft): string {
  const trigger = skill.trigger || `根据《${bookTitle}》蒸馏结果，以「${skill.name}」回答用户问题。`;
  return `智囊团「${seatName}」绑定的草稿 Skill。${trigger}`;
}

function skillRules(sourceFilename: string): string[] {
  return [
    `引用必须逐字来自 ${sourceFilename}，不得编造原文。`,
    "检索范围仅限本席位对应的书籍蒸馏来源。",
    "不得把席位 Skill 标为 published，也不得自动发布。",
    "模型调用必须走可注入的 BookSkill 适配层。",
  ];
}

function buildSystemPrompt(
  definition: FixedCouncilSeatDefinition,
  fixture: ParsedDistillFixture,
  skill: DistillSkillDraft,
): string {
  return [
    `你是智囊团「${definition.name}」。请综合以下来源做决策建议。`,
    `只使用《${definition.book_title}》的蒸馏结果，检索范围仅限 ${definition.source_filename}。`,
    `绑定 Skill「${skill.name}」，状态必须保持为 draft，不得自行发布。`,
    "引用必须逐字来自上述来源，不得编造原文。每轮回答必须带来源文件名。",
    "",
    "【核心定位】",
    fixture.sections.positioning,
    "",
    "【可引用金句】",
    fixture.sections.quotes,
    "",
    "【Skill 执行要点】",
    skill.body,
  ].join("\n");
}

function findOrCreateDraftSkill(
  db: DatabaseSync,
  input: {
    name: string;
    purpose: string;
    steps: string;
    rules: string[];
    now?: Date;
  },
): SkillRecord {
  const existing = findExistingDraftSkill(db, input.name);
  if (existing) {
    return existing;
  }
  const created = createSkill({
    db,
    name: input.name,
    domain: COUNCIL_SKILL_DOMAIN,
    purpose: input.purpose,
    status: SKILL_STATUS_DRAFT,
    inputs: [
      {
        name: "question",
        required: true,
        description: "向该席位提出的问题",
      },
    ],
    steps: input.steps
      ? input.steps
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
      : [`按照「${input.name}」的蒸馏步骤回答，并附来源文件名。`],
    rules: input.rules,
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        source_filename: { type: "string" },
        citations: { type: "array" },
      },
    },
    permissions: {
      network: false,
      writeFiles: false,
      modelProvider: "injected-adapter",
    },
    now: input.now,
  });
  return created.skill;
}

function findExistingDraftSkill(db: DatabaseSync, name: string): SkillRecord | null {
  const row = db
    .prepare(
      `SELECT id FROM skills
       WHERE name = ? AND domain = ? AND status = ?
       ORDER BY created_at ASC
       LIMIT 1`,
    )
    .get(name, COUNCIL_SKILL_DOMAIN, SKILL_STATUS_DRAFT) as { id: string } | undefined;
  if (!row) {
    return null;
  }
  return loadSkill(db, row.id);
}
