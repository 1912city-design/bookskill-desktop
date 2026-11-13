# PR 草案：DATA-001 本地 schema 与迁移

- 分支：`feat/DATA-001` → 目标分支（仓库连接后）：`integration`
- 类型：**高风险**（数据迁移）。按执行合同，CI 与独立 QA 通过后仍需人工确认，不得自动合入。
- 状态：**仅本地草案。** 发布仓库尚未连接，本文不是已提交的 GitHub Pull Request。不要推送、不要打开远端 PR、不要合入 `main` 或 `integration`。

## 改动摘要

新增 `@bookskill/data`：BookSkill 自有 SQLite 业务库（source of truth）、第 3.1 节全部核心表、v1→v2 真实迁移，以及迁移失败时的备份恢复。业务库位于 BookSkill 数据目录 `{dataDir}/db/bookskill.sqlite`，明确拒绝 AnythingLLM 存储路径。使用 Node 内置 `node:sqlite`，无新的注册表依赖。

## 验收条件逐条结果

1. 15 个合同对象均有表与 UUID 主键，迁移脚本在 `packages/data/src/migrations.ts`。
2. 从 v1 迁移到 v2 后，旧的 `books` / `source_chunks` 行可按原文读取；v2 为已有切片补上 `ordinal = 0`。
3. 故意失败的 v3 迁移会恢复备份，数据、列和 schema 版本与失败前一致。
4. 业务库只写在 BookSkill 数据目录；AnythingLLM 路径会被拒绝且不建库。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/DATA-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/data test    # exit 0, 11 passed / 0 failed, 2026-11-13 17:26 CST
```

完整输出：`docs/data/pnpm-test-output.txt`。Node v24.22.1，pnpm 10.34.6。

当前迁移版本：v1 `create_core_tables`，v2 `add_source_chunks_ordinal`（当前版本 = 2）。

## 未解决风险

- 发布仓库未连接（B-001）：无法开远端 PR 或跑 GitHub Actions。
- 根目录 `pnpm test` 尚未包含本包（受任务写权限限制，未改根 `package.json` / lockfile）。
- 数据迁移需人工批准后才能合入 `integration`。

## 建议审阅者

连接远端仓库后，由独立 `qa_security` 复核，再由负责人人工确认合入 `integration`。不要由本任务实现者自行合并，也不要直接合入 `main`。
