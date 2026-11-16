import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import {
  DISTILL_TEMPLATE_ID,
  DistillationAdapterError,
  DistillationValidationError,
  LOCKED_SECTION_TITLES,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  UNCONFIRMED_LOCATION_LABEL,
  buildDistillationConversationAttachment,
  distillationToJson,
  distillationToMarkdown,
  generateDistillation,
  importDistillation,
  listDistillations,
  loadDistillation,
  loadSkill,
  loadSkillVersion,
  parseDistillationJson,
  parseDistillationMarkdown,
  exportStandaloneSkillJson,
  exportStandaloneSkillMarkdown,
  validateDistillation,
  type Distillation,
  type DistillationModelAdapter,
} from "../src/index.ts";
import { createTempWorkspace, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];
const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "fixtures/distill");
const FIXTURE_RESULTS = {
  sunzi: path.join(FIXTURE_DIR, "孙子兵法_蒸馏结果.md"),
  lunyu: path.join(FIXTURE_DIR, "论语_蒸馏结果.md"),
  daode: path.join(FIXTURE_DIR, "道德经_蒸馏结果.md"),
} as const;
const TEMPLATE_FIXTURE = path.join(FIXTURE_DIR, "蒸馏提示词模板.md");
const SUMS_FILE = path.join(FIXTURE_DIR, "SHA256SUMS");

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

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function expectedSums(): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of fs.readFileSync(SUMS_FILE, "utf8").split(/\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+(.+)$/i);
    if (!match) continue;
    map.set(path.basename(match[2]), match[1].toLowerCase());
  }
  return map;
}

function structuralSnapshot(distillation: Distillation) {
  return {
    book_id: distillation.book_id,
    title: distillation.title,
    source_filename: distillation.source_filename,
    template_id: distillation.template_id,
    sections: distillation.sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.content,
      quotes: section.quotes,
      source: section.source.map((item) => ({
        source_filename: item.source_filename,
        paragraph_id: item.paragraph_id,
        confirmed: item.confirmed,
        unconfirmedLabel: item.unconfirmedLabel,
        quote: item.quote,
        chapterTitle: item.chapterTitle,
      })),
      skills: section.skills ?? undefined,
    })),
  };
}

describe("DISTILL-001 5-segment distillation pipeline", () => {
  it("keeps locked fixture copy bytes unchanged against SHA256SUMS", () => {
    const expected = expectedSums();
    assert.equal(expected.size, 4);
    const files = [
      "蒸馏提示词模板.md",
      "孙子兵法_蒸馏结果.md",
      "论语_蒸馏结果.md",
      "道德经_蒸馏结果.md",
    ];
    for (const name of files) {
      const digest = sha256File(path.join(FIXTURE_DIR, name));
      assert.equal(digest, expected.get(name), `${name} hash drifted`);
    }
    assert.equal(sha256File(TEMPLATE_FIXTURE), "7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2");
    assert.equal(sha256File(FIXTURE_RESULTS.sunzi), "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290");
    assert.equal(sha256File(FIXTURE_RESULTS.lunyu), "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a");
    assert.equal(sha256File(FIXTURE_RESULTS.daode), "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d");
  });

  it("parses all three accepted fixtures into the locked 5 sections and round-trips JSON/Markdown", () => {
    for (const [key, filePath] of Object.entries(FIXTURE_RESULTS)) {
      const markdown = fs.readFileSync(filePath, "utf8");
      const parsed = parseDistillationMarkdown(markdown);
      const validated = validateDistillation(parsed);
      assert.equal(validated.ok, true, `${key} should validate`);
      assert.equal(parsed.template_id, DISTILL_TEMPLATE_ID);
      assert.equal(parsed.sections.length, 5);
      assert.deepEqual(
        parsed.sections.map((section) => section.title),
        [...LOCKED_SECTION_TITLES],
      );
      assert.ok(parsed.source_filename.endsWith("_原文.md"), `${key} source_filename`);
      assert.ok((parsed.sections[4]?.skills?.length ?? 0) >= 1);

      const asMarkdown = distillationToMarkdown(parsed);
      const fromMarkdown = parseDistillationMarkdown(asMarkdown, {
        book_id: parsed.book_id,
        title: parsed.title,
        source_filename: parsed.source_filename,
      });
      assert.deepEqual(structuralSnapshot(fromMarkdown), structuralSnapshot(parsed));

      const asJson = distillationToJson(parsed);
      const fromJson = parseDistillationJson(asJson);
      assert.deepEqual(structuralSnapshot(fromJson), structuralSnapshot(parsed));
    }

    const sunzi = parseDistillationMarkdown(fs.readFileSync(FIXTURE_RESULTS.sunzi, "utf8"));
    const names = sunzi.sections[4]?.skills?.map((skill) => skill.name) ?? [];
    assert.ok(names.includes("孙子庙算决策评估"));
    assert.ok((sunzi.sections[4]?.skills?.length ?? 0) >= 3);
    const first = sunzi.sections[4]?.skills?.[0];
    assert.ok(first);
    assert.ok(first.triggers[0]);
    assert.ok(first.steps.length >= 1);
    assert.ok(first.output.trim());
  });

  it("fails validation for a missing section, a retitled section, or an empty Skill section, and writes no Skill", () => {
    const workspace = openTemp();
    const original = fs.readFileSync(FIXTURE_RESULTS.sunzi, "utf8");
    const skillCount = () =>
      (workspace.db.prepare("SELECT COUNT(*) AS n FROM skills").get() as { n: number }).n;
    const before = skillCount();

    const missing = original.replace(/## 3\. 金句[\s\S]*?(?=## 4\. 应用框架)/, "");
    const missingResult = validateDistillation(missing);
    assert.equal(missingResult.ok, false);
    assert.ok(missingResult.error.issues.some((issue) => /missing locked section 3|expected 5 locked sections/.test(issue)));
    assert.throws(
      () =>
        importDistillation({
          db: workspace.db,
          dataDir: workspace.dataDir,
          markdown: missing,
        }),
      DistillationValidationError,
    );
    assert.equal(skillCount(), before);

    const retitled = original.replace("## 1. 核心定位", "## 1. 概述");
    const retitledResult = validateDistillation(retitled);
    assert.equal(retitledResult.ok, false);
    assert.ok(retitledResult.error.issues.some((issue) => issue.includes("核心定位") && issue.includes("概述")));
    assert.throws(
      () =>
        importDistillation({
          db: workspace.db,
          dataDir: workspace.dataDir,
          markdown: retitled,
        }),
      DistillationValidationError,
    );
    assert.equal(skillCount(), before);

    const emptySkills = original.replace(/## 5\. 可调用Skill[\s\S]*$/, "## 5. 可调用Skill\n\n（暂无）\n");
    const emptyResult = validateDistillation(emptySkills);
    assert.equal(emptyResult.ok, false);
    assert.ok(emptyResult.error.issues.some((issue) => /empty/i.test(issue) || issue.includes("可调用Skill")));
    assert.throws(
      () =>
        importDistillation({
          db: workspace.db,
          dataDir: workspace.dataDir,
          markdown: emptySkills,
        }),
      DistillationValidationError,
    );
    assert.equal(skillCount(), before);

    workspace.close();
  });

  it("imports 孙子兵法 section 5 as draft Skills with standalone exportable text", () => {
    const workspace = openTemp();
    const markdown = fs.readFileSync(FIXTURE_RESULTS.sunzi, "utf8");
    const result = importDistillation({
      db: workspace.db,
      dataDir: workspace.dataDir,
      markdown,
    });

    assert.equal(result.distillation.template_id, DISTILL_TEMPLATE_ID);
    assert.equal(result.distillation.source_filename, "孙子兵法_原文.md");
    assert.ok(result.skills.length >= 1);
    assert.ok(result.skills.length <= 3);
    assert.ok(result.skills.some((item) => item.skill.name === "孙子庙算决策评估"));

    for (const created of result.skills) {
      assert.equal(created.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);
      const reloaded = loadSkill(workspace.db, created.skill.id);
      assert.equal(reloaded.status, SKILL_STATUS_DRAFT);
      assert.ok(created.extracted.triggers.length > 0);
      assert.ok(created.extracted.steps.length > 0);
      assert.ok(created.extracted.output.trim());
      const standaloneMd = exportStandaloneSkillMarkdown(created.extracted, reloaded.status);
      const standaloneJson = exportStandaloneSkillJson(created.extracted, reloaded.status);
      assert.match(standaloneMd, new RegExp(created.extracted.name));
      assert.match(standaloneMd, /触发条件/);
      assert.match(standaloneMd, /执行步骤/);
      assert.match(standaloneMd, /输出要求/);
      assert.doesNotMatch(standaloneMd, /published/);
      const parsedJson = JSON.parse(standaloneJson) as { name: string; triggers: string[]; steps: string[]; output: string; status: string };
      assert.equal(parsedJson.name, created.extracted.name);
      assert.deepEqual(parsedJson.triggers, created.extracted.triggers);
      assert.deepEqual(parsedJson.steps, created.extracted.steps);
      assert.equal(parsedJson.output, created.extracted.output);
      assert.equal(parsedJson.status, SKILL_STATUS_DRAFT);
      if (created.skill.currentVersionId) {
        const version = loadSkillVersion(workspace.db, created.skill.currentVersionId);
        assert.ok(Array.isArray(version.steps));
      }
    }

    const listed = listDistillations(workspace.dataDir);
    assert.equal(listed.length, 1);
    const loaded = loadDistillation(workspace.dataDir, result.distillation.id);
    assert.equal(loaded.source_filename, "孙子兵法_原文.md");
    assert.equal(loaded.title, "孙子兵法");
    assert.deepEqual(loaded.skill_ids, result.distillation.skill_ids);

    const attachment = result.attachment;
    assert.equal(attachment.kind, "distillation");
    assert.equal(attachment.source_filename, "孙子兵法_原文.md");
    assert.ok(attachment.citations.length > 0);
    assert.ok(attachment.citations.every((citation) => citation.source_filename === "孙子兵法_原文.md"));
    const rebuilt = buildDistillationConversationAttachment(loaded);
    assert.equal(rebuilt.source_filename, "孙子兵法_原文.md");
    assert.ok(rebuilt.citations.some((citation) => citation.source_filename === "孙子兵法_原文.md"));

    const unconfirmed = loaded.sections.flatMap((section) => section.source);
    assert.ok(unconfirmed.every((ref) => ref.source_filename === "孙子兵法_原文.md"));
    assert.ok(unconfirmed.every((ref) => ref.confirmed === false));
    assert.ok(unconfirmed.every((ref) => ref.unconfirmedLabel === UNCONFIRMED_LOCATION_LABEL));
    assert.ok(unconfirmed.every((ref) => ref.paragraph_id == null));

    workspace.close();
  });

  it("attaches a paragraph locator only when an imported book confirms one, and never invents it", () => {
    const workspace = openTemp();
    const quote = "兵者，國之大事，死生之地，存亡之道，不可不察也。";
    const sourcePath = path.join(workspace.dataDir, "孙子兵法_原文.md");
    fs.writeFileSync(
      sourcePath,
      `# 孙子兵法原文\n\n[P1.1] 「${quote}」（始計第一）\n`,
      "utf8",
    );
    const book = workspace.importBook(sourcePath);
    const markdown = fs.readFileSync(FIXTURE_RESULTS.sunzi, "utf8");
    const result = importDistillation({
      db: workspace.db,
      dataDir: workspace.dataDir,
      markdown,
      book,
    });
    const confirmed = result.distillation.sections
      .flatMap((section) => section.source)
      .filter((ref) => ref.confirmed);
    assert.ok(confirmed.length >= 1, "expected at least one confirmed locator from the imported book");
    assert.ok(confirmed.every((ref) => ref.paragraph_id === "P1.1"));
    assert.ok(confirmed.every((ref) => ref.source_filename === "孙子兵法_原文.md"));
    const invented = result.distillation.sections
      .flatMap((section) => section.source)
      .filter((ref) => ref.confirmed && ref.paragraph_id && ref.paragraph_id !== "P1.1");
    assert.equal(invented.length, 0);
    assert.equal(result.attachment.source_filename, "孙子兵法_原文.md");
    workspace.close();
  });

  it("refuses unconfigured model generation and does not fake success", async () => {
    const workspace = openTemp();
    const beforeFiles = fs.existsSync(path.join(workspace.dataDir, "distill"))
      ? fs.readdirSync(path.join(workspace.dataDir, "distill"))
      : [];

    await assert.rejects(
      () =>
        generateDistillation({
          title: "孙子兵法",
          source_filename: "孙子兵法_原文.md",
        }),
      (error: unknown) => {
        assert.ok(error instanceof DistillationAdapterError);
        assert.equal(error.code, "adapter_unconfigured");
        return true;
      },
    );

    await assert.rejects(
      () =>
        generateDistillation({
          title: "孙子兵法",
          source_filename: "孙子兵法_原文.md",
          adapter: {
            configured: false,
            generateSection() {
              throw new Error("should not be called");
            },
          },
        }),
      DistillationAdapterError,
    );

    const afterFiles = fs.existsSync(path.join(workspace.dataDir, "distill"))
      ? fs.readdirSync(path.join(workspace.dataDir, "distill"))
      : [];
    assert.deepEqual(afterFiles, beforeFiles);
    workspace.close();
  });

  it("generates a valid 5-segment result when a configured adapter is injected", async () => {
    const parsed = parseDistillationMarkdown(fs.readFileSync(FIXTURE_RESULTS.lunyu, "utf8"));
    const adapter: DistillationModelAdapter = {
      configured: true,
      generateSection(request) {
        const section = parsed.sections.find((item) => item.id === request.sectionId);
        assert.ok(section);
        return `## ${section.id}. ${section.title}\n\n${section.content}`;
      },
    };
    const generated = await generateDistillation({
      adapter,
      title: parsed.title,
      source_filename: parsed.source_filename,
      book_id: "book-lunyu",
    });
    assert.equal(generated.template_id, DISTILL_TEMPLATE_ID);
    assert.equal(generated.book_id, "book-lunyu");
    assert.deepEqual(
      generated.sections.map((section) => section.title),
      [...LOCKED_SECTION_TITLES],
    );
    assert.ok((generated.sections[4]?.skills?.length ?? 0) >= 1);
    const validated = validateDistillation(generated);
    assert.equal(validated.ok, true);
  });
});
