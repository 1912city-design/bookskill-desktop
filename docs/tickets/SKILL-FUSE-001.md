# SKILL-FUSE-001：对话沉淀与 Skill 融合（P2）

- ID：SKILL-FUSE-001
- 阶段：E
- 目标：提供「融合两个 Skill」的核心操作，输出新的 `draft` Skill，且可在对话中绑定调用。对话后手动把新知识点沉淀为草稿可同票做最小 API，或在报告中列为残差。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）
- 依赖：DISTILL-001、SKILL-001、COUNCIL-001 已在 `integration`。本票排在 GRAPH-001 与 DISTILL-003 的 PR 开出之后，避免同时改同一导出块。
- 状态：Queued（排在 GRAPH-001、DISTILL-003 之后）
- 风险等级：中（融合只追加新 Skill 或新 `skill_versions`，不改写旧版本；D-018：融合结果必须是 `draft`，发布须用户确认）
- 基线：开工前 fetch，从当时的 `origin/integration` 拉出 `feat/SKILL-FUSE-001`

## 允许修改

- 新建 `packages/core/src/skill-fuse/**`（或同等路径）与 `packages/core/test/skill-fuse-001.test.ts`
- 经 `packages/core/src/index.ts` **追加**导出
- 可调用现有 `createSkill` / `listSkillVersions` 等公开 API；不要改写已有版本行内容

## 禁止修改

- 改写旧 Skill 版本内容；融合结果写成 `published` / `tested` 并自动发布
- `packages/data` 新迁移（应复用现有 `skills` / `skill_versions`）
- 锁定模板与定稿原件；第六个一级导航

## 验收条件（已冻结）

1. 手动触发两个已有 Skill 的融合，得到新的 `draft` Skill；旧 Skill 仍在，其历史行内容未被改写。
2. 新 Skill 可绑定到对话上下文（核心 API 或最小接线可测）。
3. 未显式由用户发布前，状态不得变为 `published`。
4. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。
5. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

## 交付

- 分支 `feat/SKILL-FUSE-001`，工作树建议 `/workspace/bookskill-worktrees/SKILL-FUSE-001`
- 远端 PR：目标 `integration`，风险 medium
- 不要自己合并，不要触 `main`
