# IMPORT-001 交接报告

- 任务：在 VERT-001 薄切片之上，补齐 PDF/EPUB/MD/TXT 导入、去重、失败状态和重试，并留下可重复测试
- 负责人：backend_engineer（BookSkill Backend Engineer）
- 分支：`feat/IMPORT-001`
- 基础：`feat/VERT-001` @ `7cc95ee`
- 工作区：`/workspace/bookskill-worktrees/IMPORT-001`
- 完成时间：2026-11-14 01:00 Asia/Shanghai
- 实现提交：`3336bc4a5499f1ed20120d222b49f646216c3f7a`
- 状态：本地实现与测试已完成，并准备基于 `feat/VERT-001` 的远端 PR。**未合入 `main` / `integration`，未发布。** 合入按 D-025（CI + 独立 QA）由 Orchestrator 推进。
- 风险等级：**中（medium）**。未新增或修改 schema 迁移，沿用 schema v2 的 `books.parse_status`，失败详情写入库内 sidecar JSON。

## 做了什么

在 `@bookskill/core` 的既有导入路径上补齐 IMPORT-001，不改知识卡、阅读 UI、治理文件，也未改 `packages/data/**` 或 FIXT-001 样本正文。

- 扩展 `parseSource()`，为许可 MD / TXT 增加解析器（`packages/core/src/import/parse-markdown.ts`、`parse-txt.ts`）。文本仍走既有 `splitLocatedChunks`，可定位 `[P1.3]` 与 `[P2.2]`。MD/TXT 无作者字段，标题取自首个标题 / 首行，作者为 `null`。
- 以源文件字节的 SHA-256（`content_hash`）去重：同一文件再次导入返回已有 `ImportedBook`（同一 `id`），不插入第二条 `books` 行，不创建第二个 `library/{id}/` 目录。PDF/EPUB/MD/TXT 是不同字节，互不视为重复。
- 已存在且状态为 `failed` 的同一字节再次导入时，仍不创建第二行，而是返回该失败记录。重试是单独 API。
- 新解析失败时：把原文件复制到 `{dataDir}/library/{bookId}/`，在事务中写入 `parse_status=failed` 的 `books` 行（不写 `source_chunks`），并在同目录写入 `import-status.json`（至少含 `parseStatus`、`error`、`updatedAt`、`retryCount`），然后抛出带 `bookId` 的 `ImportParseError`。失败信息不写入 `title`。已有成功记录及其切片保持不变。
- 新增 `retryImport({ db, dataDir, bookId, now? })`：重读该行的 `file_path` 再解析。成功则更新同一 `book id` 为 `parsed`、写入切片并更新 sidecar；再次失败只更新 sidecar / `updated_at`，不删除或改动其他书及其切片。已是 `parsed` 的记录直接返回，不做破坏性重写。
- 新增可供后续 UI 调用的查询：`listFailedImports({ db, dataDir })`、`loadImportStatus({ db, dataDir, bookId })`（书行 + sidecar）。
- 成功路径的 `importBook()` 返回形状保持不变，因此 VERT-001 的 `workspace.importBook` 与既有 `import.test.ts` 无需改 `workspace.ts` 即可继续通过。
- 数据目录与库副本仍在 BookSkill 自有路径：业务库 `{dataDir}/db/bookskill.sqlite`，原件 `{dataDir}/library/{bookId}/`。测试断言路径含 `library` 且不含 `anythingllm|mintplex`。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 能导入 FIXT-001（或同等许可）中的 PDF、EPUB、MD、TXT，并写入 BookSkill 自有库，而不是 AnythingLLM 内部库 | **通过。** 既有 EPUB/PDF 测试继续通过。新增测试导入许可 MD/TXT，标题为 `BookSkill Test Primer`，作者为 `null`，可定位 `[P1.3]` 与 `[P2.2]`，`parseStatus=parsed`，`filePath` 位于 `{dataDir}/library/{bookId}/`，且不匹配 `anythingllm\|mintplex`。 |
| 2 | 对同一文件的重复导入可被识别（不产生第二条独立书记录，或明确标记为重复）；测试必须覆盖此路径 | **通过。** 同一 Markdown 文件导入两次，仍只有一条 `books` 行、同一 `id`、同一 `library/{id}/` 目录。失败记录的相同字节再次导入也不会产生第二行。PDF/EPUB/MD/TXT 四种 primer 因哈希不同而记为四本独立书。 |
| 3 | 导入失败时有持久化的失败状态（可查询、可展示给后续 UI），且不会写坏已存在的书库数据 | **通过。** 空/损坏 MD 与截断 PDF 会抛出 `ImportParseError`（含 `bookId`）；`books.parse_status=failed` 可查询；`import-status.json` 含错误信息；`listFailedImports` / `loadImportStatus` 可读。同一库中已导入成功的书及其切片、状态保持不变。失败项标题为源文件名，错误不写入 `title`。 |
| 4 | 失败项可以重试；重试成功后状态更新，已有成功记录保持不变 | **通过。** 将失败项的存储原件替换为许可 MD 后 `retryImport` 成功：同一 `id` 变为 `parsed`，出现 `[P1.3]` / `[P2.2]` 切片，sidecar 清除 error。相邻已成功的 PDF/EPUB 书的 id、哈希、切片保持不变。重试仍失败时，该行保持 `failed`，兄弟记录不被改动。 |
| 5 | 相关单测在失败断言时以非零退出码失败；修复后 `pnpm --filter @bookskill/core test` 退出码 0 | **通过。** 测试使用 `node:test` 的 `assert`（失败断言会以非零退出）。修复后该命令退出码 0。见下方测试结果。 |
| 6 | 仓库中不新增无授权整书。数据目录继续拒绝 AnythingLLM / mintplex 路径名 | **通过。** 未向仓库添加任何新书样本；测试中的损坏文件只写在 `os.tmpdir()`。`git diff -- fixtures` 为空。既有路径策略测试仍拒绝 AnythingLLM / mintplex 数据目录；导入路径断言不含这些名字。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/IMPORT-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
```

- 退出码：**0**
- 结果：**15 passed，0 failed**（既有 6 项 + 本任务新增 9 项）
- 时间：2026-11-14 01:00:15 CST（Asia/Shanghai）
- 完整输出：`docs/import/pnpm-core-test-output.txt`

既有 `import.test.ts`（EPUB/PDF 定位）、`knowledge.test.ts`、`paths.test.ts`、`slice.test.ts` 全部继续通过。

## 交付物路径

- `packages/core/src/import-book.ts` — 去重、失败持久化、`retryImport`、MD/TXT `parseSource`
- `packages/core/src/import/parse-markdown.ts`、`parse-txt.ts`、`status.ts` — 解析器、sidecar、失败查询、`ImportParseError`
- `packages/core/src/index.ts` — 仅追加本任务导出
- `packages/core/test/helpers.ts` — 追加 MD/TXT 夹具路径常量
- `packages/core/test/import-pipeline.test.ts` — MD/TXT 导入、去重、失败、重试
- `docs/import/IMPORT-001-REPORT.md`
- `docs/import/pull-request.md`
- `docs/import/pnpm-core-test-output.txt`

未修改：`packages/data/**`、治理文件、FIXT-001 样本正文、`workspace.ts` / `types.ts` / `constants.ts`、知识卡与阅读 UI。

## 未解决风险

- **应用层去重，无 `content_hash` 唯一索引。** 为避免本任务改 schema（DATA-001 拥有 `packages/data/**`，且会把本 PR 升为高风险），去重依赖导入前的 `SELECT`。并发导入同一字节在理论上可能插入两行。若后续要加唯一索引，应由 Orchestrator 记入 `docs/PENDING_DECISIONS.md` 并由 DATA-001 做迁移。
- **sidecar 与 SQLite 非同一事务。** 书行已提交但进程在写 `import-status.json` 前崩溃时，失败行仍可按 `parse_status=failed` 查询，只是可能暂时没有 `error` 正文。
- 轻量解析器覆盖许可测试样本与合成损坏文件，不覆盖所有真实书籍格式。
- 本分支含 VERT-001 历史，因为工单要求从 `feat/VERT-001` 起做。向 `integration` 晋升是 Orchestrator 在 VERT-001 具备资格后按 D-025 处理的工作，本任务不合并。

## 风险等级说明

**中（medium）。** 未新增或修改 schema 迁移，因此无需改 `docs/PENDING_DECISIONS.md`（该文件由 Orchestrator 持有，本任务也禁止写入）。若将来被迫加迁移，风险应升为 **高**，并由 Orchestrator 记录。
