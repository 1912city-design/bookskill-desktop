# GRAPH-001 交接报告

- 任务：用已验收的 3 本定稿蒸馏结果，按锁定 5 段规则抽取节点与边，产出可测试的知识图谱核心 API。本票只做核心，桌面交互视图归 GRAPH-002。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/GRAPH-001`
- 基础：`origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577`（Merge PR #15 VER-001，2026-11-17 21:18:46 Asia/Shanghai）
- 工作区：`/workspace/bookskill-worktrees/GRAPH-001`
- 完成时间：2026-11-17 21:29 CST（Asia/Shanghai）
- 实现提交：以提交后的 `git rev-parse feat/GRAPH-001` 为准（本文件与实现一并提交）
- 状态：本地实现与测试已完成，将推送 `feat/GRAPH-001` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成，未盖 G1/G2。** 自测不是独立 QA。独立 QA 通过前不得合入。
- 风险等级：**中（medium）**。图谱以 JSON 文件存在 BookSkill 数据目录（`{dataDir}/graph/knowledge-graph.json`），未改 `packages/data` schema，未加表或迁移。

## 做了什么

新增 `packages/core/src/graph/**`，并在 `packages/core/src/index.ts` **追加**导出（baseline `5fe203b` 的 council / distill / 既有导出块一字未改）。冻结 API：

- `buildKnowledgeGraph({ distillations })`
- `loadKnowledgeGraph({ dataDir })`
- `saveKnowledgeGraph({ dataDir, graph })`

节点类型对齐锁定 5 段：

1. 核心定位 → `positioning`
2. 原则与应用 → `principle`
3. 金句 → `quote`
4. 应用框架 → `framework`
5. 可调用Skill → `skill`

构建只调用 DISTILL-001 公开 API（`parseDistillationMarkdown` / `validateDistillation` / `extractQuotes` / `parseSkills`，以及测试中的 `importDistillation` / `listDistillations`）。不进入蒸馏私有实现，不改模板或夹具字节，不改 `packages/core/src/distill/**` 与 `packages/core/src/council/**` 行为。

- 构建是确定性的：同一组已校验蒸馏按 `source_filename` / `title` / `book_id` 稳定排序后抽取，节点与边再稳定排序；输入顺序不影响结果。
- 三本定稿夹具合计 **54 个节点、70 条边**（定位 3、原则 15、金句 24、框架 3、Skill 9），超过验收线 ≥30。62 条边的 `explanation` 是夹具原文子串（`explanation_confirmed: true`）；8 条结构边（如 Skill 应用于框架）没有可复用的原句子串，使用 `模型建议/一般推断：…` 并标记 `explanation_confirmed: false`。
- 缺少精确出处时 `locator_confirmed` 为 false，并省略 `locator`。金句若带夹具中已有的篇名归属（如「始計第一」），写入 `locator` 但仍为未确认，不伪造 `paragraph_id`。只有蒸馏 source ref 已 `confirmed` 且带 `paragraph_id` 时才把 locator 标为已确认。
- 新增第 4 份结构完整的已校验 5 段蒸馏后再构建，图谱包含新来源节点。
- 图谱只写数据目录 JSON，不走 AnythingLLM / Pin / 内部库，不发布 Skill，不写 `verified_by_user`。

## 测试

工作树：`/workspace/bookskill-worktrees/GRAPH-001`

| 命令 | 结果 | 时间（Asia/Shanghai，CST） | 日志 |
|---|---|---|---|
| `pnpm --filter @bookskill/core test` | **108/108 通过**，exit **0** | 2026-11-17 21:29:04–21:29:05 CST | `docs/graph/pnpm-core-test-output.txt` |
| `pnpm --filter @bookskill/desktop test`（含 `tsc -p tsconfig.json --noEmit`） | **66/66 通过**，exit **0** | 2026-11-17 21:29:09–21:29:12 CST | `docs/graph/pnpm-desktop-test-output.txt` |

环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

`packages/core/test/graph-001.test.ts` 覆盖：经 DISTILL-001 公开 API 从 3 本夹具构建、节点 ≥30、5 种节点类型、确定性重建、第 4 份已校验蒸馏加入后更新、缺定位/空核心定位标未确认、不伪造 locator、数据目录 JSON 读写、不改 schema/表、`index.ts` 相对 `5fe203b` 只追加 graph 导出。

夹具 SHA-256（相对文件名，未改字节，与锁定原件一致）：

- `孙子兵法_蒸馏结果.md` `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- `蒸馏提示词模板.md` `7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2`
- `论语_蒸馏结果.md` `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- `道德经_蒸馏结果.md` `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`

## 验收对照

1. 三本定稿合计节点 54 ≥ 30；每个节点有对齐锁定 5 段的 `type`、`label`、`source_filename`、`source_section`。
2. 每条边有允许的 `type`（`applies_to` / `supports` / `derived_from` / `cites`）与 `explanation`；未确认解释显式带 `模型建议/一般推断`，不把推断写成夹具原文。
3. 测试内合成第 4 份完整 5 段蒸馏（未改三本定稿），重新构建后包含 `测试新书_原文.md` 节点。
4. 缺少定位时标记未确认，不得伪造 locator。
5. core / desktop 测试均为 exit 0。
6. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

## 确认未做的事

- 未合入 `integration` 或 `main`；`origin/main` 仍为 `953ba8d6d74fb174e076a208a09b67a70c18b996`。
- 未改锁定原件（`/workspace/书籍蒸馏工作台/依据` 与 `交付`）及 `packages/core/test/fixtures/distill/**` 字节 / SHA256SUMS。
- 未改 `packages/data` schema、迁移或新表。
- 未写桌面 UI（GRAPH-002），未改 `packages/desktop/**`。
- 未改 `packages/core/src/distill/**`、`packages/core/src/council/**`。
- `packages/core/src/index.ts` 仅为追加 graph 导出块。
- 未开工 DISTILL-003 或 SKILL-FUSE-001。

## 未决残差 / 已知缺口

- 本票自测不是独立 QA。产品完整性取决于随后的独立 QA，而不是本 PR 单独宣布。
- 图谱不会在 `importDistillation` 时自动重写；调用方需在新增已校验蒸馏后再次调用 `buildKnowledgeGraph` 并 `saveKnowledgeGraph`。这与冻结的显式 API 一致。
- 默认不生成跨书边；同书边已可解释。桌面可视化、筛选与编辑归 GRAPH-002。
- 夹具经 DISTILL-001 公开解析后没有已确认的 `paragraph_id`（需已导入书籍并由 `enrichDistillationSources` / `locateHighlight` 确认）。因此三本定稿构建出的 locator 全部为未确认；测试另用内存中的已确认 source ref 覆盖确认路径。
- 额外导出了 `GRAPH_DIRNAME`、`GRAPH_FILENAME`、`knowledgeGraphPath` 以及输入/边类型，冻结的三个函数签名与图类型未改。

## 建议审阅者

独立 QA 验证后再决定是否按 D-025 合入 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。不要宣布 Done / G1 / G2。
