# DISTILL-003：多源蒸馏（先支持访谈/文本上传）（P1–P2）

- ID：DISTILL-003
- 阶段：E
- 目标：在书籍流水线之外，先支持上传访谈或其它文本，复用同一锁定 5 段模板，生成完整 5 段 + draft Skill，并可被智囊团引用。转录集成不在本票。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）
- 依赖：DISTILL-001、COUNCIL-001 已在 `integration`。本票在 GRAPH-001 开出 PR 后再开工，避免同时改 `packages/core/src/index.ts` 尾部导出。
- 状态：Queued（排在 GRAPH-001 之后）
- 风险等级：中（只创建 draft Skill / 蒸馏产物；不改 schema；D-018）
- 基线：开工前 fetch，从当时的 `origin/integration` 拉出 `feat/DISTILL-003`（若 GRAPH-001 尚未合入，从 `integration` 拉出并避开 `packages/core/src/graph/**`）
- 测试样本：新增一篇许可或合成的访谈/文本夹具（不得使用未授权原文）；锁定模板与三本定稿原件只读，不得改哈希。

## 允许修改

- 扩展 `packages/core/src/distill/**`（或新增明确的多源入口文件）与 `packages/core/test/distill-003.test.ts`
- 经 `packages/core/src/index.ts` **追加**导出
- 如需让智囊团引用新源：只通过 COUNCIL-001 公开 API 或最小接线，不要重写 `packages/core/src/council/**` 业务
- 本票以核心 API 为主；完整上传 UI 若必需，只做最小接线，或留待后续桌面工单并在报告中标明

## 禁止修改

- 锁定 5 段标题与模板原件、三本定稿原件
- `packages/data` 迁移；自动发布 Skill；网盘分发；第六个一级导航

## 验收条件（已冻结）

1. 导入一篇许可/合成访谈或文本，能按锁定 5 段校验，并产生 `draft` Skill（不得自动 `published`）。
2. 智囊团引用该结果时能看到 `source_filename`。
3. 缺段、改标题、第 5 段空 Skill 时失败且不写 Skill。
4. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。
5. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

## 交付

- 分支 `feat/DISTILL-003`，工作树建议 `/workspace/bookskill-worktrees/DISTILL-003`
- 远端 PR：目标 `integration`，风险 medium
- 不要自己合并，不要触 `main`
