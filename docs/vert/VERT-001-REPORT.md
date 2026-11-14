# VERT-001 交接报告

- 任务：从书到对话 Skill 的完整薄切片
- 负责人：ai_skill_engineer
- 分支：`feat/VERT-001`
- 工作区：`/workspace/bookskill-worktrees/VERT-001`
- 完成时间：2026-11-13 17:39 Asia/Shanghai
- 状态：本地产物已完成并将在本分支提交；**这不是正式交付，也未宣布 G1 或 G2 已通过**。发布仓库尚未连接，因此没有远端 PR，也没有合入 `main` / `integration`

## 做了什么

新增 `@bookskill/core` 包（`packages/core`），在已验收的 `@bookskill/data`（schema 版本 2）和 `@bookskill/desktop` 壳上实现可自动测试的薄切片：

- 导入项目内许可测试 EPUB 与文本 PDF（`fixtures/bookskill-test-primer.*`，CC0，《BookSkill Test Primer》），抽出章节/段落定位，至少包括 `[P1.3]` 与 `[P2.2]`
- 从 `[P1.3]` 生成知识卡草稿，用户确认后保持来源关系；删除知识卡不会删除原书或原文切片
- 一个可版本化、可运行的 Skill「项目复盘准备」（状态为 `tested`，本切片不会自动发布）
- 确定性本地 stub 适配器完成多轮对话（1 次补问 + 5 轮追问），全程绑定同一 `skill_version_id`；不要求 API Key，不联网调用真实模型
- 有来源的回答展示原书、章节、段落（及 PDF 页码）；使用 P2.2 空洞回声句 “Cedar trees sing at noon in every harbor.” 时明确标注「无来源（空洞回声）」，不得伪装成书中结论
- 保存反馈并生成案例记录（知识卡类型 `案例`）；新 Skill 版本不会覆盖旧 `skill_versions` 行
- 关闭并重新打开业务库/数据目录后，书籍、知识卡、对话、引用与反馈仍在

桌面壳做了有限接线：启动时在 BookSkill 数据目录打开业务库 `{dataDir}/db/bookskill.sqlite`，设置页展示业务库路径、schema 版本和切片计数。没有做成完整阅读器或 Skill Studio，也没有打包/签名。

业务库是 source of truth。AnythingLLM / mintplex 路径会被拒绝，不会在那些位置建库。未读取运行中的 `books-distill-anythingllm` 容器秘钥或用户书籍，仓库与报告中没有密钥。

## 验收条件逐条结果

合同 VERT-001 与 AT-02/AT-03/AT-04 的最小子集：

| # | 条件 | 结果 |
|---|---|---|
| 1 | 导入许可 EPUB 和文本 PDF；能验证章节/段落定位（至少包括 `[P1.3]`、`[P2.2]`） | **通过。** EPUB/PDF 均可定位原则段 `[P1.3]` 与空洞回声段 `[P2.2]`。PDF 还保留页码（`[P1.3]`/`[P2.2]` 在第 1 页，`[P2.5]` 在第 2 页）。高亮 “A knowledge card is valid only” 解析到 `[P1.3]` 而不是相邻的 `[P1.4]`。没有段落定位符的导语显示「来源定位未确认」。 |
| 2 | 从 `[P1.3]` 来源生成知识卡草稿；确认后来源关系保持；删除知识卡不得删除原书 | **通过。** 草稿状态为 `draft`，确认后为 `verified_by_user`，`knowledge_sources` 仍指向同一 `source_chunk_id` / `[P1.3]`。删除另一张卡后，原书与 `[P1.3]`/`[P1.5]` 切片仍在。 |
| 3 | 一个可版本化的可运行 Skill；多轮对话（至少 2 轮，本切片做到 5 轮追问）仍绑定同一 Skill 版本 | **通过。** Skill「项目复盘准备」版本 `1.0.0`。任务「帮我准备一次项目复盘」会推荐该 Skill 并给出理由。缺失 `project_name` 时先补问；随后 5 轮追问的 `skillVersionId` 始终为同一绑定。 |
| 4 | 回答能展示原书来源；没有来源的内容（含使用 P2.2 空洞回声句时）必须明确标注，不得伪装成书中结论 | **通过。** 有来源的主张带《BookSkill Test Primer》、章节与 `[P1.3]`。一般建议标注「模型建议/一般推断」。空洞回声句标注「无来源（空洞回声）」，可指向 `[P2.2]` 作为反例位置，但明确不是书中结论。 |
| 5 | 保存反馈；不得覆盖旧 Skill 版本 | **通过。** 反馈写入 `feedback`，并生成类型为 `案例` 的记录。随后创建 `1.0.1` 草稿版本后，原 `1.0.0` 行的 inputs/steps/rules/版本号与创建时间不变；对话仍绑定旧版本。本切片没有把 Skill 自动改为 `published`。 |
| 6 | 关闭并重新打开业务库/数据目录后，书籍、知识卡、对话、引用与反馈仍在 | **通过。** 关闭 workspace 后再 `openSliceWorkspace()`，两本书、已确认原则卡、6 轮用户消息、evidence_refs、案例卡与反馈评分 5 均仍在。 |

测试离线、可重复，使用本地 stub，不要求 API Key。未自动发布 Skill。未宣布 G1 已通过，也未宣称正式交付。

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/VERT-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。根 `.gitignore` 忽略 `*.log`，故使用 `.txt` 保存证据。

```bash
pnpm --filter @bookskill/core test
```

- 退出码：**0**
- 结果：6 passed，0 failed
- 时间：2026-11-13 17:39:07 CST（Asia/Shanghai）
- 完整输出：`docs/vert/pnpm-core-test-output.txt`

```bash
pnpm --filter @bookskill/desktop test
```

- 退出码：**0**
- 结果：16 passed，0 failed（含原壳测试与新增的切片接线测试）
- 时间：2026-11-13 17:39:07–17:39:10 CST（Asia/Shanghai）
- 完整输出：`docs/vert/pnpm-desktop-test-output.txt`

另外在本机核对（不作为本任务正式验收项，仅确认未破坏已有包）：

- `pnpm --filter @bookskill/data test`：退出码 0，11 passed / 0 failed，2026-11-13 17:39:00 CST
- `pnpm --filter @bookskill/desktop build`：退出码 0，2026-11-13 17:39:01 CST（仅开发构建，不是目标 OS 安装包）

## 交付物路径

- `packages/core/src/` — 导入（PDF/EPUB）、知识卡、可版本化 Skill、离线 stub 对话、引用与反馈
- `packages/core/test/` — 导入定位、知识卡、路径策略、端到端切片（含关闭重开）测试
- `packages/core/package.json` — 包名 `@bookskill/core`，依赖 `@bookskill/data`
- `packages/desktop/src/main/main.ts` 等 — 有限接线：启动打开业务库，设置页展示路径与计数
- `packages/desktop/test/slice-wiring.test.ts` — 壳数据目录与业务库接线测试
- `pnpm-lock.yaml` — 纳入新工作区包（未改根 `package.json` 或 `pnpm-workspace.yaml`）
- `docs/vert/VERT-001-REPORT.md`
- `docs/vert/pull-request.md`
- `docs/vert/pnpm-core-test-output.txt`
- `docs/vert/pnpm-desktop-test-output.txt`

只读使用 `fixtures/**`，未改 FIXT-001 样本内容，未写入无授权整本书。

## 库文件路径策略

业务库仍由 `@bookskill/data` 解析，固定为 `{dataDir}/db/bookskill.sqlite`，当前 schema 版本 **2**。导入的原文件副本写在 `{dataDir}/library/{bookId}/`。可用 `BOOKSKILL_DATA_DIR` 覆盖数据根目录；含 `anythingllm`、`anything-llm` 或 `mintplex` 的路径会被拒绝且不建库。

## Git 提交

实现提交：`bbf74352eb6bdb7952193f0ad079cc92f78590d5`（`feat/VERT-001`；未推送，未开远端 PR，未合入 `main` / `integration`）。本报告对应的文档提交见随后的 docs 提交。

## 未解决风险 / BLOCKED

- **B-001：发布仓库尚未连接（仅阻塞远端步骤）。** 不能开远端 PR、不能跑 GitHub Actions、不能正式发布。本地自动测试已通过，不构成正式交付。
- 根目录 `pnpm test` 仍只指向 `@bookskill/repo-baseline`（本任务不得修改根 `package.json`）。集成方后续可将 `@bookskill/core` 纳入仓库级测试。
- 本切片不是完整阅读器、完整 Skill Studio，也不是打包/签名。桌面壳只做了业务库接线与设置页展示，五个入口仍不是完整产品页。
- **不能宣布 G1 已通过。** 没有 Windows 11 / macOS 13+ 开发构建。Linux 开发构建不能当作 G1 证据。也未宣布 G2 已通过；G2 还需独立验收与合入流程，本分支尚未合入 `integration`。
- 导入器是针对许可测试文本 PDF 与标准 EPUB 的轻量解析器，不是通用商业 PDF/EPUB 引擎。复杂压缩、扫描件或损坏文件属 IMPORT-001 范围。
- 对话使用确定性本地 stub，不代表真实模型质量；后续接入模型时仍须保持来源/无来源标注，且不得把密钥写入仓库或日志。

## 不在本任务范围

- 未推送、未开远端 PR、未合入 `main` 或 `integration`
- 未自动发布 Skill，未宣布 G1/G2 已通过，未宣称正式交付
- 未把 AnythingLLM 内部库当作业务数据源，未读取密钥或用户书籍
- 未修改根 `package.json`、`pnpm-workspace.yaml`、`.github/**`、`.bookskill/**` 或治理文件正文
- 未改 FIXT-001 样本，未写入孙子兵法/道德经/论语等无授权整本书
- 未实现完整阅读器、Skill Studio、备份同步、授权或双平台打包
