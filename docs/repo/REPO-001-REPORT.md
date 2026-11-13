# REPO-001 交接报告

- 任务：仓库和 CI 基线
- 负责人：release_engineer
- 分支：`feat/REPO-001`
- 工作区：`/workspace/bookskill-worktrees/REPO-001`
- 完成时间：2026-11-13 17:20 Asia/Shanghai
- 状态：本地产物已完成并在分支上提交；**发布仓库尚未连接**，因此没有远端 PR、没有已运行的 GitHub Actions，也没有安装包发布

## 做了什么

在产品仓库中建立了可重复的 pnpm workspace 基线：

- 根目录 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`.npmrc`（`engine-strict=true`）
- 基线包 `@bookskill/repo-baseline`：lint（ESLint）、单元测试（Node.js 内置测试运行器）、构建（`tsc`）
- `docs/DEVELOPMENT.md`：新环境安装依赖、lint、test、build 的命令（以本机实测为准）
- `.github/workflows/ci.yml`：GitHub Actions 工作流；测试失败时 job 失败
- `docs/repo/BRANCH_PROTECTION.md`：分支保护建议（尚未在 GitHub 生效）
- `scripts/ci-local.sh` / `pnpm run local-ci`：与 CI 步骤等价的本地命令（**不要**使用 `pnpm ci`，那是 pnpm 预留命令，本机报 `ERR_PNPM_CI_NOT_IMPLEMENTED`）
- `scripts/validate-ci-workflow.mjs`：静态检查 workflow 中的 `pnpm test` 步骤没有 `continue-on-error`

基线包提供 `resolveDataDir()`，按平台解析 BookSkill 自己的数据目录，并拒绝 AnythingLLM / mintplex 路径。它不读取、不覆盖、不依赖先前官方容器或官方桌面用户数据。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | `docs/DEVELOPMENT.md` 写清安装、lint、unit test、build 命令，且本机可执行 | **通过。** 本机执行命令与退出码见下表。 |
| 2 | 至少一条会失败的单元测试使测试命令非零退出；修复后通过；留下两次运行日志 | **通过。** 故意把 `PRODUCT_DATA_DIR_NAME_UNIX` 的期望写成 `anythingllm` 后，`pnpm test` 退出码 1；修正为 `bookskill-desktop` 后退出码 0。失败日志：`docs/repo/ci-fail-proof.log`。通过日志：`docs/repo/ci-pass-proof.log`。 |
| 3 | 存在 CI workflow，测试失败时 job 失败；可用 act 或等效本地/静态校验；不得声称远端 CI 已绿 | **通过（本地/静态）。** 本机没有 `act`。`scripts/validate-ci-workflow.mjs` 确认 `.github/workflows/ci.yml` 的 Test 步骤执行 `pnpm test` 且未设置 `continue-on-error: true`。另用 Python `yaml.safe_load` 解析 workflow。`pnpm test` 会先运行该静态检查。远端 Actions 未接通，**不能**称为已绿。 |
| 4 | 写出分支保护建议到 `docs/repo/BRANCH_PROTECTION.md`，远端未连接时仅作建议 | **通过。** 文档已写明规则尚未在 GitHub 生效。 |
| 5 | 构建骨架不得覆盖或依赖先前 AnythingLLM 容器中的用户数据目录 | **通过。** `resolveDataDir()` 默认使用 BookSkill 目录；`BOOKSKILL_DATA_DIR` 若指向 AnythingLLM 相关路径会抛错。单测覆盖 Linux / macOS / Windows 及拒绝上游路径。未访问任何 AnythingLLM 容器或用户数据目录。 |

## 测试命令及本机结果（Asia/Shanghai）

本机工具：Node v24.22.1，pnpm 10.34.6，Linux x86_64。CI workflow 使用 Node 24 与 pnpm 10.34.6（`engines.node` 为 `>=22`）。

| 命令 | 退出码 | 日志 | 时间 |
|---|---|---|---|
| `pnpm install --frozen-lockfile` | 0 | `docs/repo/pnpm-install.log` | 2026-11-13 17:16:57 CST |
| `pnpm lint` | 0 | `docs/repo/pnpm-lint.log` | 2026-11-13 17:17:49 CST（修复用例后的最终跑） |
| `pnpm test`（故意失败用例） | 1 | `docs/repo/ci-fail-proof.log` | 2026-11-13 17:17:24 CST |
| `pnpm test`（修复后） | 0（7 passed, 0 failed；含 workflow 静态检查） | `docs/repo/ci-pass-proof.log`、`docs/repo/pnpm-test.log` | 2026-11-13 17:17:31 CST |
| `pnpm build` | 0 | `docs/repo/pnpm-build.log` | 2026-11-13 17:17:35 CST |
| `bash scripts/ci-local.sh`（或 `pnpm run local-ci`） | 0 | `docs/repo/local-ci.log` | 2026-11-13 17:18:04 CST |

## Git 提交

- 初始基线：`adfa28ceed0a27b8536ea5025b64543b42c7226b`（`feat(repo): add install, lint, test, and CI baseline`）
- 更正提交：`1b7c49094a7fc7d54cd7897e75513a5d36bc523d`（`fix(repo): split CI proof logs and correct local-ci command`）
- 分支：`feat/REPO-001`（未推送，未开远端 PR，未合入 `main` / `integration`）

## 未解决风险 / BLOCKED

- **B-001：发布仓库尚未连接（BLOCKED 仅针对远端步骤）。** 不能开远端 PR、不能跑 GitHub Actions、不能启用分支保护。本地安装/lint/test/build 已通过，不阻塞 GOV-001 / BOT-001。本任务在本地分支提交，并以 `docs/repo/pull-request.md` 作为 PR 草案。
- 本机没有 `act`，因此未做 workflow 的容器级回放；已用本地测试失败非零退出 + workflow 静态校验代替。
- **B-003 / B-005：** 无代码签名证书；本机是 Linux，不是 V1 目标 OS。本任务只提供命令与 CI 骨架，不产出 Windows/macOS 安装包（属 PKG-001）。
- TypeScript 锁定在 5.9.x，以兼容当前 `typescript-eslint` 8。
- 工作流与分支保护在远端连接之前都不会实际生效。

## 不在本任务范围

- 未推送、未开远端 PR、未合入 `main` 或 `integration`
- 未把 AnythingLLM 官方二进制当作构建产物
- 未读取密钥或用户书籍
- 未修改 GOV-001 / BOT-001 所有权下的目录，也未改 orchestrator 治理文件正文
