# PR 草案：VERT-001 从书到对话 Skill 的完整薄切片

- 分支：`feat/VERT-001` → 目标分支（仓库连接后）：`integration`
- 类型：**中/高风险**（首次端到端业务切片，写入业务库）。按执行合同，CI 与独立 QA 通过后由负责人确认合入；本任务实现者不得自行合并。
- 状态：**仅本地草案。** 发布仓库尚未连接，本文不是已提交的 GitHub Pull Request。不要推送、不要打开远端 PR、不要合入 `main` 或 `integration`。
- 这不是正式交付，也未宣布 G1 或 G2 已通过。

## 改动摘要

新增 `@bookskill/core`：在 BookSkill 自有业务库（`{dataDir}/db/bookskill.sqlite`，schema v2）上实现许可 EPUB/PDF 导入、带来源的知识卡、可版本化 Skill、离线 stub 多轮对话、引用与反馈，以及关闭重开后的数据保持。对 `@bookskill/desktop` 做了有限接线（启动打开业务库，设置页展示路径与计数）。更新了根目录 `pnpm-lock.yaml` 以纳入新工作区包。未改根 `package.json` / `pnpm-workspace.yaml`。

测试使用 `fixtures/bookskill-test-primer.pdf` 与 `.epub`（CC0，《BookSkill Test Primer》）。对话走确定性本地 stub，不要求 API Key，不联网调用真实模型。不会自动发布 Skill。

## 验收条件逐条结果

1. 许可 EPUB 与文本 PDF 可导入，并能定位 `[P1.3]`、`[P2.2]`；PDF 保留页码；相邻段落不会抢占 `[P1.3]` 高亮。
2. 从 `[P1.3]` 生成 `draft` 知识卡，确认后到来源关系保持；删除知识卡不会删除原书。
3. Skill「项目复盘准备」可版本化、可运行；推荐并补问后，5 轮追问仍绑定同一 Skill 版本。
4. 回答展示原书来源；无来源内容标注「模型建议/一般推断」；P2.2 空洞回声句标注「无来源（空洞回声）」，不得伪装成书中结论。
5. 保存反馈并生成案例记录；新建 `1.0.1` 不会覆盖 `1.0.0`。
6. 关闭并重新打开业务库后，书籍、知识卡、对话、引用与反馈仍在。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/VERT-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/core test        # exit 0, 6 passed / 0 failed, 2026-11-13 17:39:07 CST
pnpm --filter @bookskill/desktop test     # exit 0, 16 passed / 0 failed, 2026-11-13 17:39:07–17:39:10 CST
```

完整输出：`docs/vert/pnpm-core-test-output.txt`、`docs/vert/pnpm-desktop-test-output.txt`。Node v24.22.1，pnpm 10.34.6。

实现提交：`bbf74352eb6bdb7952193f0ad079cc92f78590d5`。

## 未解决风险

- 发布仓库未连接（B-001）：无法开远端 PR 或跑 GitHub Actions。
- 根目录 `pnpm test` 尚未包含本包（受任务写权限限制，未改根 `package.json`）。
- 不是完整阅读器 / Skill Studio，也不是目标 OS 构建；不能宣布 G1 已通过，也不是正式交付。
- 轻量 PDF/EPUB 解析器覆盖许可测试样本，不覆盖所有真实书籍格式。

## 建议审阅者

连接远端仓库后，由独立 `qa_security` 复核，再由负责人确认是否合入 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。
