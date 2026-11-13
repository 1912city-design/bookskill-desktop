# BookSkill Desktop 开发与 CI 说明

本文件给出在新环境中安装依赖、lint、单元测试和构建的可重复命令。这些命令已在本机（Linux x86_64，Node 22+ / 本机为 Node v24.22.1，pnpm 10.34.6）实际执行。

**当前范围（REPO-001）：** 产品侧仓库与 CI 基线，不是完整桌面安装包。V1 正式支持的目标平台是 Windows 11 x64 和 macOS 13+；Linux 开发构建可用于本机验证与 CI，但不因此成为 V1 正式支持。Windows / macOS 安装包属于后续 `PKG-001`。

**发布仓库尚未连接。** 本文中的 GitHub Actions workflow 已写入仓库，但远端 Actions 不会实际运行。不要把本地通过理解为“远端 CI 已绿”。

本构建骨架只使用 BookSkill 自己的数据目录解析逻辑（见 `@bookskill/repo-baseline`）。它不读取、不覆盖、不依赖 AnythingLLM 官方桌面数据目录，也不依赖先前官方容器 `books-distill-anythingllm` 中的用户数据。

## 前置要求

- Node.js 22 或更高（`engines.node` 为 `>=22`）
- pnpm 10.34.6（与根目录 `packageManager` 字段一致；可用 Corepack：`corepack enable && corepack prepare pnpm@10.34.6 --activate`）

克隆或进入仓库根目录后，在仓库根执行下列命令。

## 安装依赖

首次或依赖有变更时：

```bash
pnpm install
```

CI 与可复现安装（锁文件必须已提交）：

```bash
pnpm install --frozen-lockfile
```

## lint

```bash
pnpm lint
```

## 单元测试

```bash
pnpm test
```

该命令会先做一次对 `.github/workflows/ci.yml` 的静态检查（确认 `Test` 步骤执行 `pnpm test` 且没有 `continue-on-error: true`），再运行工作区内的单元测试。任一测试失败时，命令以非零退出码结束。

失败会让测试命令失败的证据见 `docs/repo/ci-fail-proof.log`。

## 构建

```bash
pnpm build
```

当前会编译 `packages/repo-baseline` 到该包的 `dist/`（构建产物不入库）。

## 本地一次性跑完与 CI 相同的步骤

```bash
pnpm ci
```

等价于 `scripts/ci-local.sh`：安装（优先 `--frozen-lockfile`）→ lint → test → build。这是 GitHub Actions 工作流的本地等价命令，不是远端 CI。

## GitHub Actions

工作流文件：`.github/workflows/ci.yml`。

- 触发：推送到 `main`、`integration`、`feat/**`，以及 pull request。
- Job：`lint, test, and build`（`lint-test-build`）。
- 步骤：`pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm test`、`pnpm build`。
- `pnpm test` 步骤没有 `continue-on-error`，单元测试失败时 job 失败。

在发布仓库连接并启用 Actions 之前，该工作流不会在 GitHub 上执行。

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
