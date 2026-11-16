import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  UNCONFIRMED_LOCATION_LABEL,
  loadSkill,
  openSliceWorkspace,
} from "@bookskill/core";
import {
  countSkillsInWorkspace,
  importDistillation,
  parseDistillationMarkdown,
  validateDistillation,
} from "../src/main/distill-adapter.ts";
import {
  NO_MODEL_ADAPTER_REASON,
  attachDistillationToChat,
  startDistill,
} from "../src/main/distill-path.ts";
import { renderChatRoute } from "../src/renderer/chat/view.ts";
import { emptyChatUiState } from "../src/renderer/chat/types.ts";
import {
  DISTILL_UNCONFIRMED_LOCATION_LABEL,
  LOCKED_SECTION_TITLES,
  emptyDistillUiState,
} from "../src/renderer/distill/types.ts";
import { renderDistillPreview, renderDistillRoute } from "../src/renderer/distill/view.ts";
import { renderLibraryList } from "../src/renderer/read/view.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../src/shared/navigation.ts";
import { initializeDataDir } from "../src/shared/data-layout.ts";

const leftovers: string[] = [];
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKTREE_ROOT = path.resolve(TEST_DIR, "../../..");
const FIXTURES_DIR = path.join(TEST_DIR, "fixtures/distill");

const LOCKED_FILES = {
  "蒸馏提示词模板.md": "7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2",
  "孙子兵法_蒸馏结果.md": "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290",
  "论语_蒸馏结果.md": "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a",
  "道德经_蒸馏结果.md": "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d",
} as const;

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-distill-"));
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

function readFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, name), "utf8");
}

function sha256File(name: string): string {
  return createHash("sha256").update(fs.readFileSync(path.join(FIXTURES_DIR, name))).digest("hex");
}

function sectionTitlesInOrder(html: string): string[] {
  const matches = [...html.matchAll(/data-testid="distill-section"[^>]*data-title="([^"]+)"/g)];
  return matches.map((match) => match[1] ?? "");
}

describe("DISTILL-002 library distill preview and chat handoff", () => {
  it("keeps locked fixture SHA-256 hashes unchanged", () => {
    for (const [name, expected] of Object.entries(LOCKED_FILES)) {
      assert.equal(sha256File(name), expected, name);
    }
    const sums = fs.readFileSync(path.join(FIXTURES_DIR, "SHA256SUMS"), "utf8");
    for (const [name, expected] of Object.entries(LOCKED_FILES)) {
      assert.match(sums, new RegExp(`${expected}\\s+${name}`));
    }
    assert.equal(DISTILL_UNCONFIRMED_LOCATION_LABEL, UNCONFIRMED_LOCATION_LABEL);
    assert.equal(DISTILL_UNCONFIRMED_LOCATION_LABEL, "来源定位未确认");
  });

  it("parses locked 5-segment fixtures and renders a copyable preview without a packaged Electron window", () => {
    for (const name of ["孙子兵法_蒸馏结果.md", "论语_蒸馏结果.md", "道德经_蒸馏结果.md"] as const) {
      const markdown = readFixture(name);
      const parsed = parseDistillationMarkdown(markdown, { sourceFilename: name });
      const validation = validateDistillation(parsed);
      assert.equal(validation.ok, true, name);
      assert.deepEqual(
        parsed.sections.map((section) => section.title),
        [...LOCKED_SECTION_TITLES],
        name,
      );
      assert.ok((parsed.sections[4]?.skills?.length ?? 0) >= 1, name);
    }

    const sourceFilename = "孙子兵法_蒸馏结果.md";
    const markdown = readFixture(sourceFilename);
    const parsed = parseDistillationMarkdown(markdown, { sourceFilename });
    const previewHtml = renderDistillPreview(
      {
        id: "preview-only",
        title: parsed.title,
        sourceFilename,
        locatorLabel: DISTILL_UNCONFIRMED_LOCATION_LABEL,
        locatorConfirmed: false,
        markdown,
        json: `${JSON.stringify(parsed, null, 2)}\n`,
        sections: parsed.sections,
        skills: (parsed.sections[4]?.skills ?? []).map((skill) => ({
          ...skill,
          markdown: [`### Skill：${skill.name}`, `- **Skill名称**：${skill.name}`, `- **触发条件**：${skill.triggers.join("；")}`, `- **执行步骤**：`, ...skill.steps.map((step, index) => `  ${index + 1}. ${step}`), `- **输出要求**：${skill.output}`].join("\n"),
          json: `${JSON.stringify(skill, null, 2)}\n`,
        })),
        skillRefs: [],
      },
      "preview",
    );

    assert.deepEqual(sectionTitlesInOrder(previewHtml), [...LOCKED_SECTION_TITLES]);
    for (const [index, title] of LOCKED_SECTION_TITLES.entries()) {
      assert.match(previewHtml, new RegExp(`data-testid="distill-section"[^>]*data-id="${index + 1}"[^>]*data-title="${title}"`));
    }
    assert.match(previewHtml, /data-testid="distill-preview"/);
    assert.match(previewHtml, /data-testid="distill-view-markdown"/);
    assert.match(previewHtml, /data-testid="distill-view-json"/);
    assert.match(previewHtml, /data-testid="distill-skill"/);
    assert.match(previewHtml, /data-testid="distill-skill-copy-markdown"/);
    assert.match(previewHtml, /data-testid="distill-skill-copy-json"/);
    assert.match(previewHtml, /孙子庙算决策评估/);
    assert.match(previewHtml, /\*\*Skill名称\*\*：孙子庙算决策评估/);
    assert.match(previewHtml, /&quot;name&quot;: &quot;孙子庙算决策评估&quot;/);
    assert.match(previewHtml, /data-testid="distill-source-filename">孙子兵法_蒸馏结果\.md</);
    assert.match(
      previewHtml,
      /data-testid="distill-locator"[^>]*data-confirmed="false"[^>]*>来源定位未确认/,
    );
    assert.doesNotMatch(previewHtml, /data-testid="distill-locator"[^>]*>[^<]*P\d+/);
    assert.doesNotMatch(previewHtml, /data-paragraph-id="P\d+/);
  });

  it("imports the Sunzi fixture as draft Skills, attaches book and skill context to chat, and does not publish", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const sourceFilename = "孙子兵法_蒸馏结果.md";
      const imported = importDistillation({
        db: workspace.db,
        dataDir,
        markdown: readFixture(sourceFilename),
        sourceFilename,
      });
      assert.equal(imported.ok, true);
      if (!imported.ok) {
        return;
      }
      assert.ok(imported.record.skillRefs.length >= 1);
      const first = imported.record.skillRefs[0];
      assert.ok(first);
      const skill = loadSkill(workspace.db, first.skillId);
      assert.equal(skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(skill.status, SKILL_STATUS_PUBLISHED);
      const version = workspace.loadSkillVersion(first.skillVersionId);
      assert.ok(version.inputs.some((input) => String(input.description ?? "").includes("要不要做")));
      const stepsJson = JSON.stringify(version.steps);
      assert.match(stepsJson, /七项|复述决策目标/);
      assert.match(JSON.stringify(version.outputSchema), /七计比较表|止损条件|孙子原文/);

      const previewHtml = renderDistillPreview(imported.preview);
      assert.match(previewHtml, /data-testid="distill-source-filename">孙子兵法_蒸馏结果\.md</);
      assert.match(previewHtml, /来源定位未确认/);
      assert.match(previewHtml, /data-testid="distill-add-to-chat"/);
      assert.doesNotMatch(previewHtml, /data-paragraph-id="P\d+/);

      const attached = attachDistillationToChat({
        db: workspace.db,
        dataDir,
        distillationId: imported.record.id,
      });
      assert.equal(attached.context.sourceFilename, sourceFilename);
      assert.equal(attached.context.skillId, first.skillId);
      assert.equal(attached.context.skillStatus, SKILL_STATUS_DRAFT);
      assert.equal(attached.skillStatus, SKILL_STATUS_DRAFT);
      const afterAttach = loadSkill(workspace.db, first.skillId);
      assert.equal(afterAttach.status, SKILL_STATUS_DRAFT);
      assert.notEqual(afterAttach.status, SKILL_STATUS_PUBLISHED);

      const chatHtml = renderChatRoute({
        ...emptyChatUiState(),
        loaded: true,
        conversation: attached.conversation,
        distillContext: attached.context,
      });
      assert.match(chatHtml, /data-testid="chat-distill-context"/);
      assert.match(chatHtml, /孙子兵法_蒸馏结果\.md/);
      assert.match(chatHtml, new RegExp(`data-skill-id="${first.skillId}"`));
      assert.match(chatHtml, /data-skill-status="draft"/);
      assert.match(chatHtml, /data-testid="chat-form"/);
      assert.doesNotMatch(chatHtml, /data-testid="nav-distill"/);
    } finally {
      workspace.close();
    }
  });

  it("rejects missing-section, renamed-title, and empty-skills fixtures without writing a Skill", () => {
    const cases = [
      { name: "synthetic-missing-section.md", code: "missing_section" },
      { name: "synthetic-renamed-title.md", code: "renamed_title" },
      { name: "synthetic-empty-skills.md", code: "empty_skills" },
    ] as const;

    for (const item of cases) {
      const dataDir = createDataDir();
      const workspace = openWorkspace(dataDir);
      try {
        const before = countSkillsInWorkspace(workspace.db);
        const markdown = readFixture(item.name);
        const parsed = parseDistillationMarkdown(markdown, { sourceFilename: item.name });
        const validation = validateDistillation(parsed);
        assert.equal(validation.ok, false, item.name);
        assert.ok(validation.errors.some((error) => error.code === item.code || error.code === "section_count"), item.name);

        const imported = importDistillation({
          db: workspace.db,
          dataDir,
          markdown,
          sourceFilename: item.name,
        });
        assert.equal(imported.ok, false, item.name);
        assert.equal(imported.preview, null, item.name);
        const after = countSkillsInWorkspace(workspace.db);
        assert.equal(after.total, before.total, item.name);
        assert.equal(after.published, before.published, item.name);
        assert.equal(after.draft, before.draft, item.name);

        const failedHtml = renderDistillRoute({
          ...emptyDistillUiState(),
          phase: "failed",
          error: imported.ok ? "unexpected success" : imported.errors.map((error) => error.message).join(" "),
        });
        assert.match(failedHtml, /data-testid="distill-error"/);
        assert.doesNotMatch(failedHtml, /data-testid="distill-preview"/);
        assert.doesNotMatch(failedHtml, /data-testid="distill-add-to-chat"/);
      } finally {
        workspace.close();
      }
    }
  });

  it("fails startDistill without a model adapter instead of inventing a 5-segment success", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const result = startDistill({
        db: workspace.db,
        dataDir,
        bookId: "00000000-0000-4000-8000-000000000001",
      });
      assert.ok(!("then" in result) || typeof (result as { then?: unknown }).then !== "function");
      const syncResult = result as Exclude<typeof result, Promise<unknown>>;
      assert.equal(syncResult.status, "failed");
      assert.equal(syncResult.preview, null);
      assert.equal(syncResult.reason, NO_MODEL_ADAPTER_REASON);

      const html = renderDistillRoute({
        ...emptyDistillUiState(),
        phase: "failed",
        bookId: "00000000-0000-4000-8000-000000000001",
        error: syncResult.reason,
      });
      assert.match(html, /data-testid="distill-error"/);
      assert.match(html, /未配置模型适配器/);
      assert.doesNotMatch(html, /data-testid="distill-preview"/);
      assert.doesNotMatch(html, /data-testid="distill-section"/);
    } finally {
      workspace.close();
    }
  });

  it("keeps five nav items, defaults to chat, exposes a library distill entry, and does not value-import the core barrel from renderer/distill", () => {
    assert.equal(NAV_ITEMS.length, 5);
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.id),
      ["chat", "library", "knowledge", "skills", "settings"],
    );

    const listHtml = renderLibraryList({
      books: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          title: "BookSkill Test Primer",
          author: null,
          format: "epub",
          parseStatus: "parsed",
        },
      ],
      error: null,
    });
    assert.match(listHtml, /data-testid="library-distill"/);
    assert.match(listHtml, /data-testid="library-import"/);

    const distillDir = path.join(WORKTREE_ROOT, "packages/desktop/src/renderer/distill");
    for (const file of fs.readdirSync(distillDir)) {
      if (!file.endsWith(".ts")) {
        continue;
      }
      const source = fs.readFileSync(path.join(distillDir, file), "utf8");
      assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*from\s+["']@bookskill\/core["']/);
    }

    const navigation = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/shared/navigation.ts"), "utf8");
    assert.doesNotMatch(navigation, /id: "distill"/);

    const preload = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/preload.cjs"), "utf8");
    assert.match(preload, /startDistill:/);
    assert.match(preload, /importDistillationMarkdown:/);
    assert.match(preload, /loadDistillation:/);
    assert.match(preload, /listDistillations:/);
    assert.match(preload, /attachDistillationToChat:/);
    assert.match(preload, /distill:start/);
    assert.match(preload, /distill:importMarkdown/);
    assert.match(preload, /distill:attachToChat/);

    const main = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/main.ts"), "utf8");
    assert.match(main, /distill:start/);
    assert.match(main, /distill:attachToChat/);
    assert.match(main, /DEFAULT_ROUTE_ID/);
    assert.doesNotMatch(main, /workspace Pin/);
  });
});
