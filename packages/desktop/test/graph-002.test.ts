import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  UNCONFIRMED_LOCATION_LABEL,
  buildKnowledgeGraph,
  knowledgeGraphPath,
  loadKnowledgeGraph,
  openSliceWorkspace,
  parseDistillationMarkdown,
  validateDistillation,
} from "@bookskill/core";
import { importDistillation } from "../src/main/distill-adapter.ts";
import { loadKnowledgeGraphView, locateGraphNode, locateGraphNodeInGraph } from "../src/main/graph.ts";
import {
  GRAPH_UNCONFIRMED_LOCATION_LABEL,
  emptyGraphUiState,
  toKnowledgeGraphView,
} from "../src/renderer/graph/types.ts";
import { renderLibraryGraph } from "../src/renderer/graph/view.ts";
import { renderKnowledgeRoute } from "../src/renderer/knowledge/view.ts";
import { emptyKnowledgeUiState } from "../src/renderer/knowledge/types.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS, ROUTE_IDS } from "../src/shared/navigation.ts";
import { initializeDataDir } from "../src/shared/data-layout.ts";

const leftovers: string[] = [];
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKTREE_ROOT = path.resolve(TEST_DIR, "../../..");
const CORE_FIXTURES_DIR = path.join(WORKTREE_ROOT, "packages/core/test/fixtures/distill");
const DESKTOP_FIXTURES_DIR = path.join(TEST_DIR, "fixtures/distill");

const LOCKED_FILES = {
  "蒸馏提示词模板.md": "7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2",
  "孙子兵法_蒸馏结果.md": "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290",
  "论语_蒸馏结果.md": "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a",
  "道德经_蒸馏结果.md": "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d",
} as const;

const LOCKED_RESULTS = ["孙子兵法_蒸馏结果.md", "论语_蒸馏结果.md", "道德经_蒸馏结果.md"] as const;

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

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-graph-"));
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

function readFixture(name: string, root = CORE_FIXTURES_DIR): string {
  return fs.readFileSync(path.join(root, name), "utf8");
}

function sha256File(root: string, name: string): string {
  return createHash("sha256").update(fs.readFileSync(path.join(root, name))).digest("hex");
}

function valueImportFree(source: string): string {
  return source.replace(/import\s+type\s+[^;]+;/g, "");
}

describe("GRAPH-002 knowledge-library interactive graph", () => {
  it("keeps locked fixture copy bytes and relative SHA256SUMS unchanged", () => {
    for (const root of [CORE_FIXTURES_DIR, DESKTOP_FIXTURES_DIR]) {
      for (const [name, expected] of Object.entries(LOCKED_FILES)) {
        assert.equal(sha256File(root, name), expected, `${root} ${name}`);
      }
      const sums = fs.readFileSync(path.join(root, "SHA256SUMS"), "utf8");
      for (const [name, expected] of Object.entries(LOCKED_FILES)) {
        assert.match(sums, new RegExp(`${expected}\\s+${name}`));
      }
    }
    assert.equal(GRAPH_UNCONFIRMED_LOCATION_LABEL, UNCONFIRMED_LOCATION_LABEL);
    assert.equal(GRAPH_UNCONFIRMED_LOCATION_LABEL, "来源定位未确认");
  });

  it("keeps the default route at chat and does not add a sixth top-level nav item", () => {
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.deepEqual([...ROUTE_IDS], ["chat", "library", "knowledge", "skills", "settings"]);
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.id),
      ["chat", "library", "knowledge", "skills", "settings"],
    );
    assert.equal(NAV_ITEMS.length, 5);
    assert.equal(
      NAV_ITEMS.some((item) => item.label === "知识图谱" || item.title === "知识图谱"),
      false,
    );
    const navigation = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/shared/navigation.ts"), "utf8");
    assert.match(navigation, /export const DEFAULT_ROUTE_ID: RouteId = "chat"/);
    assert.doesNotMatch(navigation, /id: "graph"/);
  });

  it("uses the merged GRAPH-001 core API from a thin desktop wrapper and does not value-import core in renderer graph code", () => {
    const wrapper = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/graph.ts"), "utf8");
    assert.match(wrapper, /from "@bookskill\/core"/);
    assert.match(wrapper, /buildKnowledgeGraph/);
    assert.match(wrapper, /loadKnowledgeGraph/);
    assert.match(wrapper, /saveKnowledgeGraph/);
    assert.doesNotMatch(wrapper, /export function buildKnowledgeGraph/);
    assert.doesNotMatch(wrapper, /export function saveKnowledgeGraph/);

    for (const relative of ["packages/desktop/src/renderer/graph/types.ts", "packages/desktop/src/renderer/graph/view.ts"]) {
      const source = valueImportFree(fs.readFileSync(path.join(WORKTREE_ROOT, relative), "utf8"));
      assert.doesNotMatch(source, /from\s+["']@bookskill\/core["']/);
    }
  });

  it("appends graph IPC and keeps council bridge methods", () => {
    const preload = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/preload.cjs"), "utf8");
    assert.match(preload, /loadKnowledgeGraph:/);
    assert.match(preload, /locateGraphNode:/);
    assert.match(preload, /graph:load/);
    assert.match(preload, /graph:locate/);
    assert.match(preload, /listCouncilSeats:/);
    assert.match(preload, /askCouncilSeat:/);
    assert.match(preload, /runCouncilRoundtable:/);
    assert.match(preload, /enableFixtureCouncilAdapter:/);

    const main = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/main.ts"), "utf8");
    assert.match(main, /graph:load/);
    assert.match(main, /graph:locate/);
    assert.match(main, /council:listSeats/);
    assert.match(main, /DEFAULT_ROUTE_ID/);
  });

  it("builds a visible by-book graph from the three locked distillations and can update after a fourth validated import", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      for (const name of LOCKED_RESULTS) {
        const imported = importDistillation({
          db: workspace.db,
          dataDir,
          markdown: readFixture(name),
          sourceFilename: name,
        });
        assert.equal(imported.ok, true, name);
      }

      const first = loadKnowledgeGraphView(dataDir);
      const filenames = new Set(first.nodes.map((node) => node.source_filename));
      for (const name of LOCKED_RESULTS) {
        assert.ok(filenames.has(name), `missing nodes for ${name}`);
        assert.ok(first.edges.some((edge) => first.nodes.some((node) => node.id === edge.source && node.source_filename === name)));
      }
      assert.ok(first.nodes.length > 0);
      assert.ok(first.edges.length > 0);
      assert.equal(first.groups.length, 3);
      assert.deepEqual(
        first.groups.map((group) => group.source_filename).sort(),
        [...LOCKED_RESULTS].sort(),
      );
      for (const group of first.groups) {
        assert.ok(group.nodeIds.length > 0);
        assert.ok(group.edgeCount > 0);
        assert.ok(group.book_title);
      }

      const saved = loadKnowledgeGraph({ dataDir });
      assert.ok(saved);
      assert.equal(saved.nodes.length, first.nodes.length);
      assert.ok(fs.existsSync(knowledgeGraphPath(dataDir)));

      const html = renderLibraryGraph({
        ...emptyGraphUiState(),
        loaded: true,
        view: first,
      });
      assert.match(html, /data-testid="library-graph"/);
      assert.match(html, /data-testid="library-graph-life"/);
      assert.match(html, /生命图谱（按书聚合）/);
      for (const name of LOCKED_RESULTS) {
        assert.match(html, new RegExp(`data-testid="library-graph-book-group"[^>]*data-source-filename="${name}"`));
      }
      assert.match(html, /data-testid="library-graph-node"/);
      assert.match(html, /data-testid="library-graph-edge"/);
      assert.match(html, /data-testid="library-graph-locate-empty"/);

      const knowledgeHtml = renderKnowledgeRoute(emptyKnowledgeUiState(), {
        ...emptyGraphUiState(),
        loaded: true,
        view: first,
      });
      assert.match(knowledgeHtml, /data-testid="knowledge-surface"/);
      assert.match(knowledgeHtml, /data-testid="library-graph"/);
      assert.match(knowledgeHtml, /data-testid="draft-form"/);

      const fourth = importDistillation({
        db: workspace.db,
        dataDir,
        markdown: FOURTH_BOOK_MARKDOWN,
        sourceFilename: "测试新书_原文.md",
      });
      assert.equal(fourth.ok, true);
      const after = loadKnowledgeGraphView(dataDir);
      assert.ok(after.nodes.length > first.nodes.length);
      assert.ok(after.nodes.some((node) => node.source_filename === "测试新书_原文.md"));
      assert.equal(after.groups.length, 4);
      const afterHtml = renderLibraryGraph({
        ...emptyGraphUiState(),
        loaded: true,
        view: after,
      });
      assert.match(afterHtml, /data-source-filename="测试新书_原文.md"/);
    } finally {
      workspace.close();
    }
  });

  it("locates a fixture substring passage or marks 来源定位未确认, and never invents a locator", () => {
    const sourceFilename = "孙子兵法_蒸馏结果.md";
    const markdown = readFixture(sourceFilename);
    const parsed = parseDistillationMarkdown(markdown, { source_filename: sourceFilename });
    const validation = validateDistillation(parsed);
    assert.equal(validation.ok, true);
    const unconfirmedGraph = buildKnowledgeGraph({ distillations: [parsed] });
    const quoteNode = unconfirmedGraph.nodes.find((node) => node.type === "quote" && markdown.includes(node.label));
    assert.ok(quoteNode);
    const unconfirmedLocate = locateGraphNodeInGraph({
      graph: unconfirmedGraph,
      nodeId: quoteNode.id,
      sources: [{ source_filename: sourceFilename, markdown }],
    });
    assert.equal(unconfirmedLocate.unconfirmed, true);
    assert.equal(unconfirmedLocate.locator_confirmed, false);
    assert.equal(unconfirmedLocate.unconfirmedLabel, "来源定位未确认");
    assert.ok(unconfirmedLocate.passage);
    assert.ok(
      unconfirmedLocate.passage.includes(quoteNode.label),
      "unconfirmed locate should still preview the fixture passage around the node label",
    );

    const unconfirmedHtml = renderLibraryGraph({
      ...emptyGraphUiState(),
      loaded: true,
      view: toKnowledgeGraphView(unconfirmedGraph),
      selectedNodeId: quoteNode.id,
      locate: unconfirmedLocate,
    });
    assert.match(unconfirmedHtml, /data-testid="library-graph-locate"/);
    assert.match(unconfirmedHtml, /data-testid="library-graph-unconfirmed"/);
    assert.match(unconfirmedHtml, /来源定位未确认/);
    assert.match(unconfirmedHtml, /data-testid="library-graph-passage"/);
    assert.doesNotMatch(unconfirmedHtml, /data-testid="library-graph-locate"[^>]*data-confirmed="true"/);

    const quoteSection = parsed.sections.find((section) => section.id === 3);
    const firstQuote = quoteSection?.quotes[0];
    assert.ok(quoteSection && firstQuote);
    assert.ok(markdown.includes("始計第一"));
    quoteSection.source = [
      {
        source_filename: sourceFilename,
        paragraph_id: "始計第一",
        confirmed: true,
        quote: firstQuote.text,
      },
    ];
    const confirmedGraph = buildKnowledgeGraph({ distillations: [parsed] });
    const confirmedNode = confirmedGraph.nodes.find(
      (node) => node.locator_confirmed && node.locator === "始計第一",
    );
    assert.ok(confirmedNode, "expected a node whose locator is a fixture substring");
    const confirmedLocate = locateGraphNodeInGraph({
      graph: confirmedGraph,
      nodeId: confirmedNode.id,
      sources: [{ source_filename: sourceFilename, markdown }],
    });
    assert.equal(confirmedLocate.unconfirmed, false);
    assert.equal(confirmedLocate.locator_confirmed, true);
    assert.equal(confirmedLocate.locator, "始計第一");
    assert.equal(confirmedLocate.unconfirmedLabel, null);
    assert.ok(confirmedLocate.passage);
    assert.ok(confirmedLocate.passage.includes("始計第一"));

    const inventedSection = parsed.sections.find((section) => section.id === 3);
    assert.ok(inventedSection);
    inventedSection.source = [
      {
        source_filename: sourceFilename,
        paragraph_id: "P0.0",
        confirmed: true,
        quote: firstQuote.text,
      },
    ];
    const inventedGraph = buildKnowledgeGraph({ distillations: [parsed] });
    const inventedNode = inventedGraph.nodes.find((node) => node.label.includes(firstQuote.text) || firstQuote.text.includes(node.label));
    assert.ok(inventedNode);
    const inventedLocate = locateGraphNodeInGraph({
      graph: inventedGraph,
      nodeId: inventedNode.id,
      sources: [{ source_filename: sourceFilename, markdown }],
    });
    assert.equal(inventedLocate.unconfirmed, true);
    assert.equal(inventedLocate.locator_confirmed, false);
    assert.notEqual(inventedLocate.locator, "P0.0");
    assert.equal(inventedLocate.unconfirmedLabel, "来源定位未确认");
    assert.ok(!inventedGraph.nodes.some((node) => node.locator === "第1段"));
  });

  it("locates through the data-dir wrapper after importing a locked fixture", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const sourceFilename = "论语_蒸馏结果.md";
      const imported = importDistillation({
        db: workspace.db,
        dataDir,
        markdown: readFixture(sourceFilename),
        sourceFilename,
      });
      assert.equal(imported.ok, true);
      const view = loadKnowledgeGraphView(dataDir);
      const node = view.nodes.find((item) => item.source_filename === sourceFilename);
      assert.ok(node);
      const located = locateGraphNode({ dataDir, nodeId: node.id });
      assert.equal(located.nodeId, node.id);
      assert.equal(located.source_filename, sourceFilename);
      assert.equal(located.unconfirmed, true);
      assert.equal(located.unconfirmedLabel, GRAPH_UNCONFIRMED_LOCATION_LABEL);
    } finally {
      workspace.close();
    }
  });
});
