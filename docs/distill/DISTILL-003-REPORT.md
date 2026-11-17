# DISTILL-003 交接报告

- 任务：在书籍流水线之外，先支持导入许可/合成访谈或其它文本，复用锁定 5 段模板，生成完整 5 段蒸馏结果与 **draft** Skill，并让智囊团引用时能看到 `source_filename`。转录集成不在本票。本票以核心 API 为主，不做完整上传 UI。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/DISTILL-003`
- 基础：先从当时的 `origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577` 拉出；GRAPH-001 PR #23 合入后，已变基到当前 `origin/integration` @ `4d60314e9d39c6e7158ab46738c8e071e272c373`（Merge PR #23 GRAPH-001，2026-11-17 21:37:21 Asia/Shanghai，parents `5fe203b` + `a3d5b31`）。未从 `feat/GRAPH-001` 直接拉出。
- 工作区：`/workspace/bookskill-worktrees/DISTILL-003`
- 完成时间：2026-11-17 21:38 CST（Asia/Shanghai）
- 实现提交：`f0cfd4e2b00e821dbb7628d63bcb41b362112ec6`（parent 为 `4d60314`）。若本报告随后另有文档提交，分支 tip 以推送后的 HEAD 为准。
- 状态：已变基到 `4d60314`，本地测试已通过，将推送 `feat/DISTILL-003` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成，未盖 G1/G2。** 自测不是独立 QA。独立 QA 通过前不得合入。
- 风险等级：**中（medium）**。只创建 draft Skill 与数据目录下的蒸馏文件；未改 `packages/data` schema 或迁移；创建 Skill 仍走 DISTILL-001 的 `createDraftSkillsFromDistillation`（显式 `status: "draft"`，未改 createSkill 省略时默认 `tested` 的行为）；未写 `published`（D-018）；未写 `verified_by_user`（D-017）；未自动发布 Skill。

## 做了什么

新增 `packages/core/src/distill/multi-source.ts`，扩展 `packages/core/src/distill/index.ts` 导出，并在 `packages/core/src/index.ts` **追加**导出。变基到 `4d60314` 后：既有 council / distill / GRAPH-001 graph 导出块一字未改；DISTILL-003 导出块接在 graph 块之后。未改 `packages/core/src/graph/**` 行为，不依赖把 GRAPH-001 当成本票实现的一部分来改写。

冻结 / 公开 API：

- `importInterviewOrText({ db, dataDir, source, markdown?, distillation?, adapter?, now? })`
- `citeImportedSourceWithCouncil({ distillation, markdown?, question, adapter? })`

`source.kind` 仅允许 `interview` 或 `text`。导入时必须提供许可或合成的源文本、标题与 `source_filename`。随后复用 DISTILL-001 锁定 5 段流水线：

1. 若提供已写好的 5 段 Markdown / `Distillation`，按锁定模板解析并校验。
2. 否则通过可注入的 `DistillationModelAdapter` 调用既有 `generateDistillation`（`sourceText` 为访谈/文本正文）。适配器缺失或未配置时抛出 `DistillationAdapterError`（`adapter_unconfigured`），不得假装蒸馏成功。
3. 校验通过后调用既有 `importDistillation`，把结果写入数据目录 `distill/<id>/`，并从第 5 段创建 draft Skill。缺段、改标题、或第 5 段空 Skill 时失败且不写 Skill。

锁定模板 id 仍为 `bookskill.distill.5-segment.v1`。锁定 5 段标题未改：

1. 核心定位
2. 原则与应用
3. 金句
4. 应用框架
5. 可调用Skill

智囊团引用：`citeImportedSourceWithCouncil` 只调用 COUNCIL-001 公开 API（`parseCouncilDistillMarkdown`、`createFixtureCouncilAdapter`、`validateCouncilCitations`、`ensureSourceFilenameInContent`），不重写 `packages/core/src/council/**` 业务，不新增第四个固定席位，不改变既有三席检索范围。可见的 `source_filename` 是蒸馏结果上保存的访谈/文本文件名（夹具为 `合成访谈_决策节奏复盘.txt`），会出现在：

- 返回值与 `utterance.source_filename`
- 每条 `citations[].source_filename`
- 答复正文（若适配器未写文件名，则由 `ensureSourceFilenameInContent` 补上「来源：…」）

新增夹具放在 `packages/core/test/fixtures/distill-003/`（自撰合成访谈，标明测试许可），自带相对文件名的 `SHA256SUMS`。**未改** `packages/core/test/fixtures/distill/` 的 Markdown / README 字节或 SHA256SUMS 哈希行，因为 DISTILL-001 仍断言该文件恰好 4 条记录。

未做完整上传 UI，也未增加第六个一级导航。桌面接线留待后续桌面工单。产物只存在数据目录蒸馏文件和既有 `skills` 行，没有新表，也没有把 AnythingLLM / Pin / 内部数据库当作业务路径。未开工 SKILL-FUSE-001 或 GRAPH-002。

## 新增合成夹具 SHA-256（相对文件名，见 `fixtures/distill-003/SHA256SUMS`）

- `合成访谈_决策节奏复盘.txt` `3a6e6142a2810471b22588856f738f96909f5a176b49fb26e9b0ead74e3d1ab6`
- `合成访谈_决策节奏复盘_蒸馏结果.md` `e2098627acf159cde56a1d76b048bac1633932c93828ac45a1b46c6cb9c93f86`

既有锁定夹具 SHA-256（相对文件名，字节与 SHA256SUMS 未改，与锁定原件一致）：

- `孙子兵法_蒸馏结果.md` `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- `蒸馏提示词模板.md` `7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2`
- `论语_蒸馏结果.md` `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- `道德经_蒸馏结果.md` `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`

原件路径 `/workspace/书籍蒸馏工作台/依据` 与 `/workspace/书籍蒸馏工作台/交付` 在本票结束后哈希仍然一致，未被修改、覆盖或“整理”。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 导入一篇许可/合成访谈或文本，能按锁定 5 段校验，并产生 draft Skill（不得自动 published） | **通过。** `importInterviewOrText` 导入合成访谈后模板 id、5 段标题与锁定模板一致；创建的 Skill 状态均为 `draft`，不为 `published`。也可经注入适配器从源文本生成再导入。 |
| 2 | 智囊团引用该结果时能看到 `source_filename` | **通过。** `citeImportedSourceWithCouncil` 的 utterance、citations 与正文均可见 `合成访谈_决策节奏复盘.txt`。编造原文的引用会被 COUNCIL-001 校验拒绝。 |
| 3 | 缺段、改标题、第 5 段空 Skill 时失败且不写 Skill | **通过。** 三种失败输入都抛出 `DistillationValidationError`，skills 行数不变。 |
| 4 | `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0 | **本机自动化通过（退出码 0）。** 见下表。独立 QA 尚未跑，因此不能宣布本票完成。 |
| 5 | 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main` | **遵守。** 本报告只交接实现与自测，不宣布完成。 |

`packages/core/test/distill-003.test.ts` 另覆盖：既有 `fixtures/distill` 哈希未漂移、新夹具相对文件名哈希、未配置适配器不得假装成功、既有 DISTILL-001 书籍夹具仍可导入为 draft Skill。完整套件继续跑通既有 DISTILL-001 / COUNCIL-001 / GRAPH-001 合约。

## 测试命令及本机结果（Asia/Shanghai）

工作树：`/workspace/bookskill-worktrees/DISTILL-003`。下列结果是在变基到 `4d60314` 之后重跑的。

| 命令 | 结果 | 时间（Asia/Shanghai，CST） | 日志 |
|---|---|---|---|
| `pnpm --filter @bookskill/core test` | **117/117 通过**，exit **0** | 2026-11-17 21:38:29–21:38:30 CST | `docs/distill/DISTILL-003-pnpm-core-test-output.txt` |
| `pnpm --filter @bookskill/desktop test`（含 `tsc -p tsconfig.json --noEmit`） | **66/66 通过**，exit **0** | 2026-11-17 21:38:30–21:38:34 CST | `docs/distill/DISTILL-003-pnpm-desktop-test-output.txt` |

环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。本票新增 9 项核心测试；变基后套件包含已合入的 GRAPH-001 测试，故 core 由变基前的 109 增至 117。desktop 数量与 integration 基线一致（未改桌面代码）。

## 交付物路径

- 实现：`packages/core/src/distill/multi-source.ts`，以及 `packages/core/src/distill/index.ts` / `packages/core/src/index.ts` 的追加导出
- 测试：`packages/core/test/distill-003.test.ts`
- 新夹具：`packages/core/test/fixtures/distill-003/**`
- 报告：`docs/distill/DISTILL-003-REPORT.md`

## 确认未做的事

- 未合入 `integration` 或 `main`；未触 `main`。
- 未改锁定原件（`/workspace/书籍蒸馏工作台/依据` 与 `交付`）及 `packages/core/test/fixtures/distill/**` 字节 / SHA256SUMS。
- 未改 `packages/data` schema、迁移或新表。
- 未写完整上传 UI，未增加第六个一级导航，未改 `packages/desktop/**`。
- 未改 `packages/core/src/council/**` 业务，也未改 `packages/core/src/graph/**` 行为。
- `packages/core/src/index.ts` 在 `4d60314` 上保留 GRAPH-001 导出块，仅在其后追加多源导出。
- 未开工 SKILL-FUSE-001 或 GRAPH-002。
- 转录集成不在范围。

## 未决残差 / 已知缺口

- 本票自测不是独立 QA。产品完整性取决于随后的独立 QA，而不是本 PR 单独宣布。
- 未做访谈/文本的桌面上传界面或第六个导航入口；核心 API 已可导入并蒸馏，桌面接线留待后续桌面工单。
- `citeImportedSourceWithCouncil` 是对已导入新源结果的引用接线，不会把访谈注册成第四个固定智囊团席位。既有三席仍只检索各自的书籍蒸馏夹具。
- 未配置模型适配器时，不能只凭源文本假装生成 5 段成功（与 DISTILL-001 相同）。测试使用夹具适配器，不调用外部模型。

## 与工单的偏差及原因

- 新夹具没有写入既有 `packages/core/test/fixtures/distill/SHA256SUMS`，而是放在 `fixtures/distill-003/` 并使用单独的相对文件名 SHA256SUMS。原因：既有 DISTILL-001 测试断言该 SHA256SUMS 恰好 4 条记录，且工单要求不得改锁定模板/三本定稿夹具字节与既有哈希。这不是行为偏差，只是夹具落点选择。
- 未做最小桌面上传接线，因为核心测试与 desktop `tsc --noEmit` 均不需要它。已在本报告标明，留给后续桌面工单。
