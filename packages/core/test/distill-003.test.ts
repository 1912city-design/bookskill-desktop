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
  citeImportedSourceWithCouncil,
  importDistillation,
  importInterviewOrText,
  listDistillations,
  loadCreatedSkill,
  loadDistillation,
  parseDistillationMarkdown,
  validateDistillation,
  type DistillationModelAdapter,
} from "../src/index.ts";
import { createTempWorkspace, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const BOOK_FIXTURE_DIR = path.resolve(TEST_DIR, "fixtures/distill");
const INTERVIEW_FIXTURE_DIR = path.resolve(TEST_DIR, "fixtures/distill-003");
const INTERVIEW_SOURCE_NAME = "合成访谈_决策节奏复盘.txt";
const INTERVIEW_RESULT_NAME = "合成访谈_决策节奏复盘_蒸馏结果.md";
const INTERVIEW_TITLE = "决策节奏复盘";
const INTERVIEW_SOURCE = path.join(INTERVIEW_FIXTURE_DIR, INTERVIEW_SOURCE_NAME);
const INTERVIEW_RESULT = path.join(INTERVIEW_FIXTURE_DIR, INTERVIEW_RESULT_NAME);
const INTERVIEW_SUMS = path.join(INTERVIEW_FIXTURE_DIR, "SHA256SUMS");
const BOOK_SUMS = path.join(BOOK_FIXTURE_DIR, "SHA256SUMS");

const LOCKED_BOOK_HASHES = {
  "孙子兵法_蒸馏结果.md": "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290",
  "蒸馏提示词模板.md": "7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2",
  "论语_蒸馏结果.md": "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a",
  "道德经_蒸馏结果.md": "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d",
} as const;

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

function expectedSums(sumsPath: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const line of fs.readFileSync(sumsPath, "utf8").split(/\n/)) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+(.+)$/i);
    const digest = match?.[1];
    const filename = match?.[2];
    if (!digest || !filename) continue;
    map.set(path.basename(filename), digest.toLowerCase());
  }
  return map;
}

function skillCount(db: ReturnType<typeof openTemp>["db"]): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM skills").get() as { n: number }).n;
}

function interviewSource() {
  return {
    kind: "interview" as const,
    title: INTERVIEW_TITLE,
    source_filename: INTERVIEW_SOURCE_NAME,
    text: fs.readFileSync(INTERVIEW_SOURCE, "utf8"),
  };
}

function fixtureAdapter(): DistillationModelAdapter {
  const parsed = parseDistillationMarkdown(fs.readFileSync(INTERVIEW_RESULT, "utf8"));
  return {
    configured: true,
    generateSection(request) {
      const section = parsed.sections.find((item) => item.id === request.sectionId);
      if (!section) {
        throw new Error(`Missing locked section ${request.sectionId}`);
      }
      return `## ${section.id}. ${section.title}\n\n${section.content}`;
    },
  };
}

describe("DISTILL-003 multi-source distillation (interview/text)", () => {
  it("does not alter locked book fixtures or their SHA256SUMS hashes", () => {
    const expected = expectedSums(BOOK_SUMS);
    assert.equal(expected.size, 4);
    for (const [name, digest] of Object.entries(LOCKED_BOOK_HASHES)) {
      assert.equal(expected.get(name), digest, `${name} SHA256SUMS line drifted`);
      assert.equal(sha256File(path.join(BOOK_FIXTURE_DIR, name)), digest, `${name} bytes drifted`);
    }
  });

  it("keeps the new synthetic interview fixtures hashed with relative filenames", () => {
    const expected = expectedSums(INTERVIEW_SUMS);
    assert.equal(expected.size, 2);
    assert.equal(expected.get(INTERVIEW_SOURCE_NAME), sha256File(INTERVIEW_SOURCE));
    assert.equal(expected.get(INTERVIEW_RESULT_NAME), sha256File(INTERVIEW_RESULT));
    for (const filename of expected.keys()) {
      assert.equal(filename, path.basename(filename));
      assert.doesNotMatch(filename, /^[/\\]/);
    }
    const sourceText = fs.readFileSync(INTERVIEW_SOURCE, "utf8");
    assert.match(sourceText, /合成访谈/);
    assert.match(sourceText, /项目自行编写/);
    assert.match(sourceText, /先把决定写下来，再允许自己改，比先做起来再解释要安全。/);
  });

  it("imports a synthetic interview through the locked 5-segment template and writes only draft Skills", async () => {
    const workspace = openTemp();
    const before = skillCount(workspace.db);
    const result = await importInterviewOrText({
      db: workspace.db,
      dataDir: workspace.dataDir,
      source: interviewSource(),
      markdown: fs.readFileSync(INTERVIEW_RESULT, "utf8"),
    });

    assert.equal(result.source_kind, "interview");
    assert.equal(result.distillation.template_id, DISTILL_TEMPLATE_ID);
    assert.equal(result.distillation.title, INTERVIEW_TITLE);
    assert.equal(result.distillation.source_filename, INTERVIEW_SOURCE_NAME);
    assert.deepEqual(
      result.distillation.sections.map((section) => section.title),
      [...LOCKED_SECTION_TITLES],
    );
    const validated = validateDistillation(result.distillation);
    assert.equal(validated.ok, true);
    assert.ok((result.distillation.sections[4]?.skills?.length ?? 0) >= 1);
    assert.ok(result.skills.length >= 1);
    assert.ok(result.skills.some((item) => item.skill.name === "四面检查决策预审"));
    assert.ok(skillCount(workspace.db) > before);

    for (const created of result.skills) {
      assert.equal(created.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(created.skill.status, SKILL_STATUS_PUBLISHED);
      const reloaded = loadCreatedSkill(workspace.db, created.skill.id);
      assert.equal(reloaded.skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(reloaded.skill.status, SKILL_STATUS_PUBLISHED);
    }

    assert.equal(result.attachment.source_filename, INTERVIEW_SOURCE_NAME);
    assert.ok(result.attachment.citations.every((citation) => citation.source_filename === INTERVIEW_SOURCE_NAME));

    const listed = listDistillations(workspace.dataDir);
    assert.equal(listed.length, 1);
    const loaded = loadDistillation(workspace.dataDir, result.distillation.id);
    assert.equal(loaded.source_filename, INTERVIEW_SOURCE_NAME);
    assert.deepEqual(loaded.skill_ids, result.distillation.skill_ids);
    workspace.close();
  });

  it("generates the locked 5-segment result from interview text when a configured adapter is injected", async () => {
    const workspace = openTemp();
    const result = await importInterviewOrText({
      db: workspace.db,
      dataDir: workspace.dataDir,
      source: interviewSource(),
      adapter: fixtureAdapter(),
    });
    assert.equal(result.distillation.template_id, DISTILL_TEMPLATE_ID);
    assert.equal(result.distillation.source_filename, INTERVIEW_SOURCE_NAME);
    assert.deepEqual(
      result.distillation.sections.map((section) => section.title),
      [...LOCKED_SECTION_TITLES],
    );
    assert.ok(result.skills.every((item) => item.skill.status === SKILL_STATUS_DRAFT));
    workspace.close();
  });

  it("refuses unconfigured generation of an interview source and writes no Skill", async () => {
    const workspace = openTemp();
    const before = skillCount(workspace.db);
    await assert.rejects(
      () =>
        importInterviewOrText({
          db: workspace.db,
          dataDir: workspace.dataDir,
          source: interviewSource(),
        }),
      (error: unknown) => {
        assert.ok(error instanceof DistillationAdapterError);
        assert.equal(error.code, "adapter_unconfigured");
        return true;
      },
    );
    assert.equal(skillCount(workspace.db), before);
    workspace.close();
  });

  it("fails missing, retitled, or empty-Skill interview distillations and writes no Skill", async () => {
    const workspace = openTemp();
    const original = fs.readFileSync(INTERVIEW_RESULT, "utf8");
    const before = skillCount(workspace.db);

    const missing = original.replace(/## 3\. 金句[\s\S]*?(?=## 4\. 应用框架)/, "");
    const missingResult = validateDistillation(missing);
    assert.equal(missingResult.ok, false);
    assert.ok(missingResult.error.issues.some((issue) => /missing locked section 3|expected 5 locked sections/.test(issue)));
    await assert.rejects(
      () =>
        importInterviewOrText({
          db: workspace.db,
          dataDir: workspace.dataDir,
          source: interviewSource(),
          markdown: missing,
        }),
      DistillationValidationError,
    );
    assert.equal(skillCount(workspace.db), before);

    const retitled = original.replace("## 1. 核心定位", "## 1. 概述");
    const retitledResult = validateDistillation(retitled);
    assert.equal(retitledResult.ok, false);
    assert.ok(retitledResult.error.issues.some((issue) => issue.includes("核心定位") && issue.includes("概述")));
    await assert.rejects(
      () =>
        importInterviewOrText({
          db: workspace.db,
          dataDir: workspace.dataDir,
          source: interviewSource(),
          markdown: retitled,
        }),
      DistillationValidationError,
    );
    assert.equal(skillCount(workspace.db), before);

    const emptySkills = original.replace(/## 5\. 可调用Skill[\s\S]*$/, "## 5. 可调用Skill\n\n（暂无）\n");
    const emptyResult = validateDistillation(emptySkills);
    assert.equal(emptyResult.ok, false);
    assert.ok(emptyResult.error.issues.some((issue) => /empty/i.test(issue) || issue.includes("可调用Skill")));
    await assert.rejects(
      () =>
        importInterviewOrText({
          db: workspace.db,
          dataDir: workspace.dataDir,
          source: interviewSource(),
          markdown: emptySkills,
        }),
      DistillationValidationError,
    );
    assert.equal(skillCount(workspace.db), before);
    workspace.close();
  });

  it("lets the council cite the imported interview result with a visible source_filename", async () => {
    const workspace = openTemp();
    const imported = await importInterviewOrText({
      db: workspace.db,
      dataDir: workspace.dataDir,
      source: interviewSource(),
      markdown: fs.readFileSync(INTERVIEW_RESULT, "utf8"),
    });

    const cited = citeImportedSourceWithCouncil({
      distillation: imported.distillation,
      question: "决定太快的时候，应该先问什么？",
    });

    assert.equal(cited.source_filename, INTERVIEW_SOURCE_NAME);
    assert.equal(cited.utterance.source_filename, INTERVIEW_SOURCE_NAME);
    assert.match(cited.content, new RegExp(INTERVIEW_SOURCE_NAME));
    assert.match(cited.utterance.content, new RegExp(INTERVIEW_SOURCE_NAME));
    assert.ok(cited.citations.length >= 1);
    assert.ok(cited.citations.every((item) => item.source_filename === INTERVIEW_SOURCE_NAME));
    assert.ok(cited.utterance.citations.every((item) => item.source_filename === INTERVIEW_SOURCE_NAME));
    const firstQuote = cited.citations[0]?.quote;
    assert.ok(firstQuote);
    assert.ok(fs.readFileSync(INTERVIEW_RESULT, "utf8").includes(firstQuote));
    assert.ok(fs.readFileSync(INTERVIEW_SOURCE, "utf8").includes(firstQuote));
    workspace.close();
  });

  it("rejects a council citation that invents wording not in the interview result", async () => {
    const workspace = openTemp();
    const imported = await importInterviewOrText({
      db: workspace.db,
      dataDir: workspace.dataDir,
      source: interviewSource(),
      markdown: fs.readFileSync(INTERVIEW_RESULT, "utf8"),
    });

    assert.throws(
      () =>
        citeImportedSourceWithCouncil({
          distillation: imported.distillation,
          question: "请引用一句不存在的话",
          adapter: () => ({
            content: "编造一句不存在的原文。",
            citations: [
              {
                quote: "兵贵神速，先下手为强。",
                source_filename: INTERVIEW_SOURCE_NAME,
              },
            ],
          }),
        }),
      /must not invent original text/,
    );
    workspace.close();
  });

  it("still imports an existing DISTILL-001 book fixture as draft Skills", () => {
    const workspace = openTemp();
    const markdown = fs.readFileSync(path.join(BOOK_FIXTURE_DIR, "孙子兵法_蒸馏结果.md"), "utf8");
    const result = importDistillation({
      db: workspace.db,
      dataDir: workspace.dataDir,
      markdown,
    });
    assert.equal(result.distillation.template_id, DISTILL_TEMPLATE_ID);
    assert.equal(result.distillation.source_filename, "孙子兵法_原文.md");
    assert.ok(result.skills.every((item) => item.skill.status === SKILL_STATUS_DRAFT));
    workspace.close();
  });
});
