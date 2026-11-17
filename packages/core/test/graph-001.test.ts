import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, it } from "node:test";
import { SCHEMA_VERSION_CURRENT } from "@bookskill/data";
import {
  GRAPH_DIRNAME,
  GRAPH_FILENAME,
  LOCKED_SECTION_TITLES,
  UNSOURCED_INFERENCE_LABEL,
  assertValidDistillation,
  buildKnowledgeGraph,
  importDistillation,
  knowledgeGraphPath,
  listDistillations,
  loadKnowledgeGraph,
  parseDistillationMarkdown,
  saveKnowledgeGraph,
  validateDistillation,
  type Distillation,
  type GraphNodeType,
  type KnowledgeGraph,
  type KnowledgeGraphEdge,
  type KnowledgeGraphNode,
} from "../src/index.ts";
import { createTempWorkspace, type TempWorkspace } from "./helpers.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../..");
const FIXTURE_DIR = path.join(TEST_DIR, "fixtures/distill");
const CORE_INDEX = path.join(TEST_DIR, "../src/index.ts");
const GRAPH_SRC_DIR = path.join(TEST_DIR, "../src/graph");
const BASELINE_SHA = "5fe203b0b1c24d64b53415ddf2242297b225e577";

const FIXTURE_FILES = {
  sunzi: path.join(FIXTURE_DIR, "孙子兵法_蒸馏结果.md"),
  lunyu: path.join(FIXTURE_DIR, "论语_蒸馏结果.md"),
  daode: path.join(FIXTURE_DIR, "道德经_蒸馏结果.md"),
} as const;
const TEMPLATE_FIXTURE = path.join(FIXTURE_DIR, "蒸馏提示词模板.md");
const SUMS_FILE = path.join(FIXTURE_DIR, "SHA256SUMS");

const EXPECTED_FIXTURE_HASHES: Record<string, string> = {
  "孙子兵法_蒸馏结果.md": "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290",
  "蒸馏提示词模板.md": "7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2",
  "论语_蒸馏结果.md": "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a",
  "道德经_蒸馏结果.md": "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d",
};

const NODE_TYPES: readonly GraphNodeType[] = ["positioning", "principle", "quote", "framework", "skill"];
const EDGE_TYPES = ["applies_to", "supports", "derived_from", "cites"] as const;
const SECTION_BY_TYPE: Record<GraphNodeType, 1 | 2 | 3 | 4 | 5> = {
  positioning: 1,
  principle: 2,
  quote: 3,
  framework: 4,
  skill: 5,
};

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

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function gitShow(revPath: string): string {
  return execFileSync("git", ["show", revPath], { cwd: REPO_ROOT, encoding: "utf8" });
}

function gitHashObject(filePath: string): string {
  return execFileSync("git", ["hash-object", filePath], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function gitRevParse(revPath: string): string {
  return execFileSync("git", ["rev-parse", revPath], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
}

function fixtureMarkdown(kind: keyof typeof FIXTURE_FILES): string {
  return fs.readFileSync(FIXTURE_FILES[kind], "utf8");
}

function loadAcceptedDistillations(): Distillation[] {
  return (Object.keys(FIXTURE_FILES) as Array<keyof typeof FIXTURE_FILES>).map((kind) => {
    const parsed = parseDistillationMarkdown(fixtureMarkdown(kind));
    return assertValidDistillation(parsed);
  });
}

function listTables(db: { prepare: (sql: string) => { all: () => unknown[] } }): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
    name: string;
  }>;
  return rows.map((row) => row.name);
}

const FOURTH_BOOK_MARKDOWN = `# 《测试新书》蒸馏结果

> 原文依据：\`测试新书_原文.md\`

---

## 1. 核心定位

**核心主张**：先确认事实，再采取最小必要行动。

- 对应金句：「先问事实再行动。」

---

## 2. 原则与应用

### 原则一：先问事实——没有依据不行动

先收集已知信息，再决定是否行动。「先问事实再行动。」

### 原则二：最小行动——只做必要的一步

避免过度干预，只做必要的一步。

---

## 3. 金句

1. 「先问事实再行动。」——第一章
2. 「只做必要的一步。」——第二章

---

## 4. 应用框架

**框架名称：测试三步框架（事实—选择—回顾）**

按步骤检查事实、选择与回顾。引用「先问事实再行动。」

---

## 5. 可调用Skill

### Skill 1：测试事实核对

- **Skill名称**：测试事实核对
- **触发条件**：需要核对一件事是否有依据时
- **执行步骤**：
  1. 列出已知事实
  2. 标出未确认项
- **输出要求**：一份事实与缺口清单

### Skill 2：测试最小行动

- **Skill名称**：测试最小行动
- **触发条件**：准备采取行动时
- **执行步骤**：
  1. 写下最小下一步
- **输出要求**：一个可执行的最小步骤
`;

const EMPTY_POSITIONING_MARKDOWN = `# 《缺定位示例》蒸馏结果

> 原文依据：\`缺定位示例_原文.md\`

---

## 1. 核心定位

---

## 2. 原则与应用

### 原则一：保守判断——先标明未确认

没有精确出处时不得伪造定位。

---

## 3. 金句

1. 「不得伪造精确出处。」——例言

---

## 4. 应用框架

**框架名称：未确认定位检查框架**

检查每一处定位是否有依据。

---

## 5. 可调用Skill

### Skill 1：未确认定位检查

- **Skill名称**：未确认定位检查
- **触发条件**：需要检查出处时
- **执行步骤**：
  1. 列出已有出处
- **输出要求**：标明未确认的定位清单
`;

describe("GRAPH-001 knowledge graph from accepted distillations", () => {
  it("keeps locked fixture copy bytes and relative SHA256SUMS unchanged", () => {
    const sums = fs.readFileSync(SUMS_FILE, "utf8");
    assert.doesNotMatch(sums, /\/workspace\//);
    assert.doesNotMatch(sums, /\/home\//);
    for (const [filename, expected] of Object.entries(EXPECTED_FIXTURE_HASHES)) {
      const filePath = path.join(FIXTURE_DIR, filename);
      assert.equal(sha256File(filePath), expected, filename);
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(sums, new RegExp(`^${expected}  ${escaped}$`, "m"));
    }
    assert.equal(sha256File(TEMPLATE_FIXTURE), EXPECTED_FIXTURE_HASHES["蒸馏提示词模板.md"]);
  });

  it("builds a deterministic graph from the three fixtures via DISTILL-001 public APIs", () => {
    const distillations = loadAcceptedDistillations();
    assert.equal(distillations.length, 3);
    for (const distillation of distillations) {
      const validated = validateDistillation(distillation);
      assert.equal(validated.ok, true);
      assert.deepEqual(
        distillation.sections.map((section) => section.title),
        [...LOCKED_SECTION_TITLES],
      );
    }

    const first = buildKnowledgeGraph({ distillations });
    const second = buildKnowledgeGraph({ distillations: [...distillations].reverse() });
    const third = buildKnowledgeGraph({
      distillations: distillations.map((item) => parseDistillationMarkdown(fixtureMarkdownFor(item))),
    });

    assert.deepEqual(second, first);
    assert.deepEqual(third, first);
    assert.deepEqual(JSON.parse(JSON.stringify(first)), first);

    assert.ok(first.nodes.length >= 30, `expected >= 30 nodes, got ${first.nodes.length}`);
    for (const type of NODE_TYPES) {
      assert.ok(
        first.nodes.some((node) => node.type === type),
        `missing node type ${type}`,
      );
    }

    const books = new Set(first.nodes.map((node) => node.book_title));
    assert.ok(books.has("孙子兵法"));
    assert.ok(books.has("论语"));
    assert.ok(books.has("道德經") || books.has("道德经"));

    for (const node of first.nodes) {
      assertNodeShape(node);
    }
    for (const edge of first.edges) {
      assertEdgeShape(edge, first.nodes);
    }
    assert.ok(first.edges.length > 0, "expected explainable edges");
    assert.ok(first.edges.some((edge) => edge.explanation_confirmed));
    assert.ok(first.edges.some((edge) => !edge.explanation_confirmed));

    const corpus = distillations.map((item) => distillationCorpus(item)).join("\n");
    for (const edge of first.edges) {
      if (edge.explanation_confirmed) {
        assert.ok(
          corpus.includes(edge.explanation),
          `confirmed explanation must be a fixture substring: ${edge.explanation}`,
        );
        assert.ok(!edge.explanation.startsWith(UNSOURCED_INFERENCE_LABEL));
      } else {
        assert.ok(
          edge.explanation.startsWith(`${UNSOURCED_INFERENCE_LABEL}：`) ||
            edge.explanation.startsWith(UNSOURCED_INFERENCE_LABEL),
          `inferred explanation must be marked: ${edge.explanation}`,
        );
        assert.ok(
          !looksLikeForgedOriginal(edge.explanation, corpus),
          `inferred explanation must not be presented as fixture text: ${edge.explanation}`,
        );
      }
    }
  });

  it("updates the graph after a fourth validated 5-segment distillation is added", () => {
    const original = loadAcceptedDistillations();
    const before = buildKnowledgeGraph({ distillations: original });
    const fourth = assertValidDistillation(FOURTH_BOOK_MARKDOWN);
    assert.equal(fourth.title, "测试新书");
    assert.equal(fourth.source_filename, "测试新书_原文.md");

    const after = buildKnowledgeGraph({ distillations: [...original, fourth] });
    const newNodes = after.nodes.filter((node) => node.source_filename === "测试新书_原文.md");
    assert.ok(newNodes.length > 0);
    assert.ok(after.nodes.length > before.nodes.length);
    assert.ok(newNodes.some((node) => node.type === "positioning"));
    assert.ok(newNodes.some((node) => node.type === "principle"));
    assert.ok(newNodes.some((node) => node.type === "quote"));
    assert.ok(newNodes.some((node) => node.type === "framework" && node.label.includes("测试三步框架")));
    assert.ok(newNodes.some((node) => node.type === "skill" && node.label === "测试事实核对"));
    assert.equal(
      before.nodes.filter((node) => node.source_filename !== "测试新书_原文.md").length,
      originalNodesCount(before),
    );
    assert.deepEqual(
      after.nodes.filter((node) => node.source_filename !== "测试新书_原文.md").map(publicNode),
      before.nodes.map(publicNode),
    );
  });

  it("marks missing locators and empty positioning as unconfirmed and never invents a locator", () => {
    const distillations = loadAcceptedDistillations();
    const graph = buildKnowledgeGraph({ distillations });
    const allowed = allowedLocators(distillations);

    for (const node of graph.nodes) {
      if (node.locator) {
        assert.ok(
          allowed.has(node.locator),
          `locator must come from distillation data, not be invented: ${node.id} -> ${node.locator}`,
        );
      }
      if (!node.locator) {
        assert.equal(node.locator_confirmed, false);
      }
    }

    // Fixture parses have no confirmed paragraph locators unless a book match is attached.
    assert.ok(graph.nodes.every((node) => node.locator_confirmed === false));
    const quoteWithAttribution = graph.nodes.find((node) => node.type === "quote" && node.label.includes("兵者，詭道也"));
    assert.ok(quoteWithAttribution);
    assert.equal(quoteWithAttribution.locator, "始計第一");
    assert.equal(quoteWithAttribution.locator_confirmed, false);

    const emptyPositioning = assertValidDistillation(EMPTY_POSITIONING_MARKDOWN);
    const emptyGraph = buildKnowledgeGraph({ distillations: [emptyPositioning] });
    const positioning = emptyGraph.nodes.find((node) => node.type === "positioning");
    assert.ok(positioning);
    assert.equal(positioning.locator_confirmed, false);
    assert.equal(positioning.locator, undefined);
    assert.ok(!positioning.locator);

    const fourth = assertValidDistillation(FOURTH_BOOK_MARKDOWN);
    const confirmed = withConfirmedLocator(fourth, "「先问事实再行动。」", "P1.1");
    const confirmedGraph = buildKnowledgeGraph({ distillations: [confirmed] });
    const confirmedQuote = confirmedGraph.nodes.find((node) => node.label === "「先问事实再行动。」");
    assert.ok(confirmedQuote);
    assert.equal(confirmedQuote.locator, "P1.1");
    assert.equal(confirmedQuote.locator_confirmed, true);
    const unconfirmedQuote = confirmedGraph.nodes.find((node) => node.label === "「只做必要的一步。」");
    assert.ok(unconfirmedQuote);
    assert.equal(unconfirmedQuote.locator_confirmed, false);
    assert.equal(unconfirmedQuote.locator, "第二章");
    assert.ok(confirmedGraph.nodes.every((node) => !node.locator || node.locator === "P1.1" || node.locator === "第一章" || node.locator === "第二章"));
    assert.ok(!confirmedGraph.nodes.some((node) => node.locator === "P0.0" || node.locator === "第1段"));
  });

  it("saves and loads a JSON graph in the BookSkill data directory without schema or table changes", () => {
    const workspace = openTemp();
    const tablesBefore = listTables(workspace.db);
    const schemaBefore = workspace.schemaVersion;
    assert.equal(schemaBefore, SCHEMA_VERSION_CURRENT);

    const graph = buildKnowledgeGraph({ distillations: loadAcceptedDistillations() });
    assert.equal(loadKnowledgeGraph({ dataDir: workspace.dataDir }), null);

    saveKnowledgeGraph({ dataDir: workspace.dataDir, graph });
    const filePath = knowledgeGraphPath(workspace.dataDir);
    assert.equal(filePath, path.join(workspace.dataDir, GRAPH_DIRNAME, GRAPH_FILENAME));
    assert.ok(fs.existsSync(filePath));
    assert.equal(path.dirname(filePath).startsWith(workspace.dataDir), true);

    const loaded = loadKnowledgeGraph({ dataDir: workspace.dataDir });
    assert.ok(loaded);
    assert.deepEqual(loaded, graph);

    assert.equal(workspace.schemaVersion, schemaBefore);
    assert.deepEqual(listTables(workspace.db), tablesBefore);
    assert.ok(!tablesBefore.includes("knowledge_graph"));
    assert.ok(!tablesBefore.includes("graph_nodes"));
    const sqlite = fs.readdirSync(workspace.dataDir, { recursive: true }).map(String);
    assert.ok(sqlite.some((entry) => entry.endsWith(path.join(GRAPH_DIRNAME, GRAPH_FILENAME)) || entry.includes(`${GRAPH_DIRNAME}/`) || entry.includes(`${GRAPH_DIRNAME}\\`)));

    for (const relative of ["packages/data/src/migrations.ts", "packages/data/src/constants.ts"]) {
      assert.equal(gitHashObject(path.join(REPO_ROOT, relative)), gitRevParse(`${BASELINE_SHA}:${relative}`));
    }

    workspace.close();
  });

  it("can build from distillations imported and listed through DISTILL-001 store APIs", () => {
    const workspace = openTemp();
    for (const kind of Object.keys(FIXTURE_FILES) as Array<keyof typeof FIXTURE_FILES>) {
      importDistillation({
        db: workspace.db,
        dataDir: workspace.dataDir,
        markdown: fixtureMarkdown(kind),
      });
    }
    const listed = listDistillations(workspace.dataDir);
    assert.equal(listed.length, 3);
    const graph = buildKnowledgeGraph({ distillations: listed });
    assert.ok(graph.nodes.length >= 30);
    assert.ok(new Set(graph.nodes.map((node) => node.source_filename)).size >= 3);
    workspace.close();
  });

  it("appends graph exports without rewriting the council, distill, or baseline index export blocks", () => {
    const current = fs.readFileSync(CORE_INDEX, "utf8");
    const baseline = gitShow(`${BASELINE_SHA}:packages/core/src/index.ts`);
    assert.ok(current.startsWith(baseline), "packages/core/src/index.ts must keep the baseline export prefix");
    const appended = current.slice(baseline.length);
    assert.match(appended, /from "\.\/graph\/index\.ts";/);
    assert.doesNotMatch(appended, /from "\.\/council\/index\.ts";/);
    assert.doesNotMatch(appended, /from "\.\/distill\/index\.ts";/);
    assert.equal(current.indexOf('from "./graph/index.ts";') > current.indexOf('from "./distill/index.ts";'), true);
    assert.ok(current.includes('export {\n  COUNCIL_SEAT_IDS'));
    assert.ok(current.includes('export {\n  DISTILL_DIRNAME'));
    assert.ok(fs.existsSync(path.join(GRAPH_SRC_DIR, "build.ts")));
    assert.ok(fs.existsSync(path.join(GRAPH_SRC_DIR, "store.ts")));
  });

  it("ignores invalid distillations instead of inventing nodes for them", () => {
    const valid = loadAcceptedDistillations();
    const graph = buildKnowledgeGraph({
      distillations: [valid[0], "not a distillation", null, { title: "incomplete" }, valid[1], valid[2]],
    });
    const expected = buildKnowledgeGraph({ distillations: valid });
    assert.deepEqual(graph, expected);
  });
});

function fixtureMarkdownFor(distillation: Distillation): string {
  if (distillation.title.includes("孙子")) {
    return fixtureMarkdown("sunzi");
  }
  if (distillation.title.includes("论语")) {
    return fixtureMarkdown("lunyu");
  }
  return fixtureMarkdown("daode");
}

function assertNodeShape(node: KnowledgeGraphNode): void {
  assert.ok(typeof node.id === "string" && node.id.length > 0);
  assert.ok((NODE_TYPES as readonly string[]).includes(node.type));
  assert.ok(typeof node.label === "string" && node.label.trim().length > 0);
  assert.ok(typeof node.source_filename === "string" && node.source_filename.trim().length > 0);
  assert.equal(node.source_section, SECTION_BY_TYPE[node.type]);
  assert.equal(typeof node.locator_confirmed, "boolean");
  if (node.locator_confirmed) {
    assert.ok(node.locator && node.locator.trim());
  }
}

function assertEdgeShape(edge: KnowledgeGraphEdge, nodes: readonly KnowledgeGraphNode[]): void {
  const ids = new Set(nodes.map((node) => node.id));
  assert.ok(ids.has(edge.source), `edge source missing: ${edge.source}`);
  assert.ok(ids.has(edge.target), `edge target missing: ${edge.target}`);
  assert.ok((EDGE_TYPES as readonly string[]).includes(edge.type));
  assert.ok(typeof edge.explanation === "string" && edge.explanation.trim().length > 0);
  assert.equal(typeof edge.explanation_confirmed, "boolean");
  assert.notEqual(edge.source, edge.target);
}

function distillationCorpus(distillation: Distillation): string {
  return [
    distillation.title,
    distillation.source_filename,
    ...distillation.sections.map((section) => [section.title, section.content].join("\n")),
  ].join("\n");
}

function looksLikeForgedOriginal(explanation: string, corpus: string): boolean {
  const stripped = explanation.replace(`${UNSOURCED_INFERENCE_LABEL}：`, "").replace(UNSOURCED_INFERENCE_LABEL, "").trim();
  return stripped.length > 0 && corpus.includes(explanation);
}

function allowedLocators(distillations: readonly Distillation[]): Set<string> {
  const allowed = new Set<string>();
  for (const distillation of distillations) {
    for (const section of distillation.sections) {
      for (const source of section.source) {
        if (source.paragraph_id?.trim()) {
          allowed.add(source.paragraph_id.trim());
        }
        if (source.chapterTitle?.trim()) {
          allowed.add(source.chapterTitle.trim());
        }
      }
      for (const quote of section.quotes) {
        if (quote.attribution?.trim()) {
          allowed.add(quote.attribution.trim());
        }
      }
    }
  }
  return allowed;
}

function withConfirmedLocator(distillation: Distillation, quoteText: string, paragraphId: string): Distillation {
  return {
    ...distillation,
    sections: distillation.sections.map((section) => {
      if (Number(section.id) !== 3) {
        return section;
      }
      const sources = section.source.length
        ? section.source.map((source) => {
            if (source.quote !== quoteText) {
              return source;
            }
            return { ...source, paragraph_id: paragraphId, confirmed: true };
          })
        : [
            {
              source_filename: distillation.source_filename,
              paragraph_id: paragraphId,
              confirmed: true,
              quote: quoteText,
            },
          ];
      return { ...section, source: sources };
    }),
  };
}

function originalNodesCount(graph: KnowledgeGraph): number {
  return graph.nodes.length;
}

function publicNode(node: KnowledgeGraphNode): KnowledgeGraphNode {
  return node;
}
