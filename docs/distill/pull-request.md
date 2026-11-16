# PR：DISTILL-002 书库蒸馏预览与加入对话

- 分支：`feat/DISTILL-002`
- 基础 / 目标只能是：**`integration`**（`26ada833b6bb74bc555435ad1385a70a413728ec`，已含 SKILL-001）。不要改指向 `main`。本分支没有变基到更新后的 `integration`。
- 类型：**中风险（medium）**。在现有桌面壳上追加蒸馏预览、IPC 与对话上下文侧车；未改 schema 迁移，未写 `packages/core/src/distill/**`，未重写 core Skill 版本写入，未自动确认知识卡，未自动发布 Skill。
- 状态：实现与本机测试已完成，用于打开远端 PR。**不要由本任务实现者合并或发布。** 由独立 QA 验证通过后才能合入 `integration`。
- 未合入 `main` / `integration`，未发布，未标 Done，不是 G1 / 可试用 / 发运包。未开工 VER-002。

## 改动摘要

我在现有五入口桌面壳里打通了「书库选择 / 导入 → 蒸馏进度 → 锁定 5 段预览 → 一键加入对话」。没有增加第六个一级导航，默认路由仍是「问题对话」。

书库列表和阅读器提供「蒸馏」入口。未配置模型适配器时，启动蒸馏会可见失败并给出原因，不会假装生成 5 段成功结果。失败后可导入已有的 5 段蒸馏 Markdown。预览按锁定标题顺序展示：核心定位、原则与应用、金句、应用框架、可调用Skill，并可切换 Markdown / JSON。第 5 段每个 Skill 都可复制 Markdown 和 JSON。

因为 DISTILL-001 尚未合入，解析 / 校验 / 导入 / 列表 / 加载放在桌面主进程临时适配器里，契约名称与 JSON 形状与 DISTILL-001 工单对齐。导入只把文件写入本机数据目录（`library/distill/`），并用既有 `createSkill({ status: "draft" })` 创建草稿。加入对话时，`startConversation` 绑定该 draft Skill；书籍和 `source_filename` 记在 `conversations/distill-context/` 侧车中，不增加迁移。Skill 状态保持 `draft`，不会自动发布或确认知识卡。引用展示源文件名；没有精确出处时标注「来源定位未确认」，不伪造定位。

新增渲染层代码不从 `@bookskill/core` 桶做值导入。三本定稿夹具只复制到本票测试目录，哈希未改。

## 验收条件逐条结果

1. **通过。** 不打开已打包 Electron 窗口即可渲染预览：5 段标题正确且按序，至少一个 Skill 的 Markdown / JSON 可从 markup 复制。夹具 SHA-256 已断言。
2. **通过。** 加入对话后，上下文包含 `source_filename` 与 draft Skill id；`loadSkill` 状态仍为 `draft`。
3. **通过。** 缺段、改标题、空 Skill 的合成夹具校验失败，不进入成功预览，不写入 Skill。
4. **通过。** `NAV_ITEMS.length === 5`，`DEFAULT_ROUTE_ID === "chat"`；新 `renderer/distill` 文件不对核心桶做值导入。
5. **本机自动化通过。** `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）退出码为 0。独立 QA 通过前不能合入 `integration`，也不能宣布完成。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/DISTILL-002`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**43 passed，0 failed**；时间 2026-11-16 22:41 CST（Asia/Shanghai）；完整输出 `docs/distill/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**62 passed，0 failed**（含新增 6 项，既有 READ/KNOW/SEARCH/REL/PATH/SKILL/NAV 继续通过，含 `tsc --noEmit`）；时间 2026-11-16 22:41 CST（Asia/Shanghai）；完整输出 `docs/distill/pnpm-desktop-test-output.txt`
- 环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64

IPC：`distill:start`、`distill:importMarkdown`、`distill:load`、`distill:list`、`distill:attachToChat`、`distill:loadChatContext`。

桥接键：`startDistill`、`importDistillationMarkdown`、`loadDistillation`、`listDistillations`、`attachDistillationToChat`、`loadDistillationChatContext`。

Testids：`library-distill`、`distill-progress`、`distill-error`、`distill-preview`、`distill-section`、`distill-view-markdown`、`distill-view-json`、`distill-source-filename`、`distill-locator`、`distill-skill`、`distill-skill-copy-markdown`、`distill-skill-copy-json`、`distill-add-to-chat`、`chat-distill-context`。

## 未解决风险

- DISTILL-001 将替换本票的临时适配器；标识符已按冻结契约对齐。本票没有真实模型生成。
- 单元测试不打开已打包的 Electron 窗口。独立 QA 必须在新的官方未签名 macOS 13+ 构建上验证后，才能决定是否合入 `integration`。
- 不要把本 PR 改指向 `main`。不要自行合并，不要发布，不要宣布可试用。

## 风险等级

**中（medium）。** 未新增 schema 迁移或新表，未写核心蒸馏模块，未改 Skill 版本写入或知识卡确认契约。产品完整性取决于随后的官方构建与独立 QA，而不是本 PR 单独宣布。

## 建议审阅者

独立 QA 在相关核心路径上验证后再决定是否合入 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。
