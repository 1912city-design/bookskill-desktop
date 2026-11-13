# DATA-001 交接报告

- 任务：本地 schema 与迁移
- 负责人：backend_engineer
- 分支：`feat/DATA-001`
- 工作区：`/workspace/bookskill-worktrees/DATA-001`
- 完成时间：2026-11-13 17:26 Asia/Shanghai
- 状态：本地产物已完成并将在本分支提交；**发布仓库尚未连接**，因此没有远端 PR，也没有合入 `main` / `integration`

## 做了什么

新增 `@bookskill/data` 包（`packages/data`），用 Node.js 内置 `node:sqlite` 实现 BookSkill 自有业务库，而不是 AnythingLLM 内部数据库。

- 合同第 3.1 节全部 15 个对象都有表，主键为 UUID（`TEXT` + CHECK）
- 轻量迁移器：`schema_migrations` 记录版本；内置两次真实迁移
  - **v1 (`create_core_tables`)**：创建全部核心表、外键和常用索引
  - **v2 (`add_source_chunks_ordinal`)**：为 `source_chunks` 增加 `ordinal INTEGER NOT NULL DEFAULT 0` 及 `(book_id, ordinal)` 索引（真实 N→N+1，不是空跳转）
- 迁移前对已有库做文件级备份（`VACUUM INTO` 到 `db/backups/`）；失败则恢复备份，数据与失败前一致
- 业务库路径由 `@bookskill/repo-baseline` 的 `resolveDataDir()` 决定，固定为 `{dataDir}/db/bookskill.sqlite`；AnythingLLM / mintplex 路径会被拒绝

本包测试使用 Node 24 的 TypeScript type stripping，不新增 npm 注册表依赖，也未改根目录 `package.json`、`pnpm-workspace.yaml` 或 `pnpm-lock.yaml`。源码通过相对路径调用 `packages/repo-baseline/src/data-dir.ts` 的 `resolveDataDir()`。

未导入测试书样（属 VERT-001）；本任务只覆盖 schema、迁移和备份/恢复基础测试。未联网，未读取密钥。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 合同列出的对象均有表与 UUID 主键，并有迁移脚本 | **通过。** 15 张核心表均有 `id TEXT PRIMARY KEY` 及 UUID CHECK。迁移脚本：`packages/data/src/migrations.ts`。 |
| 2 | 从版本 N 迁移到 N+1 后旧数据可读取（真实二次迁移） | **通过。** 先只应用 v1 并写入书籍/切片，再迁移到 v2；旧行仍可按原文和 hash 读出，`ordinal` 默认为 0。 |
| 3 | 故意失败的迁移会恢复备份，数据与失败前一致 | **通过。** 注入 v3 迁移：加列、改标题后抛错。捕获 `MigrationError` 后库版本仍为 2，标题未被改写，没有 `scratch` 列，全库 dump 与失败前一致。 |
| 4 | 业务库路径位于 BookSkill 数据目录，而不是 AnythingLLM 存储路径 | **通过。** 默认路径在 BookSkill 数据目录下的 `db/bookskill.sqlite`；`BOOKSKILL_DATA_DIR` 指向 AnythingLLM 相关路径时抛错且不创建文件。 |

## 库文件路径策略

`resolveBusinessDbPath()` 调用 `resolveDataDir()`，再拼接 `db/bookskill.sqlite`：

| 平台 | 默认业务库路径 |
|---|---|
| Windows | `%APPDATA%\BookSkill Desktop\db\bookskill.sqlite` |
| macOS | `~/Library/Application Support/BookSkill Desktop/db/bookskill.sqlite` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/bookskill-desktop/db/bookskill.sqlite` |

可用 `BOOKSKILL_DATA_DIR` 覆盖数据根目录。覆盖路径若包含 `anythingllm`、`anything-llm` 或 `mintplex`，解析与迁移都会失败，不会在上游存储里建库。业务库是 source of truth；向量索引和缓存不在本任务范围。

当前 schema 版本：**2**（v1 → v2）。

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/DATA-001` 执行：

```bash
pnpm --filter @bookskill/data test
```

- 退出码：**0**
- 结果：11 passed，0 failed
- 时间：2026-11-13 17:26 Asia/Shanghai（CST）
- 环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64
- 完整输出：`docs/data/pnpm-test-output.txt`（根 `.gitignore` 忽略 `*.log`，故使用 `.txt` 保存证据）

## 交付物路径

- `packages/data/src/` — 路径解析、迁移脚本、迁移器、备份恢复
- `packages/data/test/` — schema、N→N+1 迁移、失败恢复、路径策略测试
- `packages/data/package.json` — 包名 `@bookskill/data`，测试脚本如上
- `docs/data/DATA-001-REPORT.md`
- `docs/data/pull-request.md`
- `docs/data/pnpm-test-output.txt`

## Git 提交

见 `feat/DATA-001` 分支 tip（提交后记录；未推送，未开远端 PR，未合入 `main` / `integration`）。

## 未解决风险 / BLOCKED

- **B-001：发布仓库尚未连接（仅阻塞远端步骤）。** 不能开远端 PR、不能跑 GitHub Actions。本地 schema/迁移测试已通过，不阻塞后续本地切片（VERT-001）在本 worktree 之外继续。
- 根目录测试/lint/build 脚本仍只指向 `@bookskill/repo-baseline`（本任务不得修改根 `package.json`）。集成方后续可将 `@bookskill/data` 纳入仓库级 `pnpm test` 并更新 lockfile。
- 数据迁移属高风险变更，合入 `integration` 前需人工确认，不得自动合并。

## 不在本任务范围

- 未推送、未开远端 PR、未合入 `main` 或 `integration`
- 未把 AnythingLLM 内部库当作业务数据源，未读取密钥或用户书籍
- 未导入 FIXT-001 测试书样（属 VERT-001）
- 未实现完整导出包、WebDAV/S3 同步（BACKUP-001 / SYNC-001）
- 未修改根 `package.json`、`pnpm-workspace.yaml`、`packages/desktop/**`、`packages/repo-baseline/**`、`.bookskill/**`、`.github/**` 或治理文件
