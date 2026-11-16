# PR：PATH-001 书库导入与问题对话产品路径

- 分支：`feat/PATH-001`
- 基础 / 目标只能是：**`integration`**（`30e9ed4c92691b557a21961fc7a647fa14f7bb8d`，已含 SEARCH-001）。不要改指向 `main`。
- 类型：**中风险（medium）**。只把已有 core `importBook` / stub 对话接到桌面壳；未改 schema 迁移，未新增表，未自动确认知识卡，未自动发布 Skill。
- 状态：实现与本机测试已完成，用于打开远端 PR。**不要由本任务实现者合并或发布。** 由独立 QA 在新的官方未签名 macOS 13+ 构建上重跑全部 7 项核心路径。
- 未合入 `main` / `integration`，未发布，未标 Done，不是 G1 / 可试用 / 发运包，未进入 Phase E/F Skill Studio 扩展。

## 改动摘要

独立 QA 在 `feat/PKG-001` @ `f78aa00` 的官方未签名 universal 开发构建上总体判定 FAIL：书库没有导入入口，问题对话只是占位页。本 PR 补上这两处产品路径缺口。

书库列表在空态与已有书籍时都提供「导入许可的 PDF 或 EPUB」按钮（`data-testid="library-import"`）和 `input[type=file]`（`data-testid="library-import-file"`）。按钮走主进程 `dialog.showOpenDialog`；文件选择在 preload 用 `webUtils.getPathForFile` 解析路径后调用既有 `importBook({ db, dataDir, filePath })`。导入成功后刷新列表，解析错误显示在现有 `library-error`。数据目录仍使用隔离的 `BOOKSKILL_DATA_DIR`。

问题对话占位替换为最小对话面：`chat-form` / `chat-input`（`name="question"`）/ 发送按钮，以及带书名、章节、`[paragraphId]`、无来源标注的 `chat-source`。主进程在需要时创建一个无必填输入、状态为 `tested`（非 `published`）的本机 stub Skill，因此导入 FIXT-001 后第一句「这条原则的原书出处是什么？」即可返回 sourced 引用。回合写入既有对话表，同一数据目录关闭再打开可回看。这不是完整 Skill Studio。

新增渲染层代码不从 `@bookskill/core` 桶做值导入，以免再把 `node:` 内置模块打进浏览器包。五个一级导航与默认路由不变。

## 验收条件逐条结果

1. **通过。** 书库 HTML 含 `input[type=file]` 与 `data-testid="library-import"`。同一路径导入助手对 FIXT-001 EPUB/PDF 写入书籍后，列表出现 `data-testid="library-book"`。
2. **通过。** 对话 HTML 含 `chat-form`、`chat-input`、`textarea[name=question]`。导入后提问「这条原则的原书出处是什么？」出现来源引用 `[P1.3]` 与 BookSkill Test Primer。默认 Skill 无必填输入，也不会自动确认草稿或发布 Skill。
3. **通过（本机数据路径）。** 关闭并在同一数据目录重开后，仍能加载带来源的对话回合。官方包上的 7 项路径需独立 QA 在新构建上重跑。
4. **通过。** `pnpm --filter @bookskill/core test` 退出码 0（37 passed / 0 failed）；`pnpm --filter @bookskill/desktop test` 退出码 0（43 passed / 0 failed）。既有 READ/KNOW/SEARCH/REL 测试继续通过。断言失败时 `node:test` 以非零退出。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/PATH-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**37 passed，0 failed**；时间 2026-11-16 16:00 CST（Asia/Shanghai）；完整输出 `docs/path/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**43 passed，0 failed**；时间 2026-11-16 16:00 CST（Asia/Shanghai）；完整输出 `docs/path/pnpm-desktop-test-output.txt`
- 环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64

IPC：`library:import`、`library:chooseAndImport`、`conversation:start`、`conversation:ask`、`conversation:load`、`conversation:list`。

桥接键：`importBook`、`importBookFile`、`chooseAndImport`、`startConversation`、`ask`、`loadConversation`、`listConversations`。

## 未解决风险

- 单元测试不打开 GUI 文件对话框，也不驱动已打包的 Electron 窗口。独立 QA 必须在新的官方未签名 macOS 13+ 构建上重跑全部 7 项核心路径。
- 沙箱 File 路径解析依赖 `webUtils.getPathForFile`；失败时应改用主进程对话框按钮。
- 这是最小对话面（验证「基本对话与来源」），不是 Phase E Skill Studio。Stub 适配器按既有规则从已导入书中引用 P1.3。
- 从 `evidence_refs` 重建历史回合时，带切片 id 的无来源声明可能丢失 grounding 标记；QA 要求的原则出处路径可以正确重建。
- 不要把本 PR 改指向 `main`。不要自行合并，不要发布，不要宣布可试用，不要谈网盘。未进入 Phase E/F。

## 风险等级

**中（medium）。** 未新增 schema 迁移或新表，未改导入解析管线，未改治理文件。产品路径可用性取决于随后的官方构建与独立 QA，而不是本 PR 单独宣布。

## 建议审阅者

独立 QA Security 在新的官方未签名 macOS 13+ 构建上重跑全部 7 项后再决定是否合入 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。
