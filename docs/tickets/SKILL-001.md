# SKILL-001：Skill 编辑器与状态机

- ID：SKILL-001
- 阶段：E
- 目标：在桌面应用中提供可用的 Skill 编辑器：可从模板或空白创建草稿，编辑合同 2.6 要求的字段，走 `draft` / `tested` / `published` / `archived` 状态机，并显示当前版本。一键套用规范结构（阅读笔记、概念卡、决策规则、复盘，以及 SKILL-004 的九个领域模板）。参考 Templater 的“选模板 → 生成可编辑结构”，但必须写入 BookSkill 自有 Skill / 知识卡模型，不得另做一套模板产品。
- 负责人 Agent：frontend_engineer（BookSkill Frontend Engineer）
- 依赖：VERT-001 已在 `origin/integration` @ `5ec4540`（已有 `createSkill` / `createSkillVersion` / `loadSkill` / `loadSkillVersion`）。模板目录的完整实现由 SKILL-004 交付；本票可先按下方冻结的模板契约接线，SKILL-004 落地后改为调用正式模块，不得另写一套冲突的模板数据。
- 状态：Ready / In Progress
- 启动时间：2026-11-16 22:10 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration`（`5ec4540`）拉 `feat/SKILL-001`，独立 worktree `/workspace/bookskill-worktrees/SKILL-001`
- 视觉参考（只读，禁止改）：`/workspace/bookskill-desktop/prototypes/desktop-shell/`
- 风险等级（预估）：中（使用既有 `skills` / `skill_versions` 表；不改 `packages/data` 迁移；不自动发布，D-018）
- 测试样本：只使用 FIXT-001 或同等许可/合成样本。不执行不受信任 Skill 中的任意代码。

## 冻结的模板调用契约（供本票与 SKILL-004 对齐）

核心模块目标路径：`packages/core/src/skill-templates/`（由 SKILL-004 实现）。在该模块合入前，编辑器可使用同名、同输入的临时适配，但标识符必须稳定：

- `listSkillTemplates(): SkillTemplateSummary[]`，每项含 `id`、`domain`（`daily` / `life` / `professional` 或合同中文领域名）、`name`、`purpose`、`whenToUse`、`whenNotToUse`
- `instantiateSkillTemplate({ db, templateId, name? })`：创建 **draft** Skill + 第一版 `skill_versions`，不得使用 `published`
- 九个模板 `id` 必须稳定：
  - `daily.daily-plan` 每日计划
  - `daily.weekly-review` 每周回顾
  - `daily.reading-review` 阅读复盘（对应“阅读笔记 / 复盘”中的阅读向）
  - `life.complex-choice` 复杂选择梳理（对应“决策规则”）
  - `life.family-planning` 家庭事务规划
  - `life.habit-plan` 习惯行动计划
  - `professional.meeting-prep` 会议准备
  - `professional.interview-outline` 访谈提纲
  - `professional.project-retro` 项目复盘
- 另提供知识卡结构模板（生成的是知识卡**草稿**，不是 Skill，也不是正式卡）：
  - `knowledge.concept-card` 概念卡（字段：标题、定义/内容、适用条件、限制、来源占位）。创建后 `status=draft`，只有用户确认才变为 `verified_by_user`（D-017）

若本票需要新的 list/update API，优先请求 VER-001 已约定的 `listSkills` / `updateSkillMetadata` / `transitionSkillStatus`；不要改 `packages/data`，不要重写 `packages/core/src/skills.ts` 的版本表写入逻辑（该文件以 VER-001 为写入方）。本票以桌面 UI 与 IPC 为主。

## 允许写入

- 新建 `packages/desktop/src/renderer/skills/**` 及对应测试
- desktop main / preload / shell-info / navigation / renderer 入口仅允许**追加** Skills 导航、编辑器 IPC 与入口接线；默认路由仍为 `chat`
- 概念卡模板的入口可以在知识库面板**追加**“从模板新建草稿”，但不得改 KNOW-001 的确认/合并/删除契约
- `docs/skill/**`
- 经 `packages/core/src/index.ts` **追加**导出（若只是转出 SKILL-004 模块）。确需极小的 desktop 侧适配文件时，放在 `packages/desktop/src/main/skills-editor.ts` 一类新文件

## 禁止写入

- `packages/data` 迁移、`packages/core/src/search/**`、`relations.ts` / `relations/**`、导入管道、FIXT 样本、taste-skill 原型、治理文件
- 不得重写 VER-001 的版本历史实现，不得把 Skill 草稿自动发布为 `published`（D-018）
- 不得执行来自书籍内容或不受信任 Skill 的任意代码
- 不得合入 `main`，不得发布，不得推进网盘分发

## 验收条件（可测试）

1. **创建**：用户可以从空白或任一稳定模板 id 一键生成 Skill 草稿；生成结果为 `draft`，带版本号，含 name / domain / purpose / when_to_use / when_not_to_use / inputs / steps / rules / output schema / permissions 的可编辑结构。不得在创建时写成 `published`。
2. **编辑与状态**：用户可编辑上述字段并保存为新的草稿内容（保存不得破坏既有 `skill_versions` 行的不可变历史：更新应新增版本或按 VER-001 约定写入，不得原地改历史版本行）。状态转换：
   - `draft → tested` 需用户显式操作；
   - `tested → published` 只能由用户显式操作，AI/模板实例化不得调用；
   - `published` 或任意状态可 `archived`（用户显式）；
   - 非法回退（例如代码路径里把 archived 自动发成 published）必须被拒绝并有测试。
3. **概念卡模板**：一键生成的是 `draft` 知识卡，确认前不得变为 `verified_by_user`。
4. **可追溯**：编辑器显示当前 `skill_version_id` / 版本号。版本列表与回滚 UI 属于 VER-002，本票至少要把当前版本展示出来，并预留入口，不阻塞 VER-002。
5. **自动化测试**覆盖：从模板创建为 draft、非法自动发布被拒绝、状态转换、概念卡草稿不会被自动确认；失败时非零退出。独立 QA 通过后才能合入 `integration`。不得宣布完成，除非独立 QA 验证通过。

## 测试命令

```bash
# 在 feat/SKILL-001 worktree
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

## 交付物路径

- `docs/skill/SKILL-001-REPORT.md`
- 实现与测试（见允许写入）
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决风险

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 schema，不改搜索/关系实现。
