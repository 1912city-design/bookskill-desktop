# BookSkill Desktop 开发与 CI 说明

本文件给出在新环境中安装依赖、lint、单元测试和构建的可重复命令。下列命令已在本机实际执行（Linux x86_64，Node v24.22.1，pnpm 10.34.6，Asia/Shanghai）。

**当前范围（REPO-001）：** 产品侧仓库与 CI 基线，不是完整桌面安装包。V1 正式支持的目标平台是 Windows 11 x64 和 macOS 13+；Linux 可用于本机验证与 CI runner，但不因此成为 V1 正式支持。Windows / macOS 安装包属于后续 `PKG-001`。

**发布仓库尚未连接。** `.github/workflows/ci.yml` 已写入仓库，但远端 GitHub Actions 不会实际运行。不要把本地通过理解为“远端 CI 已绿”。

本构建骨架只使用 BookSkill 自己的数据目录解析逻辑（见 `@bookskill/repo-baseline`）。它不读取、不覆盖、不依赖 AnythingLLM 官方桌面数据目录，也不依赖任何已运行的 AnythingLLM Docker 镜像或用户数据目录。

## 前置要求

- Node.js 22 或更高（`engines.node` 为 `>=22`；本机与 CI workflow 使用 Node 24）
- pnpm 10.34.6（与根目录 `packageManager` 字段一致；可用 Corepack：`corepack enable && corepack prepare pnpm@10.34.6 --activate`）
- 不需要 Electron，不需要已运行的 AnythingLLM 容器，也不需要用户数据目录

进入仓库根目录后执行下列命令。

## 安装依赖

首次或依赖有变更时：

```bash
pnpm install
```

CI 与可复现安装（锁文件必须已提交）：

```bash
pnpm install --frozen-lockfile
```

本机实测：`pnpm install --frozen-lockfile` 退出码 0。日志：`docs/repo/pnpm-install.log`。

## lint

```bash
pnpm lint
```

运行 `@bookskill/repo-baseline` 的 ESLint。本机实测退出码 0。日志：`docs/repo/pnpm-lint.log`。

## 单元测试

```bash
pnpm test
```

该命令会先运行 `scripts/validate-ci-workflow.mjs`，静态确认 `.github/workflows/ci.yml` 中存在执行 `pnpm test` 的步骤且没有 `continue-on-error: true`，再构建并运行 `@bookskill/repo-baseline` 的 Node 内置测试运行器用例。任一测试失败时，命令以非零退出码结束。

本机实测（修复故意失败用例后）退出码 0，7 passed / 0 failed。日志：`docs/repo/pnpm-test.log`、`docs/repo/ci-pass-proof.log`。

故意失败会使测试命令失败的证据见 `docs/repo/ci-fail-proof.log`（退出码 1）。

## 构建

```bash
pnpm build
```

使用 `tsc -p tsconfig.build.json` 编译 `packages/repo-baseline` 到该包的 `dist/`（构建产物不入库）。本机实测退出码 0。日志：`docs/repo/pnpm-build.log`。

## 本地一次性跑完与 CI 相同的步骤

**不要使用 `pnpm ci`。** 这是 pnpm 预留命令，本机实测报 `ERR_PNPM_CI_NOT_IMPLEMENTED`，不会执行仓库里的脚本。

请使用：

```bash
pnpm run local-ci
# 或
bash scripts/ci-local.sh
```

顺序：安装（优先 `--frozen-lockfile`）→ lint → test → build。这是 GitHub Actions 工作流的本地等价命令，不是远端 CI。本机实测退出码 0。日志：`docs/repo/local-ci.log`。

## GitHub Actions

工作流文件：`.github/workflows/ci.yml`。

- 触发：推送到 `main`、`integration`、`feat/**`，以及 pull request；也允许 `workflow_dispatch`。
- Job 名称：`lint, test, and build`（id：`lint-test-build`），`runs-on: ubuntu-latest`。
- 环境：pnpm 10.34.6，Node 24。
- 步骤：`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`、`pnpm build`。
- 名为 `Test` 的步骤运行 `pnpm test`，没有 `continue-on-error`，因此单元测试失败时 job 失败。

本机没有安装 `act`，未用 GitHub Actions 实际跑过该 workflow。已用本地命令证明测试失败会非零退出，并用 `scripts/validate-ci-workflow.mjs` 与 Python `yaml.safe_load` 做了静态校验。在发布仓库连接并启用 Actions 之前，不得声称远端 CI 已绿。

## 数据目录（基线约定）

由 `packages/repo-baseline` 的 `resolveDataDir()` 约定，正式应用（`APP-001`）应沿用同一原则：

| 平台 | 默认目录 |
|---|---|
| Windows | `%APPDATA%\BookSkill Desktop` |
| macOS | `~/Library/Application Support/BookSkill Desktop` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/bookskill-desktop` |

可用环境变量 `BOOKSKILL_DATA_DIR` 覆盖；若覆盖路径指向 AnythingLLM 或相关目录，解析会失败，而不是静默使用上游数据。

## 分支保护

建议见 `docs/repo/BRANCH_PROTECTION.md`。远端未连接时，这些规则尚未在 GitHub 生效。
