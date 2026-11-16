# COUNCIL-001：智囊团 MVP（三本定稿席位 + 圆桌）

- ID：COUNCIL-001
- 阶段：E
- 目标：用已验收的《孙子兵法》《论语》《道德经》蒸馏结果，生成可召唤的专家席位；支持单席问答与至少两席连续发言再总结的圆桌。每轮回答必须带来源文件名。本票做核心 API 与可测试编排，桌面席位卡片可做最小接线，但不新增一级导航。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）。若与 DISTILL-001 并行，只写本票允许的路径，不要改 `packages/core/src/distill/**`。
- 依赖：3 本定稿夹具。不依赖新书蒸馏完成。对话薄切片已在 integration（PATH-001）。
- 状态：Ready
- 启动时间：2026-11-16 22:31 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration`（`26ada833`）拉 `feat/COUNCIL-001`，独立 worktree `/workspace/bookskill-worktrees/COUNCIL-001`
- 风险等级（预估）：中（席位配置与对话编排；不改 schema；不自动发布 Skill）
- 测试样本：`packages/core/test/fixtures/distill/` 中的三本定稿只读副本，不得改哈希。

## 允许写入

- 新建 `packages/core/src/council/**` 及 `packages/core/test/council-001.test.ts`
- 经 `packages/core/src/index.ts` **追加**导出
- 如需最小桌面接线：`packages/desktop/src/renderer/council/**`、追加 main/preload/chat 接线、`packages/desktop/test/council-001.test.ts`。不得与未合入的 DISTILL-002 抢同一新文件；若冲突，本票只交核心 API，UI 留待后续工单。
- `docs/council/**`
- 可把席位绑定到由定稿第 5 段生成的 **draft** Skill（可在测试中调用 `createSkill`/`importDistillation` 的等价夹具导入）。不得把席位 Skill 标为 `published`

## 禁止写入

- `packages/data` 迁移、锁定模板与定稿原件、`packages/core/src/distill/**`（若 DISTILL-001 尚未合入，本票用夹具解析的本地辅助函数，或复制最小解析，不要另起一套长期模块抢路径）
- 搜索/关系实现、治理文件
- 不得新增第六个一级导航；智囊团作为「问题对话」下的模式或面板。`DEFAULT_ROUTE_ID` 仍为 `chat`
- 不得把 AnythingLLM 工作区 / Pin 当作席位实现
- 不得合入 `main`，不得发布

## 数据模型

```json
{
  "seat_id": "sunzi-decision",
  "name": "决策席",
  "based_on": ["孙子庙算决策评估"],
  "book_title": "孙子兵法",
  "source_filename": "孙子兵法_蒸馏结果.md",
  "system_prompt": "你综合以下来源做决策建议...",
  "skill_status": "draft"
}
```

固定席位至少 3 个，分别基于三本定稿（决策席对应《孙子兵法》，其余两席对应《论语》《道德经》，名称可在实现里写清楚但须稳定 id）。

## 实现要点

1. 从夹具导入三本定稿，建立固定席位；单席：切换该席位系统提示，检索范围限制在对应书的来源。
2. 圆桌：至少 2 个席位依次发言，再给出总结；每条发言带来源文件名，引用不得编造原文。
3. 模型调用走 BookSkill 适配层，测试必须可注入假适配器（基于夹具正文做可断言回复）。
4. 基于《孙子兵法》的决策席必须能引用夹具中的段落或金句，并带 `孙子兵法_蒸馏结果.md`。

## 验收条件（可测试）

1. 三个固定席位可列出，id 稳定，均绑定 draft Skill 或等价草稿上下文，无一为 `published`。
2. 决策席单问（注入适配器）返回内容能指向《孙子兵法》夹具，并带来源文件名。
3. 圆桌至少 2 席连续发言 + 1 条总结，每条都有 `source_filename`。
4. 不改 schema，不加第六个一级导航。`pnpm --filter @bookskill/core test` 通过；若改了 desktop，则 `pnpm --filter @bookskill/desktop test` 也须通过。
5. 独立 QA 通过后才能合入 `integration`。不得宣布完成，除非独立 QA 验证通过。

## 测试命令

```bash
# 在 feat/COUNCIL-001 worktree
pnpm --filter @bookskill/core test
# 若本票改了 desktop，再加上：
# pnpm --filter @bookskill/desktop test
```

## 交付物路径

- `docs/council/COUNCIL-001-REPORT.md`
- 实现与测试
- 远端 PR：目标 `integration`，风险 medium

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 schema，不加一级导航，不改三本定稿哈希。
