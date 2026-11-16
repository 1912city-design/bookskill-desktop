# DISTILL-002：上传 → 蒸馏进度 → 结果预览 → 加入对话

- ID：DISTILL-002
- 阶段：E
- 目标：在现有桌面壳里打通「书库上传 / 选择已导入书 → 蒸馏进度 → 5 段结果预览 → 一键加入对话」的产品路径。预览必须展示锁定的 5 段，并支持复制 draft Skill。
- 负责人 Agent：frontend_engineer（BookSkill Frontend Engineer）
- 依赖：DISTILL-001 工单已冻结 API。可在 `feat/DISTILL-002` 上按该契约先做 UI，并对核心导出做可选适配（若本分支尚未合入 DISTILL-001，则用本地临时适配器或跳过真实生成，但预览/加入对话必须能用 3 本定稿夹具走通）。
- 状态：Ready
- 启动时间：2026-11-16 22:31 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration`（`26ada833`）拉 `feat/DISTILL-002`，独立 worktree `/workspace/bookskill-worktrees/DISTILL-002`
- 风险等级（预估）：中（UI 与 IPC；不改 schema；不自动发布 Skill）
- 测试样本：FIXT-001 与 DISTILL-001 夹具的只读副本（可从 `/workspace/bookskill-worktrees/DISTILL-001/packages/core/test/fixtures/distill/` 再复制到本票测试夹具，不得改哈希，不得改原件）。

## 允许写入

- `packages/desktop/src/renderer/distill/**`（新建）
- 追加接线：`packages/desktop/src/renderer/main.ts`、`packages/desktop/src/main/main.ts`、`packages/desktop/src/main/preload.cjs`、书库视图中的入口、`styles.css`、必要的 shared 类型
- `packages/desktop/test/distill-002.test.ts`
- `docs/distill/**`（本票报告，不覆盖 DISTILL-001 报告）

## 禁止写入

- `packages/data`、`packages/core/src/distill/**`（核心归 DISTILL-001）、`packages/core/src/skills.ts` 写入核心
- 搜索/关系实现、治理文件、锁定模板与三本定稿原件
- 不得新增第六个一级导航。上传与预览放在「书库」或书详情；「加入对话」跳到现有「问题对话」。默认路由仍为 `chat`
- 不得把 AnythingLLM 工作区 / Pin 当作 UI 步骤
- 不得自动确认知识卡（D-017）或自动发布 Skill（D-018）
- 不得合入 `main`，不得发布

## 实现要点

1. 书库保持现有导入（PDF/EPUB/TXT/Markdown）。增加「蒸馏」入口：对已导入书启动流水线，显示进度与失败原因。
2. 结果预览按锁定 5 段展示（核心定位、原则与应用、金句、应用框架、可调用Skill），可切换 Markdown / JSON。
3. 「一键加入对话」把该书与解析出的 draft Skill 设为本次对话上下文，不改变 Skill 的 `draft` 状态。
4. 每个 Skill 提供复制按钮（Markdown 或 JSON）。
5. 引用展示源文件名；没有定位时标未确认，不伪造。

## 验收条件（可测试）

1. 使用定稿夹具，不打开已打包 Electron 窗口也能渲染预览：5 段标题正确，可复制至少一个 Skill。
2. 「加入对话」后，对话上下文包含该书 `source_filename` 与 draft Skill 标识；Skill 仍为 `draft`。
3. 缺段夹具显示校验失败，不进入成功预览，不写入 published Skill。
4. `NAV_ITEMS` 仍为 5 项，`DEFAULT_ROUTE_ID` 仍为 `chat`；新 renderer/distill 代码不得对 `@bookskill/core` 桶做值导入。
5. `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）通过。独立 QA 通过后才能合入 `integration`。不得宣布完成，除非独立 QA 验证通过。

## 测试命令

```bash
# 在 feat/DISTILL-002 worktree
pnpm --filter @bookskill/desktop test
```

## 交付物路径

- `docs/distill/DISTILL-002-REPORT.md`
- 实现与测试
- 远端 PR：目标 `integration`，风险 medium

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 schema，不改 DISTILL-001 核心，不加第六个一级导航。
