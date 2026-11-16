# DISTILL-001 交接报告

- 任务：在已导入书籍上按锁定的 5 段模板落地蒸馏核心流水线：解析 / 校验 Markdown 与 JSON、把通过校验的结果写入 BookSkill 数据目录，并从第 5 段创建可复制的 **draft** Skill。本票不做桌面 UI（归 DISTILL-002）。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/DISTILL-001`
- 基础：先以 `origin/integration` @ `26ada833b6bb74bc555435ad1385a70a413728ec` 开工；开 PR 前已变基到当前 `origin/integration` @ `7c8d9a292d5990ce7e7328c8808e82b6375c0e0f`（已合入 SEARCH-002 / SKILL-001 / REL-002 / SKILL-004）。工单与只读夹具提交保留为 `9536cfa6cceb722115479347daf330a155b0d4e6`。
- 工作区：`/workspace/bookskill-worktrees/DISTILL-001`
- 完成时间：2026-11-16 22:39 CST（Asia/Shanghai）
- 实现提交：`94e10cc2aada4b4c0f61d9f9c5b7910c9ab36d65`
- 状态：本地实现与测试已完成。将推送 `feat/DISTILL-001` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成。** 独立 QA 通过前不能把本票当作已完成。“连续 3 本新书结构完整率 ≥90%”是后续带真实模型适配器的 QA 门，本票只用 3 本定稿 + 结构校验 / 可注入适配器打底。
- 风险等级：**中（medium）**。只创建 draft Skill 与数据目录下的蒸馏文件；未改 `packages/data` 迁移；未重写 `packages/core/src/skills.ts`；创建 Skill 时显式传入 `status: "draft"`（未改 createSkill 省略时默认 `tested` 的行为）；未写 `published`（D-018）；未写 `verified_by_user`（D-017）。未改桌面 UI，未改搜索 / 关系，未改 `packages/core/src/council/**`。

## 做了什么

新增 `packages/core/src/distill/**`，并在 `packages/core/src/index.ts` **追加**导出。模板 id 为 `bookskill.distill.5-segment.v1`。锁定的 5 段标题（不得改名）为：

1. 核心定位
2. 原则与应用
3. 金句
4. 应用框架
5. 可调用Skill

- `parseDistillationMarkdown` / `distillationToMarkdown` / `distillationToJson` / `parseDistillationJson`：把定稿 Markdown 解析为与工单对齐的 JSON 模型，并支持 JSON ↔ Markdown 结构互转。第 5 段按 `### Skill N：名称` 提取 `name` / `triggers` / `steps` / `output`。
- `validateDistillation` / `assertValidDistillation`：缺任一锁定标题、段数不是 5、改标题、或第 5 段没有可用 Skill，返回结构化 `DistillationValidationError`；校验失败时 `importDistillation` 不会写入 Skill。
- `importDistillation`：校验通过后把 `result.json` / `result.md` / `manifest.json` 写到 BookSkill 数据目录的 `distill/<id>/`，并从第 5 段最多创建 3 个 Skill，一律显式 `status: "draft"`。提供 `exportStandaloneSkillMarkdown` / `exportStandaloneSkillJson` 便于单独复制。
- `listDistillations` / `loadDistillation`：列出并读取已导入的蒸馏产物。
- `generateDistillation`：按锁定模板逐段生成，必须注入 `DistillationModelAdapter`；`adapter` 缺失或 `configured !== true` 时抛出 `DistillationAdapterError`（`adapter_unconfigured`），不得假装蒸馏成功。测试注入假适配器，不调用外部模型。
- 引用：每条 citation 带 `source_filename`；只有在已导入书籍上通过现有 `locateHighlight` 确认到段落定位时才写入 `paragraph_id` 并标记 `confirmed: true`。否则标记 `来源定位未确认`，不伪造精确出处。
- `buildDistillationConversationAttachment`：给对话上下文 / 引用结构提供带 `source_filename` 的附件（核心 API 可断言，不需要 Electron 窗口）。

对已导入书籍，复用现有 `importBook` / `locateHighlight`，没有另起一套图书馆。产物只存在数据目录蒸馏文件和现有 `skills` 行，没有新表，也没有把 AnythingLLM 工作区、Pin 或其内部数据库当作业务路径。

未修改：`packages/data` 迁移、`packages/core/src/skills.ts`、桌面 UI、搜索 / 关系实现、`packages/core/src/council/**`、治理文件、FIXT-001 原样本、`/workspace/书籍蒸馏工作台/依据` 与 `交付` 原件、夹具副本字节 / 哈希。未混入 REL-002 PR #18 或 SKILL-004 PR #19 的工作。

## 锁定夹具 SHA-256（与 SHA256SUMS 一致，证明副本未被改动）

- `蒸馏提示词模板.md` `7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2`
- `孙子兵法_蒸馏结果.md` `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- `论语_蒸馏结果.md` `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- `道德经_蒸馏结果.md` `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`

原件路径 `/workspace/书籍蒸馏工作台/依据` 与 `/workspace/书籍蒸馏工作台/交付` 在本票结束后哈希仍然一致，未被修改、覆盖或“整理”。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 3 本定稿副本全部解析为完整 5 段，标题与锁定模板一致，JSON 与 Markdown 可互转；SHA-256 与 SHA256SUMS 一致 | **通过。** 三本均解析出锁定标题；结构往返相等；四份夹具哈希未漂移。 |
| 2 | 缺段、改标题、或 Skill 段为空的输入校验失败；不得写入 Skill | **通过。** 三种失败输入都抛出 `DistillationValidationError`，skills 行数不变。 |
| 3 | 从《孙子兵法》第 5 段至少导入 1 个 draft Skill，`status !== published`，可导出独立 Skill 文本；触发条件 / 步骤 / 输出可读取 | **通过。** 导入含「孙子庙算决策评估」在内的 3 个 Skill，状态均为 `draft`，可导出 Markdown / JSON。 |
| 4 | 导入后的蒸馏结果带 `source_filename`；对话附件或引用结构中能看到源文件名 | **通过。** 孙子结果为 `孙子兵法_原文.md`；`buildDistillationConversationAttachment` 的 citations 带同一文件名。无定位时标记未确认；有已导入书籍且命中段落时才写入确认定位，不伪造。 |
| 5 | 自动化测试失败时非零退出。不得用假成功冒充模型生成。独立 QA 通过后才能合入 `integration` | **本机自动化通过（退出码 0）。** 未配置适配器时生成失败。独立 QA 尚未跑，因此不能宣布本票完成。 |

## 冻结 API（供 DISTILL-002）

- `parseDistillationMarkdown`
- `validateDistillation`
- `importDistillation`
- `listDistillations`
- `loadDistillation`
- `generateDistillation`（可注入适配器；未配置不得成功）
- 另导出 `buildDistillationConversationAttachment`、`exportStandaloneSkillMarkdown`、`exportStandaloneSkillJson`

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/DISTILL-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**82 passed，0 failed**（含本票新增 7 项；既有 IMPORT / KNOW / REL-001 / REL-002 / SEARCH-001 / SEARCH-002 / SKILL-004 / VERT 等继续通过）。时间：2026-11-16 22:39:27–22:39:29 CST（Asia/Shanghai）。完整输出：`docs/distill/pnpm-core-test-output.txt`。
- 本票范围是核心流水线，不做桌面 UI，因此未跑 `pnpm --filter @bookskill/desktop test`。

## 交付物路径

- 实现：`packages/core/src/distill/**`，以及 `packages/core/src/index.ts` 的追加导出
- 测试：`packages/core/test/distill-001.test.ts`
- 只读夹具：`packages/core/test/fixtures/distill/**`（本实现提交未改字节）
- 报告：`docs/distill/DISTILL-001-REPORT.md`
- 日志：`docs/distill/pnpm-core-test-output.txt`

## 残留风险与偏差

- 工单启动底本是 `26ada833`；因 REL-002 与 SKILL-004 已合入，本分支在推送前变基到 `7c8d9a2`，保留工单 / 夹具提交。这是按执行说明处理 integration 移动，不是范围扩大。
- JSON ↔ Markdown 互转保证的是结构等价（5 段标题、正文、Skill 字段、quotes / source），不是与定稿原文字节级一致。渲染出的 Markdown 会简化文首说明，但不改锁定标题与段内正文。
- 无已导入书籍或定位无法确认时，引用只带 `source_filename` 并标记 `来源定位未确认`。这是契约要求，不是缺陷。
- `generateDistillation` 在本票只提供可注入适配器路径；未配置真实模型。“连续 3 本新书结构完整率 ≥90%”留给后续带真实适配器的 QA，本票不用假成功冒充。
- 对话附件目前是核心层结构（`buildDistillationConversationAttachment`），桌面把蒸馏结果挂到对话窗口的工作归 DISTILL-002。
- 未跑桌面测试，因为本票禁止改桌面 UI。

## 硬性约束确认

- 未改 `packages/data` 迁移、桌面 UI、搜索 / 关系、`packages/core/src/skills.ts` 版本写入核心、`packages/core/src/council/**`。
- 未改治理文件、FIXT-001 原样本、夹具哈希，也未修改 `/workspace/书籍蒸馏工作台/依据` 或 `交付`。
- 未把 AnythingLLM 工作区、Pin 或其内部数据库当作业务写入路径。
- 创建 Skill 显式 `status: "draft"`，从未写成 `published`，从未写成 `verified_by_user`。
- 未合入 `main` / `integration`，未发布，未标 Done，未混入 REL-002 或 SKILL-004 的修复。
