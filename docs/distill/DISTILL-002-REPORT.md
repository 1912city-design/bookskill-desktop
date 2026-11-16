# DISTILL-002 交接报告

- 任务：在现有 BookSkill Desktop 五入口壳里打通「书库上传 / 选择已导入书 → 蒸馏进度 → 锁定 5 段结果预览 → 一键加入对话」的产品路径。预览必须展示锁定 5 段，支持 Markdown / JSON 切换，并可复制 draft Skill；加入对话不得改写 Skill 状态。
- 负责人：frontend_engineer（本工作树提交身份沿用仓库已有配置 BookSkill Orchestrator `<bookskill-orchestrator@local>`，未另造身份）
- 分支：`feat/DISTILL-002`
- 基础：已变基到 `origin/integration` @ `0e53bebebcf6ae3a21c3b74c57e788e8efaf1516`（「Merge pull request #20 from 1912city-design/feat/COUNCIL-001」，已含 REL-002 / SKILL-004 / COUNCIL-001）。未变基到 `main`。为通过变基后的桌面包类型检查，我在 `rel-002.test.ts` 补了未使用的蒸馏桥接桩（与 `rel-001.test.ts` 相同）。测试日志改名为 `DISTILL-002-pnpm-*-test-output.txt`，避免与 DISTILL-001 的同名文件冲突。
- 工作区：`/workspace/bookskill-worktrees/DISTILL-002`
- 完成时间：首次实现 2026-11-16 22:41 CST（Asia/Shanghai）；变基并补桩后重跑测试 2026-11-16 22:46 CST（Asia/Shanghai）
- 状态：本地实现与测试已完成。将推送 `feat/DISTILL-002` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未宣布完成或可试用。** 这不是 G1，也不是可发运安装包。独立 QA 通过前不能把本票当作已完成。
- 风险等级：**中（medium）**。只在桌面主进程和渲染层追加蒸馏预览、IPC 与对话上下文侧车；未改 `packages/data` 迁移；未创建 `packages/core/src/distill/**`；未重写 `packages/core/src/skills.ts` 的版本写入核心；未自动确认知识卡（D-017）；未自动发布 Skill（D-018）。未开工 VER-002。未把 AnythingLLM 工作区 / Pin 做成 UI 步骤。

## 做了什么

我在现有书库和问题对话路径上接了蒸馏入口，而不是增加第六个一级导航，也没有把工作台改成营销页。`NAV_ITEMS` 仍为 5 项，`DEFAULT_ROUTE_ID` 仍为 `chat`。

- 书库列表和阅读器工具栏追加「蒸馏」按钮（`library-distill`）。点击后停留在书库路由，先显示进度；当前没有模型适配器时，`startDistill` 会以结构化失败结束，并给出原因，不会假装生成了 5 段成功预览。失败面板可导入已有的 5 段蒸馏 Markdown，供夹具和后续人工验收走通解析 → 校验 → 导入 / 预览 → 加入对话。
- 因 DISTILL-001 尚未合入，我把冻结 API 做成桌面主进程临时适配器：`packages/desktop/src/main/distill-adapter.ts`（`parseDistillationMarkdown`、`validateDistillation`、`importDistillation`、`listDistillations`、`loadDistillation`）和 `packages/desktop/src/main/distill-path.ts`（`startDistill`、`attachDistillationToChat`、对话上下文侧车）。名称、JSON 形状和锁定 5 段标题与 DISTILL-001 工单一致，便于之后切换到核心导出。未创建 `packages/core/src/distill/**`。
- 预览按锁定顺序展示 5 段标题：核心定位、原则与应用、金句、应用框架、可调用Skill。可在预览 / Markdown / JSON 之间切换同一结果。第 5 段每个 Skill 都有复制 Markdown 和 JSON 的按钮，可复制文本写在 markup 里。
- 校验失败（缺段、改标题、第 5 段 Skill 为空）返回结构化错误，不进入成功预览，不写入任何 Skill，更不会写成 `published`。
- `importDistillation` 把结果作为文件落到本机数据目录现有布局下（`library/distill/{id}/`，未改 `DATA_SUBDIRECTORIES`，未新增 schema 表），并经既有 `createSkill({ ..., status: "draft" })` 创建 draft Skill。我始终显式传入 `draft`，因为该 API 若省略状态会默认 `tested`。
- 「一键加入对话」调用既有 `startConversation`，把导入的 **draft** Skill 以 `selectionMethod: "manual"` 绑到新对话；书籍、`source_filename`、draft Skill id / version id / 状态写在 `conversations/distill-context/{conversationId}.json` 侧车里，不增加迁移。随后跳到现有「问题对话」路由，在输入框上方显示上下文条（源文件名、Skill 名称、draft 徽章）。不会自动发送消息，不会自动发布，不会确认知识卡草稿。
- 引用展示 `source_filename`。夹具没有精确段落定位时，使用既有文案 `来源定位未确认`，不会伪造 paragraph id。
- 新增渲染层 `packages/desktop/src/renderer/distill/**` 只使用本地类型，没有从 `@bookskill/core` 桶做值导入。Node / core 调用留在主进程。
- 三本定稿与模板只从 DISTILL-001 的只读副本再复制到 `packages/desktop/test/fixtures/distill/`，并断言 SHA-256。我没有改这些副本的哈希，也没有改 `/workspace/书籍蒸馏工作台/` 下的原件，也没有就地改写 DISTILL-001 夹具。缺段 / 改标题 / 空 Skill 样本是我另写的合成文件。

未修改：`docs/PROJECT_STATE.md`、`docs/TASKS.md`、`docs/DECISIONS.md`、`docs/BLOCKERS.md`、`docs/GROK_EXECUTION_SPEC.md`、`docs/tickets/**`、`docs/PENDING_DECISIONS.md`、`packages/data/**`、`packages/core/src/distill/**`、`packages/core/src/skills.ts`、`packages/core/src/council/**`、`packages/desktop/src/renderer/council/**`、搜索 / 关系实现、FIXT-001 主样本、锁定模板与三本定稿原件。未改数据目录布局常量。未在 `/workspace/bookskill-desktop` 或其他 worktree 提交。未开工 VER-002。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 使用定稿夹具，不打开已打包 Electron 窗口也能渲染预览：5 段标题正确，可复制至少一个 Skill | **通过。** 三本定稿都解析为锁定 5 段；预览 HTML 标题顺序正确，且含 Skill 的 Markdown / JSON 复制按钮和载荷。测试断言了副本 SHA-256。 |
| 2 | 「加入对话」后，对话上下文包含该书 `source_filename` 与 draft Skill 标识；Skill 仍为 `draft` | **通过。** 侧车和 `chat-distill-context` 都含 `孙子兵法_蒸馏结果.md` 与 Skill id；`loadSkill(...).status === "draft"`，不是 `published`。 |
| 3 | 缺段夹具显示校验失败，不进入成功预览，不写入 published Skill | **通过。** 缺段、改标题、空 Skill 三类合成夹具校验失败；`importDistillation` 不写 Skill，失败视图没有成功预览。 |
| 4 | `NAV_ITEMS` 仍为 5 项，`DEFAULT_ROUTE_ID` 仍为 `chat`；新 renderer/distill 代码不得对 `@bookskill/core` 桶做值导入 | **通过。** 单测覆盖导航和源码检查。 |
| 5 | `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）通过。独立 QA 通过后才能合入 `integration` | **本机自动化通过。** 独立 QA 尚未跑，因此我不能宣布本票完成。 |

另：《孙子兵法》导入后至少有一个 draft Skill，触发条件 / 步骤 / 输出要求可读取；预览展示 `source_filename`；缺失定位使用 `来源定位未确认`，未伪造段落 id。未配置模型时 `startDistill` 可见失败，不生成假成功预览。

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/DISTILL-002` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**86 passed，0 failed**。时间：2026-11-16 22:45–22:46 CST（Asia/Shanghai）。完整输出：`docs/distill/DISTILL-002-pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**66 passed，0 failed**（含本任务新增项，既有 READ/KNOW/SEARCH/REL/PATH/SKILL/NAV 等继续通过；含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建；`rel-002.test.ts` 已补蒸馏桥接桩）。时间：2026-11-16 22:46 CST（Asia/Shanghai）。完整输出：`docs/distill/DISTILL-002-pnpm-desktop-test-output.txt`

## 关键 API、通道与 testid

冻结 API（临时桌面适配器，对齐 DISTILL-001）：`parseDistillationMarkdown`、`validateDistillation`、`importDistillation`、`listDistillations`、`loadDistillation`；编排层另有 `startDistill`、`attachDistillationToChat`、`loadDistillationChatContext`。

IPC 通道：`distill:start`、`distill:importMarkdown`、`distill:load`、`distill:list`、`distill:attachToChat`、`distill:loadChatContext`。

桥接键（`window.bookskillDesktop`）：`startDistill`、`importDistillationMarkdown`、`loadDistillation`、`listDistillations`、`attachDistillationToChat`、`loadDistillationChatContext`。为满足加宽后的 `BookskillDesktopBridge`，我只在 `packages/desktop/test/rel-001.test.ts` 补了 stub 方法，未改 REL 行为。

Testids：`library-distill`、`distill-progress`、`distill-error`、`distill-preview`、`distill-section`（`data-title` / `data-id` 1–5）、`distill-view-markdown`、`distill-view-json`、`distill-source-filename`、`distill-locator`、`distill-skill`、`distill-skill-copy-markdown`、`distill-skill-copy-json`、`distill-add-to-chat`、`chat-distill-context`；另有 `distill-back`、`distill-import-markdown-file`、`distill-view-preview`。

无 schema 迁移的上下文挂接：`startConversation` 只绑定 draft Skill；书籍与 `source_filename`、Skill 状态写入 `conversations/distill-context/` 侧车，并在问题对话页以上下文条展示。

## 交付物路径

- 实现：`packages/desktop/src/main/distill-adapter.ts`、`packages/desktop/src/main/distill-path.ts`、`packages/desktop/src/renderer/distill/**`，以及主进程 / preload / 渲染壳 / 书库视图 / 对话视图 / 共享类型 / 样式的追加接线
- 测试：`packages/desktop/test/distill-002.test.ts`，夹具副本与合成失败样本在 `packages/desktop/test/fixtures/distill/`
- 报告：`docs/distill/DISTILL-002-REPORT.md`、`docs/distill/pull-request.md`
- 日志：`docs/distill/DISTILL-002-pnpm-core-test-output.txt`、`docs/distill/DISTILL-002-pnpm-desktop-test-output.txt`

## 硬性约束确认

- 未改 `packages/data` 迁移，未改产品数据目录布局常量。
- 未创建或写入 `packages/core/src/distill/**`，未重写 `packages/core/src/skills.ts`。
- 未改搜索或关系实现；未创建或编辑 `packages/core/src/council/**` 或 `packages/desktop/src/renderer/council/**`。
- 未增加第六个一级导航；默认路由仍是 `chat`。
- 新的 `renderer/distill` 代码没有对 `@bookskill/core` 桶做值导入。
- 三本定稿与模板副本的 SHA-256 与预期一致；`/workspace/书籍蒸馏工作台/` 原件和 DISTILL-001 夹具未被改写。
- 未自动确认知识卡（D-017），未自动发布 Skill（D-018）；加入对话后 Skill 仍为 `draft`。
- 未开工 VER-002，未实现 AnythingLLM 工作区 Pin UI。
- 未合入 `main` / `integration`，未发布，未宣布完成、可试用或 G1。

## 未解决风险

- DISTILL-001 合入后应替换本票的临时适配器；当前契约已按冻结 API 对齐。本票没有真实模型生成：未配置适配器时必须失败，不能把夹具导入伪装成模型蒸馏成功。
- 单元测试不打开已打包的 Electron 窗口。独立 QA 必须在新的官方未签名 macOS 13+ 构建上重跑核心路径后，才能决定是否合入 `integration`，也不能据此宣布完成。
- 不要把本 PR 改指向 `main`。不要自行合并，不要发布，不要宣布可试用。
