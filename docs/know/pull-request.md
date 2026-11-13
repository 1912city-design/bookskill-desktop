# PR 草案：KNOW-001 知识卡草稿、确认、编辑、合并、删除

- 分支：`feat/KNOW-001`
- 建议审阅基础 / 目标只能是：**`feat/VERT-001`**（`a83e0a0`，含已合入的 IMPORT-001 与 READ-001）。不要以 `integration` 或 `main` 为目标（该历史含 DATA-001，进 integration 须等 P-002）。
- 类型：**低/中风险（low/medium）**。未改 schema 迁移，未新增表。
- 状态：本地草案，供打开远端 PR 使用。**本执行器未打开 PR，不要由本任务实现者合并或发布。** 由 Orchestrator 安排独立 QA。
- 未合入 `main` / `integration`，未发布，未标 Done，不是 G1 / 发运包，未进入 Phase E/F。

## 改动摘要

在现有 Electron 壳的「知识库」入口接上知识卡工作台：从来源生成的知识卡初始为 `draft`；用户编辑并点「确认」后才变为 `verified_by_user`，来源关系保持不变；支持把来源去重合并到保留卡、以及删除卡片。删除或合并后原书与定位仍在。合并不会把草稿自动确认为正式卡，知识流程也不会自动发布 Skill（D-017 / D-018）。

合并时把被吸收卡的来源迁到保留卡并按 `source_chunk_id` 去重，再删除被吸收卡；因为 `knowledge_relations` 对卡片有外键，且删除卡片会清掉相关关系，本实现不写入会悬空的合并关系。

视觉跟随已锁定的工作台风貌（centred 工作台、candy-on-black、Instrument Sans / DM Mono、soft 圆角），样式只作用在知识库表面，未重写主导航或其他页面，未改阅读器文件，未新增顶级导航，默认路由仍是「问题对话」。未改导入实现、`packages/data/**`、FIXT 样本或治理文件。测试只使用 FIXT-001 许可样本。

## 验收条件逐条结果

1. **通过。** 从来源（FIXT-001 EPUB 的 `P1.3`）生成的知识卡初始状态为 `draft`。
2. **通过。** 编辑不确认时状态仍为 `draft`；用户确认后变为 `verified_by_user`，`sourceChunkId` / `paragraphId` / `relationType` 保持不变。
3. **通过。** 支持合并与删除。删除或合并后 `loadBook` 仍能找到原书与段落定位；合并不会把草稿默认为 `verified_by_user`，也不会留下悬空的合并关系。
4. **通过。** 只有显式的 `confirmKnowledgeCard` 可以把状态写成 `verified_by_user`。编辑、合并、草稿路径都不会自动确认。调用既有 `createRetrospectiveSkill` 后 Skill 状态不是 `published`。UI 没有自动确认或自动发布控件。
5. **通过。** `pnpm --filter @bookskill/core test` 退出码 0（24 passed / 0 failed）；`pnpm --filter @bookskill/desktop test` 退出码 0（28 passed / 0 failed）。断言失败时 `node:test` 以非零退出。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/KNOW-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**24 passed，0 failed**；时间 2026-11-14 01:46:12 CST（Asia/Shanghai）；完整输出 `docs/know/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**28 passed，0 failed**；时间 2026-11-14 01:46:14 CST（Asia/Shanghai）；完整输出 `docs/know/pnpm-desktop-test-output.txt`
- 环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64
- 实现提交：`222a018f23bf0f4b1f330aa855ab177656190442`

## 未解决风险

- 合并不写入 `knowledge_relations` 行，以免删除被吸收卡后外键悬空；合并历史不能从关系表回放。
- 被吸收卡上的 Skill 来源链接按既有删除契约一并去掉，不会自动改挂到保留卡。
- 自动化测试覆盖 API、来源去重、删除后原书核验和 HTML 渲染；未跑完整 Electron 窗口点击，实机点选需独立 QA 确认。
- 知识库声明了 Instrument Sans / DM Mono，但 CSP 不允许外部字体，未安装时会回退系统字体。
- 不要把本 PR 指向 `integration` 或 `main`。向 `integration` 的晋升不在本 PR 范围内。未进入 Phase E/F。

## 风险等级

**低/中（low/medium）。** 未新增 schema 迁移或新表，未改导入或阅读器实现。若后续必须为合并历史加新表，应标为更高风险，并由 Orchestrator 记入待决事项。

## 建议审阅者

独立 QA 按计划复核后，由 Orchestrator 决定是否打开或推进 PR。不要由本任务实现者自行合并，也不要直接合入 `main` 或 `integration`。
