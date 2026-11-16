# PATH-001 交接报告

- 任务：补上桌面产品路径上的两个缺口——书库导入（文件选择 + `importBook` IPC）以及问题对话的输入框与来源引用——使独立 QA 能在官方未签名 macOS 13+ 构建上重跑全部 7 项核心路径。
- 负责人：frontend_engineer（本工作树提交身份沿用仓库已有配置，未另造身份）
- 分支：`feat/PATH-001`
- 基础：`origin/integration` @ `30e9ed4c92691b557a21961fc7a647fa14f7bb8d`（「Merge SEARCH-001 into integration after independent QA」）
- 工作区：`/workspace/bookskill-worktrees/PATH-001`
- 完成时间：2026-11-16 16:00 CST（Asia/Shanghai）
- 状态：本地实现与测试已完成。将推送 `feat/PATH-001` 并打开目标仅为 `integration` 的 PR。**未自行合入 `main` / `integration`，未发布，未标 Done，未进入 Phase E/F Skill Studio 扩展，未宣布可试用。** 这不是 G1，也不是可发运安装包。
- 风险等级：**中（medium）**。只接线已有 `@bookskill/core` 的 `importBook` / `createSkill` / `startConversation` / `ask`，未改 `packages/data/**` 迁移，未新增表，未自动确认知识卡（D-017），未自动发布 Skill（D-018）。

## 做了什么

独立 QA 在真实未签名 universal 开发构建（`feat/PKG-001` @ `f78aa00`）上判定总体 FAIL：书库空态只有「请先导入许可的 PDF 或 EPUB」文案、没有导入按钮或 `input[type=file]`，preload 没有 `importBook` / `library:import`；问题对话页只是 `.view-note` 占位，没有输入框、来源表面或对话 IPC。IMPORT-001 是 core-only。本票只修产品路径缺口，不扩成完整 Skill Studio。

- 书库列表（空态与已有书籍）增加可见控件「导入许可的 PDF 或 EPUB」（`data-testid="library-import"`），以及 `<input type="file" accept=".pdf,.epub,application/pdf,application/epub+zip,..." data-testid="library-import-file">`，「选择文件」标签可被 QA 文案探测到。
- 新增主进程路径导入助手 `importLibraryBook`：校验路径后调用既有 `importBook({ db, dataDir, filePath })`，返回列表友好的书籍摘要。解析错误以现有 `library-error` 提示展示。导入成功后刷新书库列表，已有阅读器 `loadLibraryBook` 路径保持不变。数据目录仍走既有隔离的 `BOOKSKILL_DATA_DIR`，不写默认 Application Support。
- Preload / 主进程：
  - `importBook` → `library:import`（路径导入）
  - `importBookFile`：在 preload 用 `webUtils.getPathForFile` 解析沙箱 File 后再走 `library:import`
  - `chooseAndImport` → `library:chooseAndImport`（`dialog.showOpenDialog`，推荐给按钮使用）
- 用最小对话面替换 chat 路由占位，而不是 Skill Studio / Phase E CHAT-001–004：
  - `form[data-testid="chat-form"]`
  - `textarea[data-testid="chat-input"][name="question"]`
  - 发送按钮 `data-testid="chat-send"`
  - 来源引用 `data-testid="chat-source"`，带 `data-grounding` / `data-paragraph-id` / `data-book-title` / `data-chapter`
- 对话 IPC：
  - `startConversation` → `conversation:start`
  - `ask` → `conversation:ask`
  - `loadConversation` → `conversation:load`
  - `listConversations` → `conversation:list`
- 主进程只用已有 core API。若不存在可用 Skill，则通过 `createSkill` 创建名为「本机问题对话」的未发布 / `tested` 本地 stub Skill，purpose 与回顾式 Skill 同类，但 **没有必填输入**，因此第一句「这条原则的原书出处是什么？」即可返回带来源的结论。若已有 `verified_by_user` 知识卡，可绑定其 id；草稿不会被自动确认。回合写入既有 `conversations` / `conversation_turns` / `evidence_refs`，同一 `BOOKSKILL_DATA_DIR` 关闭再打开可回看。
- 五个一级导航与默认路由（问题对话）不变，只替换 chat 占位。对话样式使用壳层 token；书库导入控件沿用已有书库表面样式。未把工作台改成营销页。
- 新增渲染层代码只使用本地展示类型或 `import type`，没有从 `@bookskill/core` 桶做值导入。Node / core 调用放在主进程模块（`library-import.ts`、`conversation-path.ts`、`main.ts`），不进入 renderer bundle 入口。

未修改：`docs/PROJECT_STATE.md`、`docs/TASKS.md`、`docs/DECISIONS.md`、`docs/BLOCKERS.md`、`docs/GROK_EXECUTION_SPEC.md`、`docs/tickets/**`、`docs/PENDING_DECISIONS.md`、`packages/data/**` 迁移、`fixtures/`、taste-skill / 原型、skill kit。未基于 `feat/PKG-001`，未复用陈旧的 `PROD-001` 工作树，未在 `/workspace/bookskill-desktop` 检出里提交。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 书库空态与非空态都有可见导入控件和 `input[type=file]`；路径导入助手对 FIXT-001 EPUB/PDF 写入书籍，导入后列表出现 `data-testid="library-book"` | **通过。** 单元测试覆盖空态 / 已有书籍的 HTML，以及 `importLibraryBook` 导入 `fixtures/bookskill-test-primer.epub` 与 `.pdf`。 |
| 2 | 问题对话有 `chat-form`、`chat-input`、`textarea[name=question]`；导入后提问「这条原则的原书出处是什么？」的对话 HTML 含来源引用 `[P1.3]` 与 BookSkill Test Primer | **通过。** 默认 shell Skill 无必填输入，第一轮即可给出 sourced 引用。草稿知识卡不会被自动确认。 |
| 3 | 关闭并在同一 `BOOKSKILL_DATA_DIR` 再打开后，仍能看到已导入书籍与带来源的对话回合 | **通过（本机数据路径）。** 单测关闭工作区再打开，`loadLatestConversationView` 渲染仍含 `[P1.3]` 与书名。官方包上的 7 项路径需独立 QA 在新构建上重跑。 |
| 4 | 常量不得从 renderer 值导入 `@bookskill/core` 桶；既有 READ/KNOW/SEARCH/REL 测试继续通过 | **通过。** 新增 chat UI 无 core 值导入；`pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test` 均为退出码 0。 |
| 5 | 自动化测试使用 FIXT-001，不要求 GUI 对话框；失败时非零退出 | **通过。** 测试只走路径导入助手，不调用 `dialog.showOpenDialog`。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/PATH-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**37 passed，0 failed**。时间：2026-11-16 16:00 CST（Asia/Shanghai）。完整输出：`docs/path/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**43 passed，0 failed**（含本任务新增 4 项，既有 READ/KNOW/SEARCH/REL 等继续通过；含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建）。时间：2026-11-16 16:00 CST（Asia/Shanghai）。完整输出：`docs/path/pnpm-desktop-test-output.txt`

## 关键 API、通道与 testid

IPC 通道：`library:import`、`library:chooseAndImport`、`conversation:start`、`conversation:ask`、`conversation:load`、`conversation:list`。

桥接键（`window.bookskillDesktop`）：`importBook`、`importBookFile`、`chooseAndImport`、`startConversation`、`ask`、`loadConversation`、`listConversations`。

Testids：`library-import`、`library-import-file`、`library-book`、`library-error`、`chat-form`、`chat-input`、`chat-send`、`chat-source`、`chat-turns`、`chat-error`。

主进程助手：`importLibraryBook`、`ensureShellSkill`、`askOnProductPath`、`startProductConversation`、`loadConversationView`、`loadLatestConversationView`。

## 交付物路径

- 实现：`packages/desktop/src/main/library-import.ts`、`packages/desktop/src/main/conversation-path.ts`、`packages/desktop/src/renderer/chat/**`，以及主进程 / preload / 渲染壳 / 书库视图 / 样式的接线
- 测试：`packages/desktop/test/path-001.test.ts`（为满足新的桥接类型，为 `packages/desktop/test/rel-001.test.ts` 的 mock 补了 stub，未改关系逻辑）
- 报告：`docs/path/PATH-001-REPORT.md`、`docs/path/pull-request.md`
- 日志：`docs/path/pnpm-core-test-output.txt`、`docs/path/pnpm-desktop-test-output.txt`

## 未解决风险

- 本机单元测试覆盖路径导入与 HTML，不打开 GUI 文件对话框，也不驱动已打包的 Electron 窗口。独立 QA 必须在新的官方未签名 macOS 13+ 构建上重跑全部 7 项核心路径，才能把导入、阅读、知识卡、搜索、对话与重开判定为通过。
- 沙箱渲染层的 `<input type="file">` 依赖 preload 的 `webUtils.getPathForFile`；若个别环境无法解析路径，应改用「导入许可的 PDF 或 EPUB」按钮走主进程对话框。
- Stub 适配器只在问题匹配「出处|来源|原则|知识卡|P1.3|原书」等时从已导入书中定位 P1.3。这足以验证「基本对话与来源」，但不是完整对话工作台。未导入带 P1.3 的书时，部分问题仍会失败。
- 从 `evidence_refs` 重建历史回合时，带 `source_chunk_id` 的无来源声明（例如空洞回声反例）可能被标成 sourced，因为证据表不保存 grounding。QA 要求的原则出处路径（P1.3）可以正确重建。
- 这不是 G1，不是可试用声明，也不是发运包。不要自行合入 `integration` 或 `main`，不要发布，不要谈网盘。
