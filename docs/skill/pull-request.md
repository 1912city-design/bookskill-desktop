# PR：SKILL-001 模板选择与 Skill 编辑器

- 分支：`feat/SKILL-001`
- 基础 / 目标只能是：**`integration`**（`5ec45405b2487c1f5e2fa9f35acd0d9ba882f92a`，已含 PATH-001）。不要改指向 `main`。
- 类型：**中风险（medium）**。在既有 `skills` / `skill_versions` 表上追加桌面编辑器与 IPC；未改 schema 迁移，未重写 core 版本写入，未自动确认知识卡，未自动发布 Skill。
- 状态：实现与本机测试已完成，用于打开远端 PR。**不要由本任务实现者合并或发布。** 由独立 QA 验证通过后才能合入 `integration`。
- 未合入 `main` / `integration`，未发布，未标 Done，不是 G1 / 可试用 / 发运包。未开工 VER-002。

## 改动摘要

我把 Skills 路由的占位说明替换成可用的模板选择与编辑器。用户可以从空白表单或九个冻结模板（`daily.daily-plan`、`daily.weekly-review`、`daily.reading-review`、`life.complex-choice`、`life.family-planning`、`life.habit-plan`、`professional.meeting-prep`、`professional.interview-outline`、`professional.project-retro`）一键生成 **draft** Skill，并编辑合同 2.6 字段。

创建与模板实例化都显式传入 `status: "draft"`，因为 `createSkill` 若省略状态会默认 `tested`。保存通过既有 `createSkillVersion` 追加新版本行，不改写历史版本 JSON，也不会写成 `published`。`when_to_use` / `when_not_to_use` 存在当前版本的 `permissions_json`（`whenToUse` / `whenNotToUse`），没有加迁移。

状态转换全部是用户显式操作：`draft → tested`、`tested → published`（必须 `{ action: "publish", confirmedByUser: true }`）、任意状态 → `archived`。缺省发布、草稿直接发布、已归档再发布、`published → tested` 都会被拒绝。编辑器显示当前版本号和版本 id，并预留 VER-002 的版本列表 / 回滚入口，但没有实现回滚。

概念卡模板 `knowledge.concept-card` 在知识库面板追加「从模板新建草稿」，只生成 `draft` 知识卡，不伪造来源行，也不调用确认接口。KNOW-001 的确认 / 合并 / 删除行为未改。

模板适配器暂时放在桌面主进程，标识符与 SKILL-004 对齐，没有抢写 `packages/core/src/skill-templates/`。新增渲染层代码不从 `@bookskill/core` 桶做值导入。五个一级导航与默认路由不变。

## 验收条件逐条结果

1. **通过。** 空白创建和 9 个稳定模板 id 都生成 `draft` Skill，带版本号和可编辑的 2.6 字段；创建路径拒绝 `published`。
2. **通过。** 保存追加新的 `skill_versions` 行，旧行 JSON 不变。显式 `draft→tested`、`tested→published` 和归档可用；无确认发布、草稿直接发布、归档后再发布均被拒绝。
3. **通过。** 概念卡模板生成 `draft`，不是 `verified_by_user`，也没有伪造 `knowledge_sources`。
4. **通过。** 编辑器 HTML 含创建 / 模板控件、字段 testid、当前版本展示，以及「版本列表与回滚即将提供（VER-002）」预留入口。
5. **本机自动化通过。** `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test` 退出码均为 0。独立 QA 通过前不能合入 `integration`，也不能宣布完成。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/SKILL-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**37 passed，0 failed**；时间 2026-11-16 22:19 CST（Asia/Shanghai）；完整输出 `docs/skill/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**52 passed，0 failed**（含新增 9 项，既有 READ/KNOW/SEARCH/REL/PATH/NAV 继续通过，含 `tsc --noEmit`）；时间 2026-11-16 22:19 CST（Asia/Shanghai）；完整输出 `docs/skill/pnpm-desktop-test-output.txt`
- 环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64

IPC：`skills:listTemplates`、`skills:instantiateTemplate`、`skills:createBlank`、`skills:list`、`skills:load`、`skills:save`、`skills:updateMetadata`、`skills:transitionStatus`、`knowledge:instantiateConceptTemplate`。

桥接键：`listSkillTemplates`、`instantiateSkillTemplate`、`createBlankSkill`、`listSkills`、`loadSkill`、`saveSkill`、`updateSkillMetadata`、`transitionSkillStatus`、`instantiateConceptCard`。

## 未解决风险

- SKILL-004 将替换本票的临时模板适配器；标识符已按冻结契约对齐。
- VER-001 将拥有正式的 list / metadata / 状态机及版本写入 API；本票的桌面侧助手是过渡实现。
- VER-002 将拥有版本列表与回滚 UI；本票只预留入口。
- 单元测试不打开已打包的 Electron 窗口。独立 QA 必须在新的官方未签名 macOS 13+ 构建上验证后，才能决定是否合入 `integration`。
- 不要把本 PR 改指向 `main`。不要自行合并，不要发布，不要宣布可试用。

## 风险等级

**中（medium）。** 未新增 schema 迁移或新表，未改 core 版本写入或知识卡确认契约。产品完整性取决于随后的官方构建与独立 QA，而不是本 PR 单独宣布。

## 建议审阅者

独立 QA 在相关核心路径上验证后再决定是否合入 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。
