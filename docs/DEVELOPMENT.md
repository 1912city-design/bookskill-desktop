# BookSkill Desktop 开发与 CI 说明

本文件给出在新环境中安装依赖、lint、单元测试和构建的可重复命令。下列命令已在本机实际执行（Linux x86_64，Node v24.22.1，pnpm 10.34.6，Asia/Shanghai）。

**当前范围：** 产品侧仓库与 CI 基线见本文 REPO-001 命令。V1 正式支持的目标平台是 Windows 11 x64 和 macOS 13+；Linux 可用于本机验证与 CI runner，但不因此成为 V1 正式支持。未签名 macOS 13+ 开发样品的打包路径见下方「打包（PKG-001）」；这不是正式发布，也不能单独宣布 G1 通过。

**发布仓库已连接：** https://github.com/1912city-design/bookskill-desktop 。不要把本地通过理解为“远端 CI 已绿”；以 GitHub Actions 实际运行结果为准。

本构建骨架只使用 BookSkill 自己的数据目录解析逻辑（见 `@bookskill/repo-baseline`）。它不读取、不覆盖、不依赖 AnythingLLM 官方桌面数据目录，也不依赖任何已运行的 AnythingLLM Docker 镜像或用户数据目录。

## 前置要求

- Node.js 22 或更高（`engines.node` 为 `>=22`；本机与 CI workflow 使用 Node 24）
- pnpm 10.34.6（与根目录 `packageManager` 字段一致；可用 Corepack：`corepack enable && corepack prepare pnpm@10.34.6 --activate`）
- REPO-001 的 lint / test / build 不需要 Electron，不需要已运行的 AnythingLLM 容器，也不需要用户数据目录。打包桌面样品（`pack:mac` / `pack:dir`）需要 Electron 二进制；见下方「打包（PKG-001）」

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

ubuntu `ci.yml` 的 lint / test / build 任务保持不变，不要改成 macOS 打包任务。本机没有安装 `act`；已用本地命令证明测试失败会非零退出，并用 `scripts/validate-ci-workflow.mjs` 与 Python `yaml.safe_load` 做了静态校验。远端是否已绿，以 GitHub Actions 实际运行结果为准。

## 数据目录（基线约定）

由 `packages/repo-baseline` 的 `resolveDataDir()` 约定，正式应用（`APP-001`）应沿用同一原则：

| 平台 | 默认目录 |
|---|---|
| Windows | `%APPDATA%\BookSkill Desktop` |
| macOS | `~/Library/Application Support/BookSkill Desktop` |
| Linux | `${XDG_DATA_HOME:-~/.local/share}/bookskill-desktop` |

可用环境变量 `BOOKSKILL_DATA_DIR` 覆盖；若覆盖路径指向 AnythingLLM 或相关目录，解析会失败，而不是静默使用上游数据。

## 打包（PKG-001）

这是未签名开发样品的打包路径，不是正式发布，也不是已签名 / 已公证的安装包。打出产物本身不能宣布 G1 通过；G1 还需要在目标 OS（macOS 13+ 或 Windows 11）上实际启动，并确认 BookSkill 数据目录隔离。

**结论：这台 Linux 云电脑不能产出可用的 macOS 13+ `.dmg` / `.app`。** electron-builder 要求 macOS 包装在 macOS 上进行。本机缺失 `hdiutil`、`iconutil`、`xcodebuild`、`sw_vers`、`codesign`、`notarytool`、`security`、Apple 签名身份，以及 osxcross / darling 等替代工具链（即使有也不作为可接受路径）。现有 `pnpm --filter @bookskill/desktop pack:dir` 只打未签名 Linux 解包目录，脚本自身已写明它不是 V1 Windows 11 / macOS 13+ 安装包。请继续保留该命令，不要用它冒充 macOS 样品。

配置与命令：

- 配置：`packages/desktop/electron-builder.yml`
- `appId`：`design.city1912.bookskill.desktop`（BookSkill 专用，不是 AnythingLLM）
- `productName`：BookSkill Desktop
- macOS：`minimumSystemVersion: "13.0"`，未签名（`mac.identity: null`，`CSC_IDENTITY_AUTO_DISCOVERY=false`），目标为 universal（x64+arm64）`.dmg` 与 `.zip`，产物名 `BookSkill-Desktop-${version}-macOS-${arch}.${ext}`
- Windows 11 x64 目标已写在同一配置中（NSIS + zip），但本任务的样品是 macOS；`pack:win` 在非 Windows 主机会立即失败
- 未启用公证，也未加入 Linux 作为 V1 正式目标

在 macOS 13+ 机器上（仓库根目录）：

```bash
pnpm install --frozen-lockfile
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @bookskill/desktop pack:mac
```

产物目录：`packages/desktop/out/`。打开未签名应用时，在访达中对 `BookSkill Desktop.app` 右键选择「打开」，或到「系统设置 → 隐私与安全性」允许这次打开。不要全局关闭 Gatekeeper。

GitHub Actions 工作流：`.github/workflows/macos-dev-build.yml`（`runs-on: macos-14`，`workflow_dispatch` / 向 `integration` 开 PR / 推送到 `feat/PKG-001` 或 `integration`）。远程成功只说明未签名开发样品已打出，不是 G1，也不是正式发布。

更完整的缺失项、限制和操作步骤见 `docs/pkg/MACOS-DEV-BUILD.md`。

## 分支保护

建议见 `docs/repo/BRANCH_PROTECTION.md`。远端未连接时，这些规则尚未在 GitHub 生效。
