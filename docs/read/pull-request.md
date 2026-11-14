# PR 草案：READ-001 章节、摘录、批注、来源定位

- 分支：`feat/READ-001`
- 建议审阅基础 / 目标只能是：**`feat/VERT-001`**（`f109cd2`，含已合入的 IMPORT-001）。不要以 `integration` 或 `main` 为目标（该历史含 DATA-001 `af14b5c`，进 integration 须等 P-002）。
- 类型：**低/中风险（low/medium）**。未改 schema 迁移；批注写入 BookSkill 数据目录中的 JSON 文件。
- 状态：本地草案，供打开远端 PR 使用。**本执行器未打开 PR，不要由本任务实现者合并或发布。** 由 Orchestrator 安排独立 QA。
- 未合入 `main` / `integration`，未发布，不是 G1 / 发运包。

## 改动摘要

在现有 Electron 壳的「书库」入口接上阅读器：已导入的许可 EPUB 与文本 PDF 可浏览章节 / 页码 / 段落定位；用户可从选区生成摘录并跳回原书位置；无法精确定位的来源使用合同文案「来源定位未确认」，不会被伪称为已精确定位；批注保存在 `{dataDir}/library/{bookId}/annotations.json`，用指向同一数据目录的新实例即可读回。

视觉跟随已锁定的工作台风貌（centred 工作台、candy-on-black、Instrument Sans / DM Mono、soft 圆角），样式只作用在书库 / 阅读器表面，未重写主导航或其他页面，未新增顶级导航，默认路由仍是「问题对话」。只读调用既有 `@bookskill/core` 导入 API（`importBook` / `loadBook` / `locateHighlight` 等），未改导入实现、知识卡、`packages/data/**`、FIXT 样本或治理文件。未开工 KNOW-001。测试只使用 FIXT-001 许可样本。

## 验收条件逐条结果

1. **通过。** 已导入的许可 EPUB 展示章节与段落定位（Chapter 1 / 2，`P1.3` / `P2.2`）；许可文本 PDF 展示页码与段落定位（「第 1 页」「第 2 页」，`P1.3` / `P2.5`）。
2. **通过。** 从选区生成摘录后可跳回原书对应切片（原则句定位到 `P1.3`，渲染焦点 `data-focused="true"`）。
3. **通过。** 无法匹配或匹配到未确认来源时，显示「来源定位未确认」，不展示伪精确的段落 / 页码，跳回也不会当作精确定位。使用 `UNCONFIRMED_LOCATION_LABEL` 并遵守 `SourceLocation.confirmed`。
4. **通过。** 批注写入 BookSkill 数据目录 `{dataDir}/library/{bookId}/annotations.json`；关闭后以新 store 实例读回仍然存在。路径不含 AnythingLLM / mintplex。
5. **通过。** `pnpm --filter @bookskill/desktop test` 退出码 0（22 passed / 0 failed）；`pnpm --filter @bookskill/core test` 退出码 0（15 passed / 0 failed）。断言失败时 `node:test` 以非零退出。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/READ-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/desktop test
pnpm --filter @bookskill/core test
```

- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**22 passed，0 failed**；时间 2026-11-14 01:33:22 CST（Asia/Shanghai）；完整输出 `docs/read/pnpm-desktop-test-output.txt`
- `pnpm --filter @bookskill/core test`：退出码 **0**；**15 passed，0 failed**；时间 2026-11-14 01:33:31 CST（Asia/Shanghai）；完整输出 `docs/read/pnpm-core-test-output.txt`
- 环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64
- 实现提交：`8d8ae037d6645016588ca65ec418f5dae57b34e5`

## 未解决风险

- 批注是数据目录内的 JSON，不是 SQLite 行；并发写入可能互相覆盖，写到一半崩溃时下次加载可能读不到该文件。
- 书库列表是对已打开业务库 `books` 表的只读查询（core 无 `listBooks`）。
- 自动化测试覆盖定位、摘录跳回、未确认状态和持久化，以及 HTML 渲染；未跑完整 Electron 窗口点击，实机点选需独立 QA 确认。
- 阅读器声明了 Instrument Sans / DM Mono，但 CSP 不允许外部字体，未安装时会回退系统字体。
- 不要把本 PR 指向 `integration` 或 `main`。向 `integration` 的晋升不在本 PR 范围内。

## 风险等级

**低/中（low/medium）。** 未新增 schema 迁移，未改导入或知识卡实现。若后续必须把批注迁入数据库，应标为更高风险，并由 Orchestrator 记入待决事项。

## 建议审阅者

独立 QA 按计划复核后，由 Orchestrator 决定是否打开或推进 PR。不要由本任务实现者自行合并，也不要直接合入 `main` 或 `integration`。
