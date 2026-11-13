# READ-001 交接报告

- 任务：在已导入材料上提供章节浏览、摘录、批注和来源定位（对应 AT-02 的阅读侧），并把阅读器接到现有 Electron 壳的书库入口
- 负责人：frontend_engineer（BookSkill Frontend Engineer）
- 分支：`feat/READ-001`
- 基础：`feat/VERT-001` / `origin/feat/VERT-001` @ `f109cd2`（含已合入的 IMPORT-001）
- 工作区：`/workspace/bookskill-worktrees/READ-001`
- 完成时间：2026-11-14 01:33 Asia/Shanghai
- 实现提交：`COMMIT_HASH_PLACEHOLDER`
- 状态：本地实现与测试已完成。**本执行器未打开远端 PR，未合入 `main` / `integration`，未发布，未标 Done。** PR 草案见 `docs/read/pull-request.md`，目标只能是 `feat/VERT-001`。由 Orchestrator 安排独立 QA。
- 风险等级：**低/中（low/medium）**。未改 schema 迁移；批注以 JSON 文件写入 BookSkill 数据目录。不是正式 G1，也不是发运包。

## 做了什么

在 `@bookskill/desktop` 上实现 READ-001 阅读器，只追加书库入口接线，不重写主导航或其他页面，也未开工 KNOW-001。

- 新增 `packages/desktop/src/renderer/read/**`：书库列表、阅读视图、选区摘录、未确认来源展示、批注读写。章节 / 页码 / 段落定位展示于每个切片；无法精确定位时只显示合同文案「来源定位未确认」，不会把未确认来源伪称为已精确定位。
- 摘录创建在 Node 侧调用既有 `@bookskill/core` `locateHighlight`。匹配失败，或匹配到 `SourceLocation.confirmed === false` 的切片，一律记为未确认，不写入伪精确的段落 / 页码。
- 批注持久化在 `{dataDir}/library/{bookId}/annotations.json`（不改 `packages/data/**`，不加 SQLite 迁移）。以指向同一 `dataDir` 的新 store 实例重新加载即可读回，模拟退出后再打开。路径断言含 `library` 且不含 `anythingllm|mintplex`。
- 书库列表只读查询已打开业务库中的 `books` 表（core 无 `listBooks` 导出，未向禁止修改的 core 文件加 API）。打开已解析书籍走既有 `loadBook`。
- 通过追加 IPC（`library:listBooks` / `loadBook` / `loadAnnotations` / `createExcerpt`）把阅读器接到现有 Electron 壳；预加载桥接同步追加。渲染进程保持 `contextIsolation: true`、`nodeIntegration: false`，不把 Node / core 打进渲染包。
- 书库 / 阅读器表面使用已锁定的工作台风貌：近黑底 `#000000` / `#0d0d0d`、文字 `#ffffff`、次要 `#999999`、强调 `#93f1f7`，字体栈 Instrument Sans + DM Mono，圆角 soft。样式限定在 `library` 路由与 `.library-surface` / `.reader-surface`，未把聊天、知识库、Skills、设置改成营销落地页。
- 仅轻改书库导航描述（不再写「完整阅读器仍待后续任务」）。未改 `ROUTE_IDS`、未新增顶级导航、未改默认路由（问题对话）及其他入口文案。
- 测试只使用 FIXT-001 许可样本（`fixtures/bookskill-test-primer.epub` / `.pdf`），在临时 BookSkill 数据目录中导入。

未修改：`packages/core` 源码（含 `import-book.ts`、解析器、`knowledge.ts`）、`packages/desktop/src/renderer/knowledge/**`、`packages/data/**`、FIXT-001 样本正文、治理文件、`/workspace/bookskill-ui-taste/**`、原型树 `/workspace/bookskill-desktop/prototypes/desktop-shell/**`。未开工 KNOW-001。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 已导入的许可 EPUB 与文本 PDF 能展示章节或页码/段落定位 | **通过。** 导入 FIXT-001 EPUB 后，阅读视图展示 Chapter 1 / Chapter 2 与 `P1.3` / `P2.2`。导入许可文本 PDF 后展示「第 1 页」「第 2 页」以及 `P1.3` / `P2.5` 与章节名。书库列表可列出这两本已导入书。 |
| 2 | 用户可从选区生成摘录，并能从摘录跳回原书位置 | **通过。** 选中原则句片段后，`createExcerptFromSelection` 定位到已确认的 `P1.3` 切片；`jumpToAnnotation` 把焦点设回该 `chunkId`；渲染结果中对应切片 `data-focused="true"`，并可带批注正文。 |
| 3 | 无法精确定位的来源显示未确认状态，不得伪称为已精确定位 | **通过。** 使用合同标签 `UNCONFIRMED_LOCATION_LABEL`（来源定位未确认），并遵守 `SourceLocation.confirmed`。`locateHighlight` 无法匹配，或匹配到未确认引言切片时，摘录的 `confirmed=false`，不写入段落 / 页码；视图中未确认定位文案不含 `P#.#` 或「第 N 页」；跳回不会把未确认摘录当作精确定位。 |
| 4 | 批注在退出并重新打开应用后仍在（使用 BookSkill 数据目录） | **通过。** 写入 `{dataDir}/library/{bookId}/annotations.json` 后关闭工作区，再用指向同一 `dataDir` 的新 `createAnnotationStore` 实例读回，批注（含正文、批注说明、`P1.3`）仍在。路径位于 BookSkill 数据目录，不含 AnythingLLM / mintplex。 |
| 5 | 自动化测试覆盖上述路径；失败时非零退出 | **通过。** `packages/desktop/test/read-001.test.ts` 使用 `node:test` + `assert`（失败断言会以非零退出）。`pnpm --filter @bookskill/desktop test` 与 `pnpm --filter @bookskill/core test` 退出码均为 0。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/READ-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/desktop test
pnpm --filter @bookskill/core test
```

- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**22 passed，0 failed**（既有 16 项 + 本任务新增 6 项）。时间：2026-11-14 01:33:22 CST（Asia/Shanghai）。完整输出：`docs/read/pnpm-desktop-test-output.txt`
- `pnpm --filter @bookskill/core test`：退出码 **0**；**15 passed，0 failed**。时间：2026-11-14 01:33:31 CST（Asia/Shanghai）。完整输出：`docs/read/pnpm-core-test-output.txt`。core 源码无改动，既有导入 / 知识卡 / 路径 / 薄切片测试继续通过。

## 交付物路径

- `packages/desktop/src/renderer/read/**` — 阅读器类型、定位展示、摘录、书库列表、批注存储、HTML 视图
- `packages/desktop/test/read-001.test.ts` — 验收 1–5 自动化测试
- `packages/desktop/src/renderer/main.ts`、`styles.css` — 仅追加书库 / 阅读器接线与限定样式
- `packages/desktop/src/main/main.ts`、`preload.cjs` — 仅追加阅读器 IPC
- `packages/desktop/src/shared/navigation.ts` — 仅更新书库描述
- `packages/desktop/src/shared/shell-info.ts` — 追加桥接类型
- `docs/read/READ-001-REPORT.md`
- `docs/read/pull-request.md`
- `docs/read/pnpm-desktop-test-output.txt`
- `docs/read/pnpm-core-test-output.txt`

## 未解决风险

- **批注不在 SQLite 中。** 按工单不得改 `packages/data/**`、不得加迁移，因此批注走目录内 JSON。同书并发写入可能最后写入覆盖；进程在写文件中途崩溃可能得到不完整 JSON（下次加载会视为空列表，需重新摘录）。
- **书库列表是应用层只读 SQL。** core 没有 `listBooks`。查询与 `loadBook` 的列约定若在后续任务中变化，需要同步阅读器侧查询。
- **实机摘录依赖主进程 IPC。** 自动化测试覆盖 Node 侧定位 / 持久化 / HTML 渲染，没有跑完整 Electron 窗口点击。预加载与主进程已接线，但交互回归需独立 QA 在实机中点选确认。
- **字体未内置。** 阅读器声明 Instrument Sans 与 DM Mono，但 `index.html` 的 CSP（`style-src 'self'`、`connect-src 'none'`）不允许拉取外部字体；未安装这两款字体时会回退到系统字体，调色板与结构仍在。
- 本分支含 VERT-001 / IMPORT-001 历史，因为工单要求从 `origin/feat/VERT-001` @ `f109cd2` 起做。向 `integration` 晋升须等 P-002，本任务不合并，也不以 `integration` 或 `main` 为 PR 目标。
- 这不是 G1，也不是可安装发运包。

## 风险等级说明

**低/中（low/medium）。** 只追加阅读 UI、限定样式和 IPC，未改导入实现、知识卡或数据 schema。若后续要把批注迁入 SQLite，应由 Orchestrator 记入待决事项并由 DATA 线做迁移，届时风险应升为中/高。
