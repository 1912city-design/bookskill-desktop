# SKILL-004 交接报告

- 任务：按冻结契约落地 V1 的九个可编辑 Skill 模板（日常 3、生活 3、专业 3），以及「概念卡」知识卡结构模板。一键实例化只生成 Skill **草稿** 或知识卡 **草稿**，不得自动 published / verified_by_user。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/SKILL-004`
- 基础：开工时工单指定 `origin/integration` @ `5ec45405b2487c1f5e2fa9f35acd0d9ba882f92a`。开工前 `origin/integration` 已前进到 `26ada833b6bb74bc555435ad1385a70a413728ec`（合入 SKILL-001 PR #17 与 SEARCH-002 PR #16）。本分支已先变基到该 tip，并保留工单提交，再叠加实现。
- 工作区：`/workspace/bookskill-worktrees/SKILL-004`
- 完成时间：2026-11-16 22:28 CST（Asia/Shanghai）
- 状态：本地实现与测试已完成。将推送 `feat/SKILL-004` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成或可试用。** 独立 QA 通过前不能把本票当作已完成。
- 风险等级：**中（medium）**。只创建 draft Skill / draft 知识卡；未改 `packages/data` 迁移；未改 `packages/core/src/skills.ts` 的版本写入核心；未自动确认知识卡（D-017）；未自动发布 Skill（D-018）；未写桌面 UI。
- 实现提交：`683e76384c2a92fa3cb7e70a038567754c655c0d`

## 做了什么

新增正式模块 `packages/core/src/skill-templates/`，并经 `packages/core/src/index.ts` **追加**导出。九个 Skill 模板 id 与 SKILL-001 冻结契约完全一致，没有另起一套冲突目录，也没有改这些 id。

| id | 领域 | 名称 |
|---|---|---|
| `daily.daily-plan` | daily（写入 Skill 记录时为「日常」） | 每日计划 |
| `daily.weekly-review` | daily / 日常 | 每周回顾 |
| `daily.reading-review` | daily / 日常 | 阅读复盘 |
| `life.complex-choice` | life / 生活 | 复杂选择梳理 |
| `life.family-planning` | life / 生活 | 家庭事务规划 |
| `life.habit-plan` | life / 生活 | 习惯行动计划 |
| `professional.meeting-prep` | professional / 专业 | 会议准备 |
| `professional.interview-outline` | professional / 专业 | 访谈提纲 |
| `professional.project-retro` | professional / 专业 | 项目复盘 |
| `knowledge.concept-card` | 知识卡模板，不是 Skill | 概念卡 |

每个 Skill 模板都带：name、domain、purpose、when_to_use、when_not_to_use、inputs、steps、rules、output schema、permissions，以及一条成功示例输入和一条边界 / 失败示例（缺必填项或超范围）。文案不声称适用于所有用户或岗位。参考 Templater 只取其「模板生成可编辑结构」；内部格式是 BookSkill Skill / 知识卡，不是外部模板引擎。模板是静态数据，不会执行任意代码。

`listSkillTemplates()` 只返回上述 9 个 Skill 模板摘要（`id`、`domain`、`name`、`purpose`、`whenToUse`、`whenNotToUse`）。`domain` 使用冻结的英文 id（`daily` / `life` / `professional`）。实例化写入 `skills.domain` 时使用中文领域名（日常 / 生活 / 专业），以便与已合入的 SKILL-001 编辑器下拉选项对齐。

### 如何强制 draft（D-018）

`packages/core/src/skills.ts` 的 `createSkill` 在 `options.status === published` 时抛错，但**省略 status 时默认是 `tested`，不是 `draft`**。本票没有改这个默认值，也没有改版本写入核心。`instantiateSkillTemplate({ db, templateId, name? })` 调用 `createSkill` 时**显式传入 `status: SKILL_STATUS_DRAFT`**，创建后再断言 status 为 `draft` 且不等于 `published`。可选的 `name` 只覆盖技能名称，不会改变草稿状态。概念卡模板 id 不能走这条路径。

默认权限为 **无网络、不写文件**（`network: false`，`writeFiles: false`，`modelProvider: "local-stub"`）。`whenToUse` / `whenNotToUse` 不是表列，本票也没有加迁移；它们写在第一版 `permissions_json` 的稳定键里，供 SKILL-001 编辑器读取。

`validateSkillTemplateInput` 对每个模板的成功示例放行，对缺必填或超范围的边界示例标记为不完整并给出错误；校验结果的 `published` 恒为 `false`，这条路径不会发布 Skill。

### 概念卡草稿（D-017）

`instantiateKnowledgeCardTemplate({ db, templateId, title? })` 只接受 `knowledge.concept-card`。它插入一张 `status=draft` 的 `knowledge_cards` 行，字段为标题、定义/内容、适用条件、限制、来源占位。不插入伪造的 `knowledge_sources` 行，不调用 `confirmKnowledgeCard`。确认前状态不是 `verified_by_user`；只有调用既有的 `confirmKnowledgeCard` 后才会变成已确认。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | `listSkillTemplates()` 至少返回上述 9 个 Skill 模板，id 与领域正确 | **通过。** |
| 2 | `instantiateSkillTemplate` 对每个模板生成 draft Skill + 第一版本；status ≠ `published`，且应为 `draft` | **通过。** 9 个 id 均覆盖；可选改名仍保持 draft。 |
| 3 | 每个模板至少 1 条正常测试、1 条边界测试（缺必填或超范围被拒绝或标记为不完整；不得因此发布） | **通过。** 成功示例 `ok/complete`；边界示例失败且 `published === false`。 |
| 4 | `knowledge.concept-card` 生成知识卡草稿，status=`draft`，确认前不是 `verified_by_user` | **通过。** 无来源伪造行；显式确认后才变为 `verified_by_user`。 |
| 5 | 自动化测试失败时非零退出。独立 QA 通过后才能合入 `integration` | **本机自动化通过（失败会非零退出）。** 独立 QA 尚未跑，因此不能宣布本票完成。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/SKILL-004` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**67 passed，0 failed**。时间：2026-11-16 22:28 CST（Asia/Shanghai）。总数包含已在 `integration` 上的 IMPORT / KNOW / REL / SEARCH / VERT 等既有用例，以及本票新增的 24 项 SKILL-004 测试。工单只要求跑 core 测试，本票未改桌面 UI，也没有把 desktop 测试列为交付命令。

样本只用 FIXT-001 许可夹具（例如阅读复盘成功示例中的 *BookSkill Test Primer* 书名）和测试内合成输入。

## 交付物路径

- 实现：`packages/core/src/skill-templates/**`，以及 `packages/core/src/index.ts` 的追加导出
- 测试：`packages/core/test/skill-004.test.ts`
- 报告：`docs/skill/SKILL-004-REPORT.md`
- 工单：`docs/tickets/SKILL-004.md`（开工时已在分支上，未改正文）

公开 API：`listSkillTemplates`、`getSkillTemplate`、`instantiateSkillTemplate`、`validateSkillTemplateInput`、`listKnowledgeCardTemplates`、`instantiateKnowledgeCardTemplate`，以及稳定常量 `SKILL_TEMPLATE_IDS`、`CONCEPT_CARD_TEMPLATE_ID`、`DEFAULT_SKILL_TEMPLATE_PERMISSIONS`。

## 硬性约束确认

- 未改 `packages/data` 迁移、fixtures、治理文件、搜索或关系实现。
- 未写 `packages/desktop/**`（UI 归 SKILL-001）。未覆盖 `docs/skill/SKILL-001-REPORT.md`。
- 未改 `packages/core/src/skills.ts` 的版本写入核心，也未把 `createSkill` 的默认状态改成 `published` 或 `draft`。
- 未自动 `published`，未自动 `verified_by_user`，未执行模板中的任意代码。
- 未改九个稳定 Skill id，也未另写一套冲突的模板目录。
- 未合入 `main` 或 `integration`，未发布，未推进网盘分发，未标 Done。

## 未解决风险与后续

- 已合入的 SKILL-001 编辑器在 `@bookskill/core` 导出 `listSkillTemplates` / `instantiateSkillTemplate` 后会优先调用正式模块。本模块的函数签名与返回值（至少含 `skill.id`）、英文领域摘要、中文 `skills.domain`、以及写在 `permissions_json` 里的 `whenToUse` / `whenNotToUse` 都按该编辑器对齐。合入后应由独立 QA 在桌面编辑器里确认一键套用仍生成 draft。本票没有改桌面文件；概念卡入口仍走 SKILL-001 自己的 `instantiateConceptCard`，尚未切换到 `instantiateKnowledgeCardTemplate`。
- 与 SKILL-001 临时目录的一点有意差异：为满足「缺必填输入」的边界测试，每个 Skill 模板的主输入现为 `required: true`（例如 `date`、`week`、`title`、`decision`）。临时适配器里这些字段曾全部为可选。合入后，从正式模块实例化的草稿会带上必填标记，编辑器应能照常展示。
- `validateSkillTemplateInput` 是本票的模板契约检查，不会调用 Skill 运行时，也不会发布。真正按输入执行 Skill 不属于本票。
- 本机单元测试覆盖 core API，不打开已打包的 Electron 窗口。独立 QA 通过前不得合入 `integration`，也不得宣布本票完成。
- 不要把本 PR 改指向 `main`。不要自行合并，不要发布，不要宣布可试用。

## 风险等级

**中（medium）。** 未新增 schema 迁移或新表，未改 core 版本写入，未改知识卡确认契约，只创建草稿。产品完整性取决于随后的独立 QA，而不是本报告单独宣布。
