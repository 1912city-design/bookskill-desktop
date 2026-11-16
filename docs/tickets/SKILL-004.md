# SKILL-004：V1 九个 Skill 模板（及概念卡结构模板）

- ID：SKILL-004
- 阶段：E
- 目标：按合同第 2.7 节落地至少 9 个可编辑通用模板（日常 3、生活 3、专业 3），并提供一键实例化为 Skill **草稿**。同时提供“概念卡”知识卡结构模板（草稿，D-017）。每个模板至少一条正常测试、一条边界测试。参考 Templater 只取其“模板生成可编辑结构”，内部格式是 BookSkill Skill / 知识卡，不是外部模板引擎。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）；product 已在合同中锁定模板清单，本票不再改领域划分
- 依赖：VERT-001 已在 `origin/integration`。本票在 REL-002 的 PR 开出后立即开工。模板契约与 SKILL-001 工单中的稳定 `id` 必须一致。
- 状态：Ready
- 启动时间：2026-11-16 22:10 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration`（`5ec4540`）拉 `feat/SKILL-004`，独立 worktree `/workspace/bookskill-worktrees/SKILL-004`
- 风险等级（预估）：中（只创建 draft Skill / draft 知识卡；不改 schema；D-018 / D-017）
- 测试样本：只使用 FIXT-001 或同等许可/合成样本。

## 允许写入

- 新建 `packages/core/src/skill-templates/**` 及对应测试
- 经 `packages/core/src/index.ts` **追加**导出
- `docs/skill/**`（本票报告与模板说明；不覆盖 SKILL-001 报告）
- 不得改 `packages/core/src/skills.ts` 的版本写入核心（可调用 `createSkill`，创建时 status 必须是 `draft` 或省略后由本票显式传入 `draft`）。若现有 `createSkill` 默认 `tested`，本票应传入 `status: draft`，不得把默认改成 `published`

## 禁止写入

- `packages/data` 迁移、桌面 UI（UI 归 SKILL-001）、搜索/关系实现、FIXT 样本、治理文件
- 不得自动 `published`，不得执行任意代码，不得合入 `main`，不得发布，不得推进网盘分发
- 模板文案不得声称适用于所有用户或岗位

## 模板清单（id 稳定，不得擅自改名）

日常：`daily.daily-plan` 每日计划；`daily.weekly-review` 每周回顾；`daily.reading-review` 阅读复盘。  
生活：`life.complex-choice` 复杂选择梳理；`life.family-planning` 家庭事务规划；`life.habit-plan` 习惯行动计划。  
专业：`professional.meeting-prep` 会议准备；`professional.interview-outline` 访谈提纲；`professional.project-retro` 项目复盘。  
知识卡：`knowledge.concept-card` 概念卡结构（draft 卡，不是 Skill）。

每个 Skill 模板必须带：name、domain、purpose、when_to_use、when_not_to_use、inputs、steps、rules、output schema、permissions（默认无网络、不写文件）、至少一个成功示例输入和一个边界/失败示例（缺必填项或超范围）。

## 验收条件（可测试）

1. `listSkillTemplates()` 至少返回上述 9 个 Skill 模板，id 与领域正确。
2. `instantiateSkillTemplate` 对每个模板能生成 `draft` Skill + 第一版本；断言 status ≠ `published`。
3. 每个模板至少 1 条正常测试、1 条边界测试（例如缺必填输入被拒绝或标记为不完整；不得因此发布）。
4. `knowledge.concept-card` 生成知识卡草稿，status=`draft`，确认前不是 `verified_by_user`。
5. 自动化测试失败时非零退出。独立 QA 通过后才能合入 `integration`。不得宣布完成，除非独立 QA 验证通过。

## 测试命令

```bash
# 在 feat/SKILL-004 worktree
pnpm --filter @bookskill/core test
```

## 交付物路径

- `docs/skill/SKILL-004-REPORT.md`
- 实现与测试
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决风险

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 schema，不改编辑器文件树（`packages/desktop/src/renderer/skills/**`）。
