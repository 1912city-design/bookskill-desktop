# PR 草案：IMPORT-001 导入、去重、失败状态和重试

- 分支：`feat/IMPORT-001`
- 建议审阅基础：**`feat/VERT-001`**（使可审阅 diff 仅为本任务）。不要以 `main` 为目标。
- 类型：**中风险（medium）**。未改 schema 迁移；失败状态使用既有 `books.parse_status` 与库内 sidecar。
- 状态：本地草案，用于打开远端 PR。不要由本任务实现者合并。晋升到 `integration` 是 Orchestrator 按 D-025（CI + 独立 QA）在 VERT-001 具备资格后的工作。本分支包含 VERT-001 历史，因为工单要求以 `feat/VERT-001` @ `7cc95ee` 为基线。
- 未合入 `main` / `integration`，未发布。

## 改动摘要

在 `@bookskill/core` 上补齐许可 MD/TXT 导入，并以源文件 SHA-256（`content_hash`）识别重复导入，避免第二条独立书记录或第二个库目录。新的解析失败会持久化可查询的 `parse_status=failed` 行，并在 `{dataDir}/library/{bookId}/import-status.json` 写入错误详情（不写入 `title`），同时抛出带 `bookId` 的 `ImportParseError`；已有成功记录及其切片不被破坏。新增 `retryImport`、`listFailedImports`、`loadImportStatus`。成功路径的 `importBook()` 返回形状保持不变。

测试只使用 FIXT-001 许可夹具，以及写在 `os.tmpdir()` 中的合成损坏文件。未向仓库添加无授权整书，未改 FIXT-001 样本正文，未改 `packages/data/**` 或治理文件。

## 验收条件逐条结果

1. **通过。** 许可 PDF、EPUB、MD、TXT 可导入 BookSkill 自有库（`{dataDir}/library/{bookId}/`），能定位 `[P1.3]` 与 `[P2.2]`；路径不含 AnythingLLM / mintplex。
2. **通过。** 同一文件导入两次只保留一条 `books` 行和同一个 id；失败记录的相同字节也不会产生第二行。四种格式因哈希不同而互不视为重复。
3. **通过。** 失败会抛错，且有可查询的 `failed` 状态与 sidecar；已有成功书及其切片保持不变。
4. **通过。** 替换存储原件后重试成功会更新同一记录；重试仍失败或相邻成功记录均不被破坏。
5. **通过。** `pnpm --filter @bookskill/core test` 退出码 0（15 passed / 0 failed）。断言失败时 `node:test` 以非零退出。
6. **通过。** 仓库未新增无授权整书；`git diff -- fixtures` 为空；数据目录策略仍拒绝 AnythingLLM / mintplex 路径名。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/IMPORT-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/core test
```

- 退出码：**0**
- 结果：**15 passed，0 failed**
- 时间：2026-11-14 01:00:15 CST（Asia/Shanghai）
- 完整输出：`docs/import/pnpm-core-test-output.txt`
- 环境：Node v24.22.1，pnpm 10.34.6

实现提交：`bcd2bab1020dad03d7a1ff1c23d2f46bc2b80dfa`。

## 未解决风险

- 去重是应用层查询，没有 `content_hash` 唯一索引（有意避免 schema 迁移）。并发导入同一字节理论上可能插入两行。
- sidecar 与 SQLite 不是同一事务；崩溃窗口内失败行可能暂时缺少 error 正文，但 `parse_status=failed` 仍可查询。
- 解析器覆盖许可测试样本，不是通用书籍转换器。
- 向 `integration` 的晋升不在本 PR 范围内。

## 风险等级

**中（medium）。** 未新增 schema 迁移。若后续必须加迁移，应标为高风险，并由 Orchestrator 记入 `docs/PENDING_DECISIONS.md`。

## 建议审阅者

独立 QA 按 D-025 复核后，由 Orchestrator 决定是否在 VERT-001 具备资格后晋升到 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。
