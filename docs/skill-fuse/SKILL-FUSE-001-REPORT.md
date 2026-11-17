# SKILL-FUSE-001 交接报告

- 任务：提供「融合两个 Skill」的核心操作，输出新的 `draft` Skill，且可在对话中绑定调用；对话后手动把新知识点沉淀为草稿作为同票最小 API 一并落地。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/SKILL-FUSE-001`
- 基础：`origin/integration` @ `b6ff0ea0bcc024371341ea782eb06bee93cb9d44`（Merge PR #24 COUNCIL-002，2026-11-17 21:39:53 Asia/Shanghai）。该 tip 是 `4d60314`（GRAPH-001 合入）的快进，仍包含 `4d60314`。未从 `feat/DISTILL-003`、`4d60314` 或 `5fe203b` 单独拉出。
- 工作区：`/workspace/bookskill-worktrees/SKILL-FUSE-001`
- 完成时间：2026-11-17 21:45 CST（Asia/Shanghai）
- 实现提交：`10dc66b9c7f631b1eb6c9c14e07b6c1b0df5c0c9`
- 状态：本地实现与测试已完成，将推送 `feat/SKILL-FUSE-001` 并打开目标仅为 `integration` 的中风险 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成，未盖 G1/G2。** 自测不是独立 QA。独立 QA 通过前不得合入。
- 风险等级：**中（medium）**。融合只追加新 Skill / 新 `skill_versions` 行，不改写旧版本内容；显式调用 `createSkill(..., status: draft)`（D-018）；对话沉淀只写 `draft` 知识卡，不写 `verified_by_user`（D-017）；未改 `packages/data` schema，未加表或迁移。

## 做了什么

新增 `packages/core/src/skill-fuse/**`，并在 `packages/core/src/index.ts` **追加**导出（baseline `b6ff0ea` 上已有的 council（含 COUNCIL-002）、distill、version、graph 等导出块一字未改，只在文件末尾追加 skill-fuse 块）。公开 API：

- `fuseSkills({ db, leftSkillId, rightSkillId, name?, leftVersionId?, rightVersionId?, now? })`
- `depositConversationKnowledgeDraft({ db, conversationId, title, content, turnId?, conditions?, limitations?, now? })`

融合行为：

- 读取两个已有 Skill 的指定版本（默认当前版本），合并名称、领域、用途、输入、步骤、规则、输出模式、权限与知识卡引用。
- 通过现有 `createSkill` 追加一个全新 Skill，并**显式传入 `status: draft`**。`createSkill` 在省略 status 时仍默认为 `tested`，本票未改该契约。
- 旧 Skill 仍在；其 `skills` 行与历史 `skill_versions` / `skill_sources` 行内容不被改写。融合只追加新 Skill 与其第一版 `skill_versions` 行。
- 权限取更严交集（任一侧未开启 `network` / `writeFiles` 则融合结果关闭）。步骤 id 冲突时为右侧步骤加前缀，避免互相覆盖。
- 融合结果不是 `published` 或 `tested`，也不会自动发布。本 API 不接受 status 参数，无法把融合结果写成已发布。

对话绑定与沉淀：

- 新的 draft Skill 可通过既有 `startConversation` / `ask` 绑定到对话上下文；测试覆盖了绑定后提问且状态仍为 `draft`。
- `depositConversationKnowledgeDraft` 是本票一并落地的最小 API：对话结束后由调用方手动把知识点写成 `draft` 知识卡。不写 `verified_by_user`，不插入 `knowledge_sources`（不伪造 locator）。因本票禁止新迁移，对话出处写在 `limitations` 文本中，并带上「来源定位未确认」。

## 测试

工作树：`/workspace/bookskill-worktrees/SKILL-FUSE-001`

| 命令 | 结果 | 时间（Asia/Shanghai，CST） | 日志 |
|---|---|---|---|
| `pnpm --filter @bookskill/core test` | **113/113 通过**，exit **0** | 2026-11-17 21:45:02–21:45:03 CST | `docs/skill-fuse/pnpm-core-test-output.txt` |
| `pnpm --filter @bookskill/desktop test`（含 `tsc -p tsconfig.json --noEmit`） | **74/74 通过**，exit **0** | 2026-11-17 21:45:03–21:45:06 CST | `docs/skill-fuse/pnpm-desktop-test-output.txt` |

环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

`packages/core/test/skill-fuse-001.test.ts` 覆盖：融合两个已有 Skill 得到新 draft；旧 Skill 及其历史行快照不变；新 Skill 可绑定到对话并提问；融合与对话后状态不得变为 `published` / `tested`；`createSkill` 省略 status 仍为 `tested`、传入 `published` 仍被拒绝；对话后手动沉淀为 draft 知识卡，不写 `verified_by_user`，不伪造 locator。

## 验收对照

1. 手动触发两个已有 Skill 的融合，得到新的 `draft` Skill；旧 Skill 仍在，其历史行内容未被改写。**通过。**
2. 新 Skill 可绑定到对话上下文（核心 API 可测）。**通过。** 使用既有 `startConversation`。
3. 未显式由用户发布前，状态不得变为 `published`。**通过。** 融合只写 `draft`。
4. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。**通过。**
5. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。**遵守。** 本报告不宣布完成。

## 确认未做的事

- 未合入 `integration` 或 `main`；`origin/main` 仍为 `953ba8d6d74fb174e076a208a09b67a70c18b996`。
- 未改锁定原件（`/workspace/书籍蒸馏工作台/依据` 与 `交付`）及 `packages/core/test/fixtures/distill/**` 字节 / SHA256SUMS。
- 未改 `packages/data` schema、迁移或新表。
- 未写桌面 UI，未增加第六个一级导航，未改 `packages/desktop/**`。
- 未改 `packages/core/src/graph/**`、`packages/core/src/distill/**`、`packages/core/src/council/**`，未改 DISTILL-003 独有文件（本工作树基于 `b6ff0ea`，本就没有 `multi-source.ts` / `distill-003` 测试与夹具）。未触碰 `feat/DISTILL-003` 或 PR #25。
- `packages/core/src/index.ts` 仅为追加 skill-fuse 导出块，未改写已有 council / distill / version / graph 导出块。
- 未改写已有 `skill_versions` 行内容；未把融合结果写成 `published` 或 `tested`；未写 `verified_by_user`。

## 未决残差 / 已知缺口

- 本票自测不是独立 QA。产品完整性取决于随后的独立 QA，而不是本 PR 单独宣布。
- 对话沉淀已作为最小核心 API 落地，但没有桌面「沉淀」按钮或上传 UI。卡片与对话没有正式外键（禁止新迁移），出处写在 `limitations` 文本里。
- 沉淀得到的 draft 知识卡不会自动挂到融合 Skill 的 `skill_sources`；若要引用，需后续由用户或后续票显式编辑版本。
- 融合不提供桌面选择器或预览 diff；不自动发布；发布仍须走既有 `transitionSkillStatus` 的用户显式操作。
- 未配置跨 Skill 融合审计表。来源 Skill 名称写在新 Skill 的 `purpose` 与规则中。

## 相对工单的偏差

- 工单最初要求从当时的 `origin/integration` 开工，派发时点名 `4d60314`。开工前 `origin/integration` 已快进到 `b6ff0ea`（合入 COUNCIL-002 PR #24），且仍包含 `4d60314`。按后续指令从 `b6ff0ea` 拉出分支，避免开出过期基线的 PR。DISTILL-003 仍未合入，本分支未包含其提交。
