# SKILL-001 交接报告

- 任务：在 BookSkill Desktop 产品路径上落地可用的 Skill 模板选择与编辑器：可从空白或九个冻结模板一键生成 draft Skill，编辑合同 2.6 字段，走用户显式的 draft / tested / published / archived 状态机，并展示当前版本；同时在知识库追加概念卡模板入口，只生成 draft 知识卡。
- 负责人：frontend_engineer（本工作树提交身份沿用仓库已有配置，未另造身份）
- 分支：`feat/SKILL-001`
- 基础：`origin/integration` @ `5ec45405b2487c1f5e2fa9f35acd0d9ba882f92a`（「Merge PATH-001 into integration after independent QA」）
- 工作区：`/workspace/bookskill-worktrees/SKILL-001`
- 完成时间：2026-11-16 22:19 CST（Asia/Shanghai）
- 状态：本地实现与测试已完成。将推送 `feat/SKILL-001` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成或可试用。** 这不是 G1，也不是可发运安装包。独立 QA 通过前不能把本票当作已完成。
- 风险等级：**中（medium）**。使用既有 `skills` / `skill_versions` / `knowledge_cards` 表；未改 `packages/data` 迁移；未重写 `packages/core/src/skills.ts` 的版本写入核心；未自动确认知识卡（D-017）；未自动发布 Skill（D-018）。未开工 VER-002。

## 做了什么

Skills 路由原先仍是通用占位说明。我把它替换成模板选择与编辑器，而不是另做一套模板产品，也没有把工作台改成营销页。

- 新增主进程临时模板适配器 `packages/desktop/src/main/skill-templates.ts`，以及编辑器助手 `packages/desktop/src/main/skills-editor.ts`。九个 Skill 模板 id 与 SKILL-004 冻结契约对齐。未创建 `packages/core/src/skill-templates/`，以免和 SKILL-004 冲突。若 `@bookskill/core` 之后导出 `listSkillTemplates` / `instantiateSkillTemplate`，编辑器会优先调用正式模块。
- 用户可以从空白表单或任一稳定模板一键生成 **draft** Skill。`createSkill` 在本票的每条创建路径都显式传入 `status: "draft"`，因为该 API 若省略状态会默认 `tested`，并在 `published` 时抛错。我没有改这个默认值。
- 编辑器可改合同 2.6 字段：name、domain、purpose、when_to_use、when_not_to_use、inputs、steps、rules、output schema、permissions。
- `when_to_use` / `when_not_to_use` 不是表列，我也没有加迁移。它们写在当前版本的 `permissions_json` 里，稳定键为 `whenToUse` / `whenNotToUse`（读取时也兼容嵌套的 `guidance.whenToUse`）。缺省键按空字符串展示，因此 PATH-001 的本机对话 Skill 和回顾式 Skill 这类旧权限对象仍可打开。默认 `network: false`、`writeFiles: false`。
- 保存走既有 `createSkillVersion`：追加新的 `skill_versions` 行，并把 `current_version_id` 指过去。版本号在当前版本上升补丁（`1.0.0` → `1.0.1`），并避开 `UNIQUE(skill_id, version)`。保存不会改写历史版本行的 JSON，也永远不会把状态写成 `published`。对已发布 Skill 再保存时，`createSkillVersion` 会把状态设回 `draft`，这是预期行为。
- 状态机只接受用户显式操作：
  - `draft → tested`：`action: "mark_tested"`
  - `tested → published`：必须 `{ action: "publish", confirmedByUser: true }`，缺省或假值都拒绝
  - 任意状态（含 published）→ `archived`：`action: "archive"`
  - 拒绝：`draft → published`、`archived → published`、`published → tested`，以及任何非显式或自动发布路径
- 编辑器显示当前 `skill_version_id` 与版本号，并预留「版本列表与回滚即将提供（VER-002）」入口。我没有实现版本列表、回滚，也没有开工 VER-002。
- 概念卡模板 `knowledge.concept-card` 只插入一张 `status=draft` 的 `knowledge_cards` 行（标题、定义/内容、适用条件、限制、来源占位）。不插入伪造的 `knowledge_sources` 行，不调用 `confirmKnowledgeCard`，确认前不会变成 `verified_by_user`。知识库面板追加了「从模板新建草稿」按钮，未改 KNOW-001 的确认 / 合并 / 删除契约。
- 模板是静态数据，不会执行来自 Skill 或书籍内容的任意代码。
- 五个一级导航与默认路由（问题对话）不变。Skills 导航说明只做了轻量补充。
- 新增渲染层 `packages/desktop/src/renderer/skills/**` 只使用本地类型，没有从 `@bookskill/core` 桶做值导入。Node / core 调用留在主进程。

未修改：`docs/PROJECT_STATE.md`、`docs/TASKS.md`、`docs/DECISIONS.md`、`docs/BLOCKERS.md`、`docs/GROK_EXECUTION_SPEC.md`、`docs/tickets/**`、`docs/PENDING_DECISIONS.md`、`packages/data/**` 迁移、`packages/core/src/skills.ts` 版本写入核心、`packages/core/src/knowledge.ts` 确认/合并/删除契约、搜索实现、关系实现、`fixtures/`、taste-skill / 原型。未基于 `feat/PKG-001` 变基，未在 `/workspace/bookskill-desktop` 或其他 worktree 提交。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 用户可从空白或任一稳定模板 id 一键生成 draft Skill；带版本号和可编辑的 2.6 字段；创建时不得写成 published | **通过。** 单测覆盖空白创建和全部 9 个模板 id。 |
| 2 | 可编辑并保存为新版本，不得破坏既有 `skill_versions` 行；状态转换需用户显式操作；非法自动发布必须被拒绝并有测试 | **通过。** 保存后旧行 JSON 不变；显式 `draft→tested`、`tested→published`、归档，以及无确认发布、草稿直接发布、归档后再发布均被拒绝。 |
| 3 | 概念卡模板生成 draft 知识卡，确认前不得变为 `verified_by_user` | **通过。** 只写 `knowledge_cards`，无来源伪造行，状态保持 `draft`。 |
| 4 | 编辑器显示当前版本 id / 版本号，并预留 VER-002 入口 | **通过。** `skill-version`、`skill-version-id` 与 `skill-versions-entry` 均在 HTML 中。 |
| 5 | 自动化测试覆盖创建为 draft、拒绝非法自动发布、状态转换、概念卡不会被自动确认；失败时非零退出。独立 QA 通过后才能合入 `integration` | **本机自动化通过。** 独立 QA 尚未跑，因此我不能宣布本票完成。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/SKILL-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**37 passed，0 failed**。时间：2026-11-16 22:19 CST（Asia/Shanghai）。完整输出：`docs/skill/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**52 passed，0 failed**（含本任务新增 9 项，既有 READ/KNOW/SEARCH/REL/PATH/NAV 等继续通过；含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建）。时间：2026-11-16 22:19 CST（Asia/Shanghai）。完整输出：`docs/skill/pnpm-desktop-test-output.txt`

## 关键 API、通道与 testid

IPC 通道：`skills:listTemplates`、`skills:instantiateTemplate`、`skills:createBlank`、`skills:list`、`skills:load`、`skills:save`、`skills:updateMetadata`、`skills:transitionStatus`、`knowledge:instantiateConceptTemplate`。

桥接键（`window.bookskillDesktop`）：`listSkillTemplates`、`instantiateSkillTemplate`、`createBlankSkill`、`listSkills`、`loadSkill`、`saveSkill`、`updateSkillMetadata`、`transitionSkillStatus`、`instantiateConceptCard`。

Testids：`skills-list`、`skill-item`、`skill-create-blank`、`skill-templates`、`skill-template`、`skill-instantiate`、`skill-editor`、`skill-name`、`skill-domain`、`skill-purpose`、`skill-when-to-use`、`skill-when-not-to-use`、`skill-inputs`、`skill-steps`、`skill-rules`、`skill-output-schema`、`skill-permissions`、`skill-save`、`skill-status`、`skill-mark-tested`、`skill-publish`、`skill-archive`、`skill-version`、`skill-version-id`、`skill-versions-entry`、`skill-error`；知识库追加 `knowledge-concept-template`。

主进程助手：`listSkillTemplates`、`instantiateSkillTemplate`、`createBlankSkill`、`listSkills`、`loadSkillEditorView`、`saveSkill`、`updateSkillMetadata`、`transitionSkillStatus`、`instantiateConceptCard`。归档状态使用桌面侧常量 `"archived"`，没有向 core 的 `constants.ts` 追加导出。

## 交付物路径

- 实现：`packages/desktop/src/main/skill-templates.ts`、`packages/desktop/src/main/skills-editor.ts`、`packages/desktop/src/renderer/skills/**`，以及主进程 / preload / 渲染壳 / 知识库视图 / 导航说明 / 样式的追加接线
- 测试：`packages/desktop/test/skill-001.test.ts`（为满足新的桥接类型，为 `packages/desktop/test/rel-001.test.ts` 的 mock 只补了 stub，未改关系逻辑）
- 报告：`docs/skill/SKILL-001-REPORT.md`、`docs/skill/pull-request.md`
- 日志：`docs/skill/pnpm-core-test-output.txt`、`docs/skill/pnpm-desktop-test-output.txt`

## 硬性约束确认

- 未改 `packages/data` 迁移、fixtures、原型 / taste-skill、治理文件或工单正文。
- 未重写 `packages/core/src/skills.ts` 的 `createSkill` / `createSkillVersion` / `insertVersion`，也未改 `packages/core/src/knowledge.ts` 的确认 / 合并 / 删除契约。
- 未改搜索或关系实现。
- 未开工 VER-002，也未改 VER-001 工作树或文件。
- 创建、模板实例化和保存都不会写成 `published`；发布按钮只在用户显式点击时调用，且要求 `confirmedByUser: true`。
- 概念卡模板不会自动 `verified_by_user`。
- 新增 renderer / skills 代码没有对 `@bookskill/core` 桶做值导入。
- 未合入 `main` 或 `integration`，未发布，未宣布完成、可试用或 G1。

## 未解决风险

- SKILL-004 落地后应替换本票的临时模板适配器；在此之前，标识符已经按冻结契约对齐，但仍是桌面侧静态副本。
- VER-001 将拥有正式的 `listSkills` / `updateSkillMetadata` / `transitionSkillStatus` 以及版本写入路径。本票的桌面侧助手只查询既有表，或更新 `skills` 的 name / domain / purpose / status / updated_at，并通过既有 `createSkillVersion` 追加版本。合入顺序需要避免双实现漂移。
- VER-002 将拥有版本列表与回滚 UI。本票只展示当前版本并预留入口，入口目前不可用。
- 本机单元测试覆盖助手与 HTML，不打开已打包的 Electron 窗口。独立 QA 必须在新的官方未签名 macOS 13+ 构建上重跑相关核心路径后，才能决定是否合入 `integration`，也才能宣布本票完成。
- 不要把本 PR 改指向 `main`。不要自行合并，不要发布，不要宣布可试用。

## 风险等级

**中（medium）。** 未新增 schema 迁移或新表，未改 core 版本写入，未改知识卡确认契约。产品完整性取决于随后的官方构建与独立 QA，而不是本报告单独宣布。
