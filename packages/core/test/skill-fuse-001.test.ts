import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_SKILL_VERSION,
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  KNOWLEDGE_CARD_TYPE_CASE,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SKILL_STATUS_TESTED,
  UNCONFIRMED_LOCATION_LABEL,
  createSkill,
  createSkillVersion,
  depositConversationKnowledgeDraft,
  fuseSkills,
  listSkillVersions,
  listSkills,
  loadSkill,
  startConversation,
  ask,
} from "../src/index.ts";
import type { DatabaseSync } from "node:sqlite";
import type { SkillInputSpec } from "../src/index.ts";
import { createTempWorkspace, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function openTemp() {
  const temp = createTempWorkspace();
  temps.push(temp);
  return temp.open();
}

type SeedSkillOptions = {
  name: string;
  domain?: string;
  purpose?: string;
  status?: string;
  version?: string;
  inputs?: SkillInputSpec[];
  steps?: unknown;
  rules?: unknown;
  outputSchema?: unknown;
  permissions?: unknown;
  knowledgeCardIds?: string[];
};

function seedSkill(db: DatabaseSync, options: SeedSkillOptions) {
  return createSkill({
    db,
    name: options.name,
    domain: options.domain ?? "专业",
    purpose: options.purpose ?? `${options.name}的用途说明。`,
    status: options.status ?? SKILL_STATUS_TESTED,
    version: options.version ?? "1.0.0",
    inputs: options.inputs ?? [{ name: "situation", required: true, description: "当前局面" }],
    steps: options.steps ?? [{ id: "observe", text: "观察局势。" }],
    rules: options.rules ?? ["引用原书定位符。"],
    outputSchema: options.outputSchema ?? {
      type: "object",
      properties: { advice: { type: "string" } },
      required: ["advice"],
    },
    permissions: options.permissions ?? { network: false, writeFiles: false, modelProvider: "local-stub" },
    knowledgeCardIds: options.knowledgeCardIds,
  });
}

type SkillRowSnapshot = {
  id: string;
  name: string;
  domain: string;
  purpose: string;
  status: string;
  current_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type VersionRowSnapshot = {
  id: string;
  skill_id: string;
  version: string;
  inputs_json: string;
  steps_json: string;
  rules_json: string;
  output_schema_json: string;
  permissions_json: string;
  created_at: string;
};

function snapshotSkillRow(db: DatabaseSync, skillId: string): SkillRowSnapshot {
  const row = db
    .prepare(
      `SELECT id, name, domain, purpose, status, current_version_id, created_at, updated_at
       FROM skills WHERE id = ?`,
    )
    .get(skillId) as SkillRowSnapshot | undefined;
  assert.ok(row, `missing skill row ${skillId}`);
  return row;
}

function snapshotVersionRows(db: DatabaseSync, skillId: string): VersionRowSnapshot[] {
  return db
    .prepare(
      `SELECT id, skill_id, version, inputs_json, steps_json, rules_json, output_schema_json, permissions_json, created_at
       FROM skill_versions WHERE skill_id = ? ORDER BY created_at ASC, version ASC, id ASC`,
    )
    .all(skillId) as VersionRowSnapshot[];
}

function snapshotSourceRows(db: DatabaseSync, versionIds: string[]) {
  if (versionIds.length === 0) {
    return [];
  }
  const placeholders = versionIds.map(() => "?").join(", ");
  return db
    .prepare(
      `SELECT id, skill_version_id, knowledge_card_id, step_id
       FROM skill_sources
       WHERE skill_version_id IN (${placeholders})
       ORDER BY skill_version_id, rowid`,
    )
    .all(...versionIds) as Array<{
    id: string;
    skill_version_id: string;
    knowledge_card_id: string;
    step_id: string;
  }>;
}

function assertUnchangedHistory(
  db: DatabaseSync,
  skillId: string,
  skillRow: SkillRowSnapshot,
  versionRows: VersionRowSnapshot[],
  sourceRows: Array<{ id: string; skill_version_id: string; knowledge_card_id: string; step_id: string }>,
) {
  assert.deepEqual(snapshotSkillRow(db, skillId), skillRow);
  assert.deepEqual(snapshotVersionRows(db, skillId), versionRows);
  assert.deepEqual(
    snapshotSourceRows(
      db,
      versionRows.map((row) => row.id),
    ),
    sourceRows,
  );
  const reloaded = loadSkill(db, skillId);
  assert.equal(reloaded.status, skillRow.status);
  assert.equal(reloaded.currentVersionId, skillRow.current_version_id);
}

describe("SKILL-FUSE-001 fuseSkills", () => {
  it("fuses two existing Skills into a new draft and leaves old Skills and history rows unchanged", () => {
    const workspace = openTemp();
    try {
      const left = seedSkill(workspace.db, {
        name: "决策节奏",
        purpose: "判断进退节奏。",
        inputs: [
          { name: "situation", required: true, description: "当前局面" },
          { name: "constraint", required: false, description: "限制条件" },
        ],
        steps: [
          { id: "observe", text: "观察局势。" },
          { id: "decide", text: "决定进退。" },
        ],
        rules: ["引用原书定位符。", "不得自动发布。"],
        outputSchema: {
          type: "object",
          properties: { advice: { type: "string" }, timing: { type: "string" } },
          required: ["advice"],
        },
        permissions: { network: false, writeFiles: false, modelProvider: "local-stub" },
      });
      const right = seedSkill(workspace.db, {
        name: "修身克己",
        domain: "生活",
        purpose: "把原则落到言行。",
        status: SKILL_STATUS_DRAFT,
        inputs: [
          { name: "situation", required: false, description: "当下情境" },
          { name: "habit", required: true, description: "要克制的习惯" },
        ],
        steps: [
          { id: "observe", text: "先检视自己。" },
          { id: "practice", text: "落成一条可执行的约束。" },
        ],
        rules: ["没有来源的内容必须标注。"],
        outputSchema: {
          type: "object",
          properties: { advice: { type: "string" }, commitment: { type: "string" } },
          required: ["commitment"],
        },
        permissions: { network: true, writeFiles: false, modelProvider: "local-stub" },
      });

      const second = createSkillVersion({
        db: workspace.db,
        skillId: left.skill.id,
        version: "1.1.0",
        inputs: [
          { name: "situation", required: true, description: "更新后的局面描述" },
          { name: "constraint", required: false, description: "限制条件" },
        ],
        steps: [
          { id: "observe", text: "观察局势。" },
          { id: "weigh", text: "权衡代价。" },
          { id: "decide", text: "决定进退。" },
        ],
        rules: ["引用原书定位符。", "不得自动发布。", "先计后战。"],
        outputSchema: {
          type: "object",
          properties: { advice: { type: "string" }, timing: { type: "string" } },
          required: ["advice", "timing"],
        },
        permissions: { network: false, writeFiles: false, modelProvider: "local-stub" },
      });
      assert.equal(second.skill.status, SKILL_STATUS_DRAFT);

      const leftSkillBefore = snapshotSkillRow(workspace.db, left.skill.id);
      const rightSkillBefore = snapshotSkillRow(workspace.db, right.skill.id);
      const leftVersionsBefore = snapshotVersionRows(workspace.db, left.skill.id);
      const rightVersionsBefore = snapshotVersionRows(workspace.db, right.skill.id);
      const leftSourcesBefore = snapshotSourceRows(
        workspace.db,
        leftVersionsBefore.map((row) => row.id),
      );
      const rightSourcesBefore = snapshotSourceRows(
        workspace.db,
        rightVersionsBefore.map((row) => row.id),
      );
      assert.equal(leftVersionsBefore.length, 2);
      assert.equal(rightVersionsBefore.length, 1);

      const fused = fuseSkills({
        db: workspace.db,
        leftSkillId: left.skill.id,
        rightSkillId: right.skill.id,
        leftVersionId: second.version.id,
        rightVersionId: right.version.id,
      });

      assert.notEqual(fused.skill.id, left.skill.id);
      assert.notEqual(fused.skill.id, right.skill.id);
      assert.equal(fused.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(fused.skill.status, SKILL_STATUS_PUBLISHED);
      assert.notEqual(fused.skill.status, SKILL_STATUS_TESTED);
      assert.equal(fused.skill.name, "融合：决策节奏 + 修身克己");
      assert.equal(fused.skill.domain, "专业 / 生活");
      assert.match(fused.skill.purpose, /融合自「决策节奏」与「修身克己」/);
      assert.equal(fused.version.version, DEFAULT_SKILL_VERSION);
      assert.equal(fused.version.id, fused.skill.currentVersionId);
      assert.deepEqual(fused.version.inputs, [
        { name: "situation", required: true, description: "更新后的局面描述 / 当下情境" },
        { name: "constraint", required: false, description: "限制条件" },
        { name: "habit", required: true, description: "要克制的习惯" },
      ]);
      assert.deepEqual(fused.version.steps, [
        { id: "observe", text: "观察局势。" },
        { id: "weigh", text: "权衡代价。" },
        { id: "decide", text: "决定进退。" },
        { id: "right-observe", text: "先检视自己。" },
        { id: "practice", text: "落成一条可执行的约束。" },
      ]);
      assert.deepEqual(fused.version.rules, [
        "引用原书定位符。",
        "不得自动发布。",
        "先计后战。",
        "没有来源的内容必须标注。",
        "本 Skill 由两个已有 Skill 融合而成，当前为草稿，不得自动发布。",
      ]);
      assert.deepEqual(fused.version.outputSchema, {
        type: "object",
        properties: {
          advice: { type: "string" },
          timing: { type: "string" },
          commitment: { type: "string" },
        },
        required: ["advice", "timing", "commitment"],
      });
      const permissions = fused.version.permissions as Record<string, unknown>;
      assert.equal(permissions.network, false);
      assert.equal(permissions.writeFiles, false);
      assert.equal(permissions.modelProvider, "local-stub");

      const listed = listSkills(workspace.db);
      assert.equal(listed.length, 3);
      assert.ok(listed.some((skill) => skill.id === left.skill.id));
      assert.ok(listed.some((skill) => skill.id === right.skill.id));
      assert.ok(listed.some((skill) => skill.id === fused.skill.id));

      assert.deepEqual(
        listSkillVersions(workspace.db, left.skill.id).map((version) => version.id),
        leftVersionsBefore.map((row) => row.id),
      );
      assert.deepEqual(
        listSkillVersions(workspace.db, right.skill.id).map((version) => version.id),
        rightVersionsBefore.map((row) => row.id),
      );
      assertUnchangedHistory(workspace.db, left.skill.id, leftSkillBefore, leftVersionsBefore, leftSourcesBefore);
      assertUnchangedHistory(workspace.db, right.skill.id, rightSkillBefore, rightVersionsBefore, rightSourcesBefore);

      const fusedVersions = listSkillVersions(workspace.db, fused.skill.id);
      assert.equal(fusedVersions.length, 1);
      assert.equal(fusedVersions[0]?.id, fused.version.id);
    } finally {
      workspace.close();
    }
  });

  it("binds the fused draft Skill to a conversation context without publishing it", () => {
    const workspace = openTemp();
    try {
      const left = seedSkill(workspace.db, { name: "决策节奏" });
      const right = seedSkill(workspace.db, { name: "修身克己", domain: "生活" });
      const fused = fuseSkills({
        db: workspace.db,
        leftSkillId: left.skill.id,
        rightSkillId: right.skill.id,
        name: "节奏与克己",
      });
      assert.equal(fused.skill.name, "节奏与克己");
      assert.equal(fused.skill.status, SKILL_STATUS_DRAFT);
      assert.ok(fused.skill.currentVersionId);

      const conversation = startConversation({
        db: workspace.db,
        title: "融合 Skill 试用",
        skillId: fused.skill.id,
        skillVersionId: fused.version.id,
        selectionMethod: "manual",
      });
      assert.equal(conversation.skillId, fused.skill.id);
      assert.equal(conversation.skillVersionId, fused.version.id);
      assert.equal(conversation.selectionMethod, "manual");

      const asked = ask({
        db: workspace.db,
        conversationId: conversation.id,
        message: "先帮我判断现在该不该推进。",
      });
      assert.equal(asked.skillVersionId, fused.version.id);
      assert.equal(asked.conversation.skillId, fused.skill.id);
      assert.equal(loadSkill(workspace.db, fused.skill.id).status, SKILL_STATUS_DRAFT);
      assert.notEqual(loadSkill(workspace.db, fused.skill.id).status, SKILL_STATUS_PUBLISHED);
    } finally {
      workspace.close();
    }
  });

  it("refuses self-fusion and versions that do not belong to the named Skill", () => {
    const workspace = openTemp();
    try {
      const left = seedSkill(workspace.db, { name: "决策节奏" });
      const right = seedSkill(workspace.db, { name: "修身克己" });
      assert.throws(
        () =>
          fuseSkills({
            db: workspace.db,
            leftSkillId: left.skill.id,
            rightSkillId: left.skill.id,
          }),
        /Cannot fuse a Skill with itself/,
      );
      assert.throws(
        () =>
          fuseSkills({
            db: workspace.db,
            leftSkillId: left.skill.id,
            rightSkillId: right.skill.id,
            leftVersionId: right.version.id,
          }),
        /does not belong to the left Skill/,
      );
      assert.equal(listSkills(workspace.db).length, 2);
    } finally {
      workspace.close();
    }
  });
});

describe("SKILL-FUSE-001 createSkill contracts and publish rules", () => {
  it("keeps createSkill defaults and never lets fusion write published or tested", () => {
    const workspace = openTemp();
    try {
      const omitted = createSkill({
        db: workspace.db,
        name: "默认状态样本",
        domain: "专业",
        purpose: "确认省略 status 时仍默认为 tested。",
        inputs: [{ name: "topic", required: true, description: "主题" }],
        steps: [{ id: "collect", text: "收集主题。" }],
        rules: ["不得自动发布。"],
        outputSchema: { type: "object" },
        permissions: { network: false, writeFiles: false },
      });
      assert.equal(omitted.skill.status, SKILL_STATUS_TESTED);
      assert.notEqual(omitted.skill.status, SKILL_STATUS_PUBLISHED);

      assert.throws(
        () =>
          createSkill({
            db: workspace.db,
            name: "非法发布样本",
            domain: "专业",
            purpose: "确认 createSkill 仍拒绝 published。",
            status: SKILL_STATUS_PUBLISHED,
            inputs: [{ name: "topic", required: true, description: "主题" }],
            steps: [{ id: "collect", text: "收集主题。" }],
            rules: ["不得自动发布。"],
            outputSchema: { type: "object" },
            permissions: { network: false, writeFiles: false },
          }),
        /must not be auto-published/,
      );

      const left = seedSkill(workspace.db, { name: "决策节奏", status: SKILL_STATUS_TESTED });
      const right = seedSkill(workspace.db, { name: "修身克己", status: SKILL_STATUS_TESTED });
      const fused = fuseSkills({
        db: workspace.db,
        leftSkillId: left.skill.id,
        rightSkillId: right.skill.id,
      });
      assert.equal(fused.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(fused.skill.status, SKILL_STATUS_TESTED);
      assert.notEqual(fused.skill.status, SKILL_STATUS_PUBLISHED);
      assert.equal(loadSkill(workspace.db, left.skill.id).status, SKILL_STATUS_TESTED);
      assert.equal(loadSkill(workspace.db, right.skill.id).status, SKILL_STATUS_TESTED);
    } finally {
      workspace.close();
    }
  });
});

describe("SKILL-FUSE-001 conversation knowledge deposit", () => {
  it("manually deposits a conversation knowledge point as a draft without inventing locators or verifying it", () => {
    const workspace = openTemp();
    try {
      const left = seedSkill(workspace.db, { name: "决策节奏" });
      const right = seedSkill(workspace.db, { name: "修身克己" });
      const fused = fuseSkills({
        db: workspace.db,
        leftSkillId: left.skill.id,
        rightSkillId: right.skill.id,
      });
      const conversation = startConversation({
        db: workspace.db,
        title: "融合后的复盘",
        skillId: fused.skill.id,
        skillVersionId: fused.version.id,
        selectionMethod: "manual",
      });
      const asked = ask({
        db: workspace.db,
        conversationId: conversation.id,
        message: "这次讨论里我想留下一条新的判断原则。",
      });

      const deposited = depositConversationKnowledgeDraft({
        db: workspace.db,
        conversationId: conversation.id,
        turnId: asked.userTurn.id,
        title: "先稳住再推进",
        content: "在局势未明时，先保住可撤回的余地，再决定是否推进。",
      });

      assert.equal(deposited.conversationId, conversation.id);
      assert.equal(deposited.turnId, asked.userTurn.id);
      assert.equal(deposited.card.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.notEqual(deposited.card.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(deposited.card.type, KNOWLEDGE_CARD_TYPE_CASE);
      assert.equal(deposited.card.title, "先稳住再推进");
      assert.match(deposited.card.content, /先保住可撤回的余地/);
      assert.deepEqual(deposited.card.sources, []);
      assert.match(String(deposited.card.limitations), new RegExp(UNCONFIRMED_LOCATION_LABEL));
      assert.equal(loadSkill(workspace.db, fused.skill.id).status, SKILL_STATUS_DRAFT);

      assert.throws(
        () =>
          depositConversationKnowledgeDraft({
            db: workspace.db,
            conversationId: conversation.id,
            turnId: "00000000-0000-4000-8000-000000000000",
            title: "无效回合",
            content: "不应写入。",
          }),
        /does not belong to conversation/,
      );
      assert.throws(
        () =>
          depositConversationKnowledgeDraft({
            db: workspace.db,
            conversationId: conversation.id,
            title: "   ",
            content: "缺少标题。",
          }),
        /needs a title/,
      );
    } finally {
      workspace.close();
    }
  });
});
