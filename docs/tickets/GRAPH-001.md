# GRAPH-001：从蒸馏结果生成知识图谱（核心）（P1）

- ID：GRAPH-001
- 阶段：E
- 目标：用已验收的 3 本定稿蒸馏结果，按锁定 5 段规则抽取节点与边，产出可测试的知识图谱。本票只做核心 API，桌面交互视图归 GRAPH-002。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）
- 依赖：DISTILL-001 已在 `origin/integration`（`5fe203b`，含 VER-001）。使用 DISTILL-001 公开 API，不要重写解析器。
- 状态：Ready
- 风险等级：中（图谱以 JSON 文件或内存对象存在 BookSkill 数据目录，不改 `packages/data` schema；若必须加表则停工并回报，升为高风险）
- 基线：从 `origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577` 拉出 `feat/GRAPH-001`
- 测试样本：`packages/core/test/fixtures/distill/` 中的三本定稿只读副本，不得改哈希，不得改 `/workspace/书籍蒸馏工作台/依据` 与 `交付` 原件。

## 锁定段名与节点类型

段名必须是锁定模板（D-027），不得改用其它标题：

1. 核心定位 → `positioning`
2. 原则与应用 → `principle`
3. 金句 → `quote`
4. 应用框架 → `framework`
5. 可调用Skill → `skill`

## 冻结 API

```ts
export type GraphNodeType =
  | "positioning"
  | "principle"
  | "quote"
  | "framework"
  | "skill";

export interface KnowledgeGraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  book_title?: string;
  source_filename: string;
  source_section: 1 | 2 | 3 | 4 | 5;
  locator?: string;
  locator_confirmed: boolean;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  type: "applies_to" | "supports" | "derived_from" | "cites";
  explanation: string;
  explanation_confirmed: boolean;
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

buildKnowledgeGraph(input: {
  distillations: readonly unknown[];
}): KnowledgeGraph;

loadKnowledgeGraph(input: { dataDir: string }): KnowledgeGraph | null;

saveKnowledgeGraph(input: {
  dataDir: string;
  graph: KnowledgeGraph;
}): void;
```

`buildKnowledgeGraph` 必须是确定性的：同一组已校验蒸馏每次得到同一组节点/边（允许稳定排序）。新增一本已校验蒸馏后再构建，图谱必须包含新书节点。没有定位时 `locator_confirmed` 为 false，并省略或留空 `locator`，不得伪造精确出处。`explanation` 若来自夹具原文须为原文子串，否则 `explanation_confirmed` 为 false 并标明推断。

## 允许修改

- 新建 `packages/core/src/graph/**` 及 `packages/core/test/graph-001.test.ts`
- 经 `packages/core/src/index.ts` **追加**导出（不要改写已有 council / distill / version 导出块）
- 可只读复用已有 `packages/core/test/fixtures/distill/**`。若必须复制，SHA256SUMS 用相对文件名，哈希必须与锁定原件一致

## 禁止修改

- `packages/data` 迁移或新表
- `packages/desktop/**`（归 GRAPH-002）
- `packages/core/src/distill/**`、`packages/core/src/council/**` 的业务逻辑（只可调用公开 API）
- 锁定模板与三本定稿原件、第六个一级导航、`DEFAULT_ROUTE_ID`
- 自动发布 Skill，或把 AnythingLLM 内部库当图存储

## 验收条件（已冻结）

1. 用三本定稿夹具构建图谱，合计节点 ≥30；每个节点有对齐锁定 5 段的 `type`、`label`、`source_filename`、`source_section`。
2. 边可解释：每条边有允许的 `type` 与 `explanation`；未确认的解释必须显式标记，不得把推断写成夹具原文。
3. 再导入一份结构完整的第 4 份 5 段蒸馏（可用测试内合成夹具，不要改三本定稿），重新构建后图谱包含新来源节点。
4. 缺少定位时标记未确认，不得伪造 locator。
5. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。
6. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

## 交付

- 分支 `feat/GRAPH-001`，工作树建议 `/workspace/bookskill-worktrees/GRAPH-001`
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决残差
- 不要自己合并，不要触 `main`
