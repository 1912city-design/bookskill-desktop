import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  CONCEPT_CARD_TEMPLATE_ID,
  confirmKnowledgeCard,
  DEFAULT_SKILL_TEMPLATE_PERMISSIONS,
  DEFAULT_SKILL_VERSION,
  getSkillTemplate,
  instantiateKnowledgeCardTemplate,
  instantiateSkillTemplate,
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  listKnowledgeCardTemplates,
  listSkillTemplates,
  loadKnowledgeCard,
  loadSkill,
  loadSkillVersion,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SKILL_TEMPLATE_DOMAIN_LABELS,
  SKILL_TEMPLATE_IDS,
  validateSkillTemplateInput,
} from "../src/index.ts";
import { createTempWorkspace, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

const EXPECTED_SKILL_TEMPLATES = [
  { id: "daily.daily-plan", domain: "daily", name: "每日计划" },
  { id: "daily.weekly-review", domain: "daily", name: "每周回顾" },
  { id: "daily.reading-review", domain: "daily", name: "阅读复盘" },
  { id: "life.complex-choice", domain: "life", name: "复杂选择梳理" },
  { id: "life.family-planning", domain: "life", name: "家庭事务规划" },
  { id: "life.habit-plan", domain: "life", name: "习惯行动计划" },
  { id: "professional.meeting-prep", domain: "professional", name: "会议准备" },
  { id: "professional.interview-outline", domain: "professional", name: "访谈提纲" },
  { id: "professional.project-retro", domain: "professional", name: "项目复盘" },
] as const;

function openTemp() {
  const temp = createTempWorkspace();
  temps.push(temp);
  return temp.open();
}

function permissionsOf(raw: unknown): Record<string, unknown> {
  assert.ok(raw && typeof raw === "object" && !Array.isArray(raw));
  return raw as Record<string, unknown>;
}

function countSources(db: ReturnType<typeof openTemp>["db"], cardId: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS count FROM knowledge_sources WHERE knowledge_card_id = ?`)
    .get(cardId) as { count: number };
  return Number(row.count);
}

describe("SKILL-004 templates", () => {
  it("lists the nine frozen Skill templates with stable ids and domains", () => {
    const listed = listSkillTemplates();
    assert.equal(listed.length, 9);
    assert.deepEqual(
      listed.map((item) => ({ id: item.id, domain: item.domain, name: item.name })),
      EXPECTED_SKILL_TEMPLATES.map((item) => ({ id: item.id, domain: item.domain, name: item.name })),
    );
    assert.deepEqual([...SKILL_TEMPLATE_IDS], EXPECTED_SKILL_TEMPLATES.map((item) => item.id));
    assert.ok(!listed.some((item) => item.id === CONCEPT_CARD_TEMPLATE_ID));
    for (const item of listed) {
      assert.equal(typeof item.purpose, "string");
      assert.ok(item.purpose.length > 0);
      assert.equal(typeof item.whenToUse, "string");
      assert.ok(item.whenToUse.length > 0);
      assert.equal(typeof item.whenNotToUse, "string");
      assert.ok(item.whenNotToUse.length > 0);
      assert.match(item.whenNotToUse, /不适合|不得|不应/);
    }
  });

  it("does not claim that template copy applies to all users or jobs", () => {
    const claim = /适用于所有用户|适用于所有岗位|适用于所有人|适用于任何职业|对所有人的选择都有效|对任何岗位都有效/;
    for (const summary of listSkillTemplates()) {
      const template = getSkillTemplate(summary.id);
      const affirmative = [template.purpose, template.whenToUse].join("\n");
      assert.doesNotMatch(affirmative, claim);
      const guarded = [template.whenNotToUse, ...template.rules].join("\n");
      assert.match(guarded, /不能声称适用于所有用户或岗位|不得声称|不适合/);
    }
  });

  it("rejects unknown Skill ids and does not instantiate the concept-card as a Skill", () => {
    const workspace = openTemp();
    try {
      assert.throws(() => getSkillTemplate("daily.unknown"), /未知的 Skill 模板/);
      assert.throws(
        () => instantiateSkillTemplate({ db: workspace.db, templateId: "daily.unknown" }),
        /未知的 Skill 模板/,
      );
      assert.throws(
        () => instantiateSkillTemplate({ db: workspace.db, templateId: CONCEPT_CARD_TEMPLATE_ID }),
        /概念卡模板会生成知识卡草稿/,
      );
      assert.throws(() => validateSkillTemplateInput(CONCEPT_CARD_TEMPLATE_ID, {}), /概念卡模板会生成知识卡草稿/);
    } finally {
      workspace.close();
    }
  });
});

describe("SKILL-004 instantiateSkillTemplate", () => {
  for (const expected of EXPECTED_SKILL_TEMPLATES) {
    it(`instantiates ${expected.id} as a draft Skill with a first version`, () => {
      const workspace = openTemp();
      try {
        const template = getSkillTemplate(expected.id);
        const created = instantiateSkillTemplate({ db: workspace.db, templateId: expected.id });
        assert.equal(created.skill.status, SKILL_STATUS_DRAFT);
        assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);
        assert.equal(created.skill.name, expected.name);
        assert.equal(created.skill.domain, SKILL_TEMPLATE_DOMAIN_LABELS[expected.domain]);
        assert.equal(created.skill.purpose, template.purpose);
        assert.ok(created.skill.currentVersionId);
        assert.equal(created.version.id, created.skill.currentVersionId);
        assert.equal(created.version.version, DEFAULT_SKILL_VERSION);
        assert.deepEqual(created.version.inputs, template.inputs);
        assert.deepEqual(created.version.steps, template.steps);
        assert.deepEqual(created.version.rules, template.rules);
        assert.deepEqual(created.version.outputSchema, template.outputSchema);

        const permissions = permissionsOf(created.version.permissions);
        assert.equal(permissions.network, false);
        assert.equal(permissions.writeFiles, false);
        assert.equal(permissions.network, DEFAULT_SKILL_TEMPLATE_PERMISSIONS.network);
        assert.equal(permissions.writeFiles, DEFAULT_SKILL_TEMPLATE_PERMISSIONS.writeFiles);
        assert.equal(permissions.whenToUse, template.whenToUse);
        assert.equal(permissions.whenNotToUse, template.whenNotToUse);

        const reloaded = loadSkill(workspace.db, created.skill.id);
        const version = loadSkillVersion(workspace.db, created.version.id);
        assert.equal(reloaded.status, SKILL_STATUS_DRAFT);
        assert.equal(version.version, DEFAULT_SKILL_VERSION);
        const versionCount = workspace.db
          .prepare(`SELECT COUNT(*) AS count FROM skill_versions WHERE skill_id = ?`)
          .get(created.skill.id) as { count: number };
        assert.equal(Number(versionCount.count), 1);
      } finally {
        workspace.close();
      }
    });
  }

  it("uses an optional name override but still stays draft", () => {
    const workspace = openTemp();
    try {
      const created = instantiateSkillTemplate({
        db: workspace.db,
        templateId: "daily.daily-plan",
        name: "我的今日计划草稿",
      });
      assert.equal(created.skill.name, "我的今日计划草稿");
      assert.equal(created.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);
    } finally {
      workspace.close();
    }
  });
});

describe("SKILL-004 template examples and validation", () => {
  for (const expected of EXPECTED_SKILL_TEMPLATES) {
    it(`${expected.id} has a successful example and a boundary example that does not publish`, () => {
      const workspace = openTemp();
      try {
        const template = getSkillTemplate(expected.id);
        const success = validateSkillTemplateInput(expected.id, template.successExample.input);
        assert.equal(success.ok, true);
        assert.equal(success.complete, true);
        assert.deepEqual(success.errors, []);
        assert.equal(success.published, false);

        const boundary = validateSkillTemplateInput(expected.id, template.boundaryExample.input);
        assert.equal(boundary.ok, false);
        assert.equal(boundary.complete, false);
        assert.ok(boundary.errors.length > 0);
        assert.equal(boundary.published, false);
        assert.match(boundary.errors.join("\n"), /缺少必填输入|超出本模板范围/);

        const created = instantiateSkillTemplate({ db: workspace.db, templateId: expected.id });
        assert.equal(created.skill.status, SKILL_STATUS_DRAFT);
        assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);
      } finally {
        workspace.close();
      }
    });
  }
});

describe("SKILL-004 knowledge.concept-card", () => {
  it("lists the concept-card template and instantiates a draft knowledge card, not a Skill", () => {
    const workspace = openTemp();
    try {
      const listed = listKnowledgeCardTemplates();
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.id, CONCEPT_CARD_TEMPLATE_ID);
      assert.equal(listed[0]?.name, "概念卡");
      assert.deepEqual(listed[0]?.fields, ["标题", "定义/内容", "适用条件", "限制", "来源占位"]);

      const card = instantiateKnowledgeCardTemplate({
        db: workspace.db,
        templateId: CONCEPT_CARD_TEMPLATE_ID,
      });
      assert.equal(card.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.notEqual(card.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(card.title, "概念卡草稿");
      assert.equal(card.type, "概念");
      assert.match(card.content, /定义\/内容/);
      assert.match(String(card.conditions), /适用条件/);
      assert.match(String(card.limitations), /来源占位/);
      assert.equal(countSources(workspace.db, card.id), 0);

      const loaded = loadKnowledgeCard(workspace.db, card.id);
      assert.equal(loaded.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.deepEqual(loaded.sources, []);

      const confirmed = confirmKnowledgeCard({ db: workspace.db, cardId: card.id, title: "用户确认后的概念卡" });
      assert.equal(confirmed.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.equal(confirmed.title, "用户确认后的概念卡");
    } finally {
      workspace.close();
    }
  });

  it("rejects an unknown knowledge-card template id and does not auto-verify a custom title draft", () => {
    const workspace = openTemp();
    try {
      assert.throws(
        () => instantiateKnowledgeCardTemplate({ db: workspace.db, templateId: "knowledge.unknown" }),
        /未知的知识卡模板/,
      );
      const card = instantiateKnowledgeCardTemplate({
        db: workspace.db,
        templateId: CONCEPT_CARD_TEMPLATE_ID,
        title: "可编辑的概念草稿",
      });
      assert.equal(card.title, "可编辑的概念草稿");
      assert.equal(card.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.notEqual(card.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
    } finally {
      workspace.close();
    }
  });
});
