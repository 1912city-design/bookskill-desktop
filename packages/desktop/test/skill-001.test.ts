import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  KNOWLEDGE_CARD_STATUS_VERIFIED,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SKILL_STATUS_TESTED,
  createSkill,
  openSliceWorkspace,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { ensureShellSkill } from "../src/main/conversation-path.ts";
import {
  CONCEPT_CARD_TEMPLATE_ID,
  createBlankSkill,
  instantiateConceptCard,
  instantiateSkillTemplate,
  listSkillTemplates,
  listSkills,
  loadSkillEditorView,
  saveSkill,
  SKILL_STATUS_ARCHIVED,
  transitionSkillStatus,
  updateSkillMetadata,
} from "../src/main/skills-editor.ts";
import { SKILL_TEMPLATE_IDS } from "../src/main/skill-templates.ts";
import { renderKnowledgeRoute } from "../src/renderer/knowledge/view.ts";
import { emptyKnowledgeUiState } from "../src/renderer/knowledge/types.ts";
import { renderSkillsRoute } from "../src/renderer/skills/view.ts";
import { draftFromSkill, emptySkillsUiState } from "../src/renderer/skills/types.ts";

const leftovers: string[] = [];
const WORKTREE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-skill-"));
  leftovers.push(dataDir);
  initializeDataDir({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
  return dataDir;
}

function openWorkspace(dataDir: string) {
  return openSliceWorkspace({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
}

function assertEditableContractFields(skill: ReturnType<typeof loadSkillEditorView>): void {
  assert.equal(typeof skill.name, "string");
  assert.ok(skill.name.length > 0);
  assert.equal(typeof skill.domain, "string");
  assert.ok(skill.domain.length > 0);
  assert.equal(typeof skill.purpose, "string");
  assert.equal(typeof skill.whenToUse, "string");
  assert.equal(typeof skill.whenNotToUse, "string");
  assert.ok(Array.isArray(skill.inputs));
  assert.ok(Array.isArray(skill.steps));
  assert.ok(Array.isArray(skill.rules));
  assert.equal(typeof skill.outputSchema, "object");
  assert.equal(typeof skill.permissions.network, "boolean");
  assert.equal(typeof skill.permissions.writeFiles, "boolean");
  assert.equal(typeof skill.permissions.modelProvider, "string");
  assert.ok(skill.version);
  assert.ok(skill.currentVersionId);
}

describe("SKILL-001 template picker and Skill editor", () => {
  it("lists the nine frozen Skill template ids with editable 2.6 summaries", () => {
    const templates = listSkillTemplates();
    assert.deepEqual(
      templates.map((template) => template.id),
      [...SKILL_TEMPLATE_IDS],
    );
    assert.deepEqual(templates.map((template) => template.id), [
      "daily.daily-plan",
      "daily.weekly-review",
      "daily.reading-review",
      "life.complex-choice",
      "life.family-planning",
      "life.habit-plan",
      "professional.meeting-prep",
      "professional.interview-outline",
      "professional.project-retro",
    ]);
    for (const template of templates) {
      assert.ok(template.name);
      assert.ok(template.purpose);
      assert.ok(template.whenToUse);
      assert.ok(template.whenNotToUse);
      assert.ok(["daily", "life", "professional"].includes(template.domain));
      assert.doesNotMatch(template.purpose + template.whenToUse, /适用于所有用户|适用于所有岗位/);
    }
  });

  it("creates a draft Skill from a blank form and from each stable template id", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const blank = createBlankSkill(workspace.db);
      assert.equal(blank.status, SKILL_STATUS_DRAFT);
      assert.notEqual(blank.status, SKILL_STATUS_PUBLISHED);
      assert.equal(blank.version, "1.0.0");
      assertEditableContractFields(blank);

      for (const templateId of SKILL_TEMPLATE_IDS) {
        const created = instantiateSkillTemplate({ db: workspace.db, templateId });
        assert.equal(created.status, SKILL_STATUS_DRAFT, templateId);
        assert.notEqual(created.status, SKILL_STATUS_PUBLISHED, templateId);
        assert.equal(created.version, "1.0.0", templateId);
        assertEditableContractFields(created);
        assert.ok(created.whenToUse.length > 0, templateId);
        assert.ok(created.whenNotToUse.length > 0, templateId);
      }

      const listed = listSkills(workspace.db);
      assert.equal(listed.length, 1 + SKILL_TEMPLATE_IDS.length);
      assert.ok(listed.every((skill) => skill.status === SKILL_STATUS_DRAFT));
    } finally {
      workspace.close();
    }
  });

  it("refuses auto-published creates, saves, and implicit publish attempts", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      assert.throws(() => createBlankSkill(workspace.db, { status: SKILL_STATUS_PUBLISHED }), /published/);
      assert.throws(
        () => instantiateSkillTemplate({ db: workspace.db, templateId: "daily.reading-review", status: SKILL_STATUS_PUBLISHED }),
        /published/,
      );

      const skill = createBlankSkill(workspace.db);
      assert.throws(
        () =>
          saveSkill(workspace.db, {
            skillId: skill.id,
            name: skill.name,
            domain: skill.domain,
            purpose: skill.purpose,
            whenToUse: skill.whenToUse,
            whenNotToUse: skill.whenNotToUse,
            inputs: skill.inputs,
            steps: skill.steps,
            rules: skill.rules,
            outputSchema: skill.outputSchema,
            permissions: skill.permissions,
            status: SKILL_STATUS_PUBLISHED,
          }),
        /published/,
      );

      assert.throws(
        () => transitionSkillStatus(workspace.db, { skillId: skill.id, action: "publish" }),
        /显式确认|不能默认/,
      );
      assert.throws(
        () => transitionSkillStatus(workspace.db, { skillId: skill.id, action: "publish", confirmedByUser: false }),
        /显式确认|不能默认/,
      );
      assert.throws(
        () => transitionSkillStatus(workspace.db, { skillId: skill.id, action: "publish", confirmedByUser: true }),
        /不能直接发布|先标记为已测试/,
      );
      assert.equal(loadSkillEditorView(workspace.db, skill.id).status, SKILL_STATUS_DRAFT);
    } finally {
      workspace.close();
    }
  });

  it("applies explicit draft to tested to published and archive transitions, and rejects illegal ones", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const skill = instantiateSkillTemplate({ db: workspace.db, templateId: "professional.project-retro" });
      assert.equal(skill.status, SKILL_STATUS_DRAFT);

      const tested = transitionSkillStatus(workspace.db, { skillId: skill.id, action: "mark_tested" });
      assert.equal(tested.status, SKILL_STATUS_TESTED);

      const published = transitionSkillStatus(workspace.db, {
        skillId: skill.id,
        action: "publish",
        confirmedByUser: true,
      });
      assert.equal(published.status, SKILL_STATUS_PUBLISHED);

      assert.throws(
        () => transitionSkillStatus(workspace.db, { skillId: skill.id, action: "mark_tested" }),
        /只有草稿/,
      );

      const archived = transitionSkillStatus(workspace.db, { skillId: skill.id, action: "archive" });
      assert.equal(archived.status, SKILL_STATUS_ARCHIVED);

      assert.throws(
        () =>
          transitionSkillStatus(workspace.db, {
            skillId: skill.id,
            action: "publish",
            confirmedByUser: true,
          }),
        /已归档/,
      );

      const draft = createBlankSkill(workspace.db, { name: "待归档草稿" });
      const archivedDraft = transitionSkillStatus(workspace.db, { skillId: draft.id, action: "archive" });
      assert.equal(archivedDraft.status, SKILL_STATUS_ARCHIVED);
      assert.throws(
        () =>
          transitionSkillStatus(workspace.db, {
            skillId: draft.id,
            action: "publish",
            confirmedByUser: true,
          }),
        /已归档/,
      );
    } finally {
      workspace.close();
    }
  });

  it("saves by appending a new skill_versions row and leaves the previous JSON untouched", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const created = createBlankSkill(workspace.db, { name: "版本历史样本" });
      const previousId = created.currentVersionId!;
      const previousRow = workspace.db
        .prepare(
          `SELECT version, inputs_json, steps_json, rules_json, output_schema_json, permissions_json
           FROM skill_versions WHERE id = ?`,
        )
        .get(previousId) as {
        version: string;
        inputs_json: string;
        steps_json: string;
        rules_json: string;
        output_schema_json: string;
        permissions_json: string;
      };
      const countBefore = (
        workspace.db.prepare(`SELECT COUNT(*) AS n FROM skill_versions WHERE skill_id = ?`).get(created.id) as { n: number }
      ).n;

      const saved = saveSkill(workspace.db, {
        skillId: created.id,
        name: "版本历史样本（已改）",
        domain: "专业",
        purpose: "保存后应追加新版本。",
        whenToUse: "测试保存路径时。",
        whenNotToUse: "不要原地改写历史版本。",
        inputs: [{ name: "topic", required: true, description: "新的输入" }],
        steps: [{ id: "edit", text: "写下修改后的步骤。" }],
        rules: ["保存不得破坏既有版本行。"],
        outputSchema: { type: "object", properties: { summary: { type: "string" } } },
        permissions: { network: false, writeFiles: false, modelProvider: "local-stub" },
      });

      assert.equal(saved.status, SKILL_STATUS_DRAFT);
      assert.notEqual(saved.status, SKILL_STATUS_PUBLISHED);
      assert.notEqual(saved.currentVersionId, previousId);
      assert.equal(saved.version, "1.0.1");
      assert.equal(saved.whenToUse, "测试保存路径时。");
      assert.equal(saved.name, "版本历史样本（已改）");

      const countAfter = (
        workspace.db.prepare(`SELECT COUNT(*) AS n FROM skill_versions WHERE skill_id = ?`).get(created.id) as { n: number }
      ).n;
      assert.equal(countAfter, countBefore + 1);

      const untouched = workspace.db
        .prepare(
          `SELECT version, inputs_json, steps_json, rules_json, output_schema_json, permissions_json
           FROM skill_versions WHERE id = ?`,
        )
        .get(previousId) as typeof previousRow;
      assert.deepEqual(untouched, previousRow);

      const metadata = updateSkillMetadata(workspace.db, {
        skillId: saved.id,
        name: "只改名称",
        domain: saved.domain,
        purpose: saved.purpose,
      });
      assert.equal(metadata.name, "只改名称");
      assert.equal(metadata.currentVersionId, saved.currentVersionId);
      const stillUntouched = workspace.db
        .prepare(`SELECT inputs_json FROM skill_versions WHERE id = ?`)
        .get(previousId) as { inputs_json: string };
      assert.equal(stillUntouched.inputs_json, previousRow.inputs_json);
    } finally {
      workspace.close();
    }
  });

  it("reads missing when_to_use keys as empty strings on existing unpublished skills", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const shell = ensureShellSkill(workspace.db);
      const loaded = loadSkillEditorView(workspace.db, shell.skillId);
      assert.notEqual(loaded.status, SKILL_STATUS_PUBLISHED);
      assert.equal(loaded.whenToUse, "");
      assert.equal(loaded.whenNotToUse, "");
      assert.equal(loaded.permissions.network, false);
      assert.equal(loaded.permissions.writeFiles, false);

      const legacy = createSkill({
        db: workspace.db,
        name: "旧权限样本",
        domain: "专业",
        purpose: "没有 whenToUse 键的既有 Skill。",
        status: SKILL_STATUS_TESTED,
        version: "1.0.0",
        inputs: [],
        steps: [{ id: "one", text: "一步。" }],
        rules: ["不得自动发布。"],
        outputSchema: { type: "object" },
        permissions: { network: false, writeFiles: false, modelProvider: "local-stub" },
      });
      const viewed = loadSkillEditorView(workspace.db, legacy.skill.id);
      assert.equal(viewed.whenToUse, "");
      assert.equal(viewed.whenNotToUse, "");
    } finally {
      workspace.close();
    }
  });

  it("creates a draft concept card from the template and does not mark it verified_by_user", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const card = instantiateConceptCard(workspace.db);
      assert.equal(card.status, KNOWLEDGE_CARD_STATUS_DRAFT);
      assert.notEqual(card.status, KNOWLEDGE_CARD_STATUS_VERIFIED);
      assert.match(card.title, /概念卡/);
      assert.match(card.content, /定义|内容|占位/);
      assert.ok(card.conditions);
      assert.match(String(card.limitations), /来源占位/);

      const sources = workspace.db
        .prepare(`SELECT COUNT(*) AS n FROM knowledge_sources WHERE knowledge_card_id = ?`)
        .get(card.id) as { n: number };
      assert.equal(sources.n, 0);

      const emptyHtml = renderKnowledgeRoute(emptyKnowledgeUiState());
      assert.match(emptyHtml, /data-testid="knowledge-concept-template"/);
      assert.match(emptyHtml, /从模板新建草稿/);
      assert.match(emptyHtml, /data-testid="draft-form"/);

      const selectedHtml = renderKnowledgeRoute({
        ...emptyKnowledgeUiState(),
        loaded: true,
        cards: [
          {
            id: card.id,
            title: card.title,
            type: card.type,
            content: card.content,
            conditions: card.conditions,
            limitations: card.limitations,
            status: card.status,
            createdAt: card.createdAt,
            updatedAt: card.updatedAt,
            sources: [],
          },
        ],
        selectedCardId: card.id,
        editTitle: card.title,
        editContent: card.content,
        editConditions: card.conditions ?? "",
        editLimitations: card.limitations ?? "",
      });
      assert.match(selectedHtml, /data-testid="knowledge-concept-template"/);
      assert.match(selectedHtml, /data-testid="confirm-card"/);
      assert.match(selectedHtml, /data-testid="editor-status-code">draft</);
      assert.doesNotMatch(selectedHtml, /data-testid="editor-status-code">verified_by_user</);

      assert.throws(
        () => instantiateSkillTemplate({ db: workspace.db, templateId: CONCEPT_CARD_TEMPLATE_ID }),
        /知识卡/,
      );
    } finally {
      workspace.close();
    }
  });

  it("renders create controls, contract fields, current version, and the reserved history entry", () => {
    const emptyHtml = renderSkillsRoute(emptySkillsUiState());
    assert.match(emptyHtml, /data-testid="skill-create-blank"/);
    assert.match(emptyHtml, /data-testid="skill-templates"/);
    assert.match(emptyHtml, /data-testid="skills-empty"/);
    assert.doesNotMatch(emptyHtml, /data-testid="skill-publish"[^>]*type="submit"/);

    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const created = instantiateSkillTemplate({ db: workspace.db, templateId: "daily.daily-plan" });
      const html = renderSkillsRoute({
        loaded: true,
        templates: listSkillTemplates(),
        skills: listSkills(workspace.db),
        selectedSkillId: created.id,
        editor: created,
        draft: draftFromSkill(created),
        error: null,
        statusMessage: null,
      });
      for (const testId of [
        "skill-create-blank",
        "skill-templates",
        "skill-template",
        "skill-instantiate",
        "skills-list",
        "skill-item",
        "skill-editor",
        "skill-name",
        "skill-domain",
        "skill-purpose",
        "skill-when-to-use",
        "skill-when-not-to-use",
        "skill-inputs",
        "skill-steps",
        "skill-rules",
        "skill-output-schema",
        "skill-permissions",
        "skill-save",
        "skill-status",
        "skill-mark-tested",
        "skill-publish",
        "skill-archive",
        "skill-version",
        "skill-version-id",
        "skill-versions-entry",
      ]) {
        assert.match(html, new RegExp(`data-testid="${testId}"`), testId);
      }
      assert.match(html, /data-testid="skill-version">1\.0\.0</);
      assert.match(html, new RegExp(`data-testid="skill-version-id">${created.currentVersionId}<`));
      assert.match(html, /版本列表与回滚即将提供（VER-002）/);
      assert.match(html, /daily\.reading-review/);
      assert.match(html, /data-testid="skill-status"[^>]*data-status="draft"/);
      assert.match(html, /data-testid="skill-publish" disabled/);
      assert.doesNotMatch(html, /data-testid="skill-mark-tested" disabled/);
      assert.doesNotMatch(html, /data-testid="skill-save"[^>]*data-status="published"/);
    } finally {
      workspace.close();
    }
  });

  it("does not add a sixth route or value-import the core barrel from new skills renderer files", () => {
    const navigation = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/shared/navigation.ts"), "utf8");
    assert.match(navigation, /id: "skills"/);
    assert.equal([...navigation.matchAll(/id: "/g)].filter((match) => /chat|library|knowledge|skills|settings/.test(match.input ?? "")).length >= 1, true);

    const skillsDir = path.join(WORKTREE_ROOT, "packages/desktop/src/renderer/skills");
    for (const file of fs.readdirSync(skillsDir)) {
      if (!file.endsWith(".ts")) {
        continue;
      }
      const source = fs.readFileSync(path.join(skillsDir, file), "utf8");
      assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*from\s+["']@bookskill\/core["']/);
    }

    const rendererMain = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/renderer/main.ts"), "utf8");
    assert.doesNotMatch(rendererMain, /from\s+["']@bookskill\/core["']/);

    const preload = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/preload.cjs"), "utf8");
    assert.match(preload, /listSkillTemplates:/);
    assert.match(preload, /instantiateSkillTemplate:/);
    assert.match(preload, /createBlankSkill:/);
    assert.match(preload, /transitionSkillStatus:/);
    assert.match(preload, /instantiateConceptCard:/);
    assert.match(preload, /skills:listTemplates/);
    assert.match(preload, /knowledge:instantiateConceptTemplate/);

    const main = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/main.ts"), "utf8");
    assert.match(main, /skills:createBlank/);
    assert.match(main, /skills:transitionStatus/);
    assert.match(main, /knowledge:instantiateConceptTemplate/);
    assert.match(main, /DEFAULT_ROUTE_ID/);
  });
});
