# REPO-001 交接报告

- 任务：仓库和 CI 基线
- 负责人：release_engineer
- 分支：`feat/REPO-001`
- 工作区：`/workspace/bookskill-worktrees/REPO-001`
- 完成时间：2026-11-13 17:17 Asia/Shanghai
- 状态：本地产物已完成并在分支上提交；**发布仓库尚未连接**，因此没有远端 PR、没有已运行的 GitHub Actions，也没有安装包发布

## 做了什么

在产品仓库中建立了可重复的 pnpm workspace 基线：

- 根目录 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.npmrc`（`engine-strict=true`）
- 基线包 `@bookskill/repo-baseline`：lint（ESLint）、单元测试（Node 测试运行器）、构建（`tsc`）
- `docs/DEVELOPMENT.md`：新环境安装依赖、lint、test、build 的命令
- `.github/workflows/ci.yml`：GitHub Actions 工作流；测试失败时 job 失败
- `docs/repo/BRANCH_PROTECTION.md`：分支保护建议（尚未在 GitHub 生效）
- `scripts/ci-local.sh` / `pnpm ci`：与 CI 步骤等价的本地命令
- `scripts/validate-ci-workflow.mjs`：静态检查 workflow 中的 `pnpm test` 步骤没有 `continue-on-error`

基线包提供 `resolveDataDir()`，按平台解析 BookSkill 自己的数据目录，并拒绝 AnythingLLM / mintplex 路径。它不读取、不覆盖、不依赖先前官方容器或官方桌面用户数据。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | `docs/DEVELOPMENT.md` 写清安装、lint、unit test、build 命令，且本机可执行 | **通过。** 本机于 2026-11-13 17:17 Asia/Shanghai 执行 `pnpm lint`、`pnpm test`、`pnpm build`，退出码均为 0。 |
| 2 | 至少一条会失败的单元测试使测试命令非零退出；修复后通过；留下两次运行日志 | **通过。** 见 `docs/repo/ci-fail-proof.log`。第一次 `pnpm test` 退出码 1（故意错误断言）；去掉/修正后退出码 0。 |
| 3 | 存在 CI workflow，测试失败时 job 失败；可用 act 或等效本地/静态校验；不得声称远端 CI 已绿 | **通过（本地/静态）。** 本机没有 `act`。`scripts/validate-ci-workflow.mjs` 确认 `.github/workflows/ci.yml` 的 Test 步骤执行 `pnpm test` 且未设置 `continue-on-error: true`。`pnpm test` 会先运行该检查。远端 Actions 未接通，**不能**称为已绿。 |
| 4 | 写出分支保护建议到 `docs/repo/BRANCH_PROTECTION.md`，远端未连接时仅作建议 | **通过。** 文档已写明规则尚未在 GitHub 生效。 |
| 5 | 构建骨架不得覆盖或依赖先前 AnythingLLM 容器中的用户数据目录 | **通过。** `resolveDataDir()` 默认使用 BookSkill 目录；`BOOKSKILL_DATA_DIR` 若指向 AnythingLLM 相关路径会抛错。单测覆盖 Linux / macOS / Windows 及拒绝上游路径。未访问运行中的 `books-distill-anythingllm` 容器。 |

## 测试命令及本机结果（2026-11-13 17:17 Asia/Shanghai）

```text
pnpm lint   → exit 0
pnpm test   → exit 0（7 passed, 0 failed；含 workflow 静态检查）
pnpm build  → exit 0
```

本机工具：Node v24.22.1，pnpm 10.34.6，Linux x86_64。CI 工作流使用 Node 22（符合 `engines.node: >=22`）。

故意失败证据：`docs/repo/ci-fail-proof.log`（第一次 exit 1，第二次/最终 exit 0）。

## 未解决风险

- **B-001：发布仓库尚未连接。** 不能开远端 PR、不能跑 GitHub Actions、不能启用分支保护。本任务在本地分支提交，并以 `docs/repo/pull-request.md` 作为 PR 草案。
- **B-003 / B-005：** 无代码签名证书；本机是 Linux，不是 V1 目标 OS。本任务只提供命令与 CI 骨架，不产出 Windows/macOS 安装包（属 PKG-001）。
- 工作流与分支保护在远端连接之前都不会实际生效。
- TypeScript 钉在 5.x：本机 `pnpm add typescript` 曾解析到 7.x，与当时的 `typescript-eslint` 8 同行版本不兼容，故锁定 5.9.x。

## 不在本任务范围

- 未推送、未开远端 PR、未合入 `main` 或 `integration`
- 未把 AnythingLLM 官方二进制当作构建产物
- 未读取密钥或用户书籍
- 未修改 GOV-001 / BOT-001 所有权下的目录，也未改 orchestrator 治理文件正文
