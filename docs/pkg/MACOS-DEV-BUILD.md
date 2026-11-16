# 未签名 macOS 13+ 开发构建说明（PKG-001）

本文说明如何为 BookSkill Desktop 产出可给项目负责人本机试用的 **未签名** macOS 13+ 开发样品。这不是正式发布，不是已签名 / 已公证的安装包，也不能单独宣布 G1 通过。

## 结论

**不能**在当前 Linux 云电脑（`grok-bot-vm-467333429`，Linux x86_64）上交叉编译或产出可用的 macOS 13+ `.dmg` / `.app`。

官方 electron-builder 规则：macOS 的 DMG / `.app` 包装必须在 macOS 上运行。现有 `packages/desktop/scripts/pack-dir.mjs` 写死 `platform: "linux"` / `arch: "x64"`，脚本自身已写明它不是 V1 Windows 11 / macOS 13+ 安装包。禁止用 Linux 目录构建或浏览器原型代替 macOS 样品。

`pnpm --filter @bookskill/desktop pack:mac` 在非 darwin 主机上会立即以退出码 1 失败，并打印下列缺失项，不会尝试打假 DMG。本机已按此验证。

## 精确缺失项

当前 Linux 环境缺失：

- macOS 13+ 机器，或 GitHub-hosted `macos-14+` runner
- Xcode Command Line Tools（`xcodebuild`）
- `hdiutil`（制作 `.dmg` 所必需）
- `iconutil`（将 `packages/desktop/resources/icon.png` 转为 `.icns` 所必需）
- `sw_vers` / macOS SDK
- `codesign`、`notarytool`（仅已签名 / 已公证的正式构建才需要；本未签名开发样品不使用）
- `security` 以及 Apple Developer ID Application 证书、公证凭据（当前均不存在；B-003 / P-005）。正式签名安装包在证书到位且人工批准发布之前保持阻塞
- `osxcross`、`darling`、`lipo`、`pkgbuild`、`productbuild` 等 Linux 侧 macOS 工具链（本机没有，也不是可接受的替代路径）

## 配置位置

- 打包配置：`packages/desktop/electron-builder.yml`
- `appId`：`design.city1912.bookskill.desktop`（BookSkill 专用，不是 AnythingLLM / Mintplex）
- `productName`：BookSkill Desktop
- `mac.minimumSystemVersion`：`"13.0"`
- 未签名：`mac.identity: null`；脚本与 Actions 均设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`
- 未启用公证（`mac.notarize: false`，并以 `--publish never` 禁止自动发布）
- mac 目标：universal（x64 + arm64）`.dmg` 与 `.zip`，便于负责人在 Intel 或 Apple Silicon 上试用。若 runner 上 universal 构建失败，再改为分别打 arm64 与 x64，并更新本文
- 图标：`packages/desktop/resources/icon.png`（`.icns` 转换只在 macOS 上进行）
- 打包文件：仅 `dist/**` 与 `package.json`（esbuild 已把工作区依赖打进 `dist/`）；不打包 `src/`、测试或整个 monorepo
- 同一配置含 Windows 11 x64 的 NSIS 与 zip 目标；本任务样品只做 macOS。Linux 不是 V1 正式目标，配置中未声明
- 产物名：`BookSkill-Desktop-${version}-macOS-${arch}.${ext}`（universal 时 arch 为 `universal`）
- 输出目录：`packages/desktop/out/`（不入库）

## 在 macOS 13+ 机器上的命令

在仓库根目录：

```bash
pnpm install --frozen-lockfile
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @bookskill/desktop pack:mac
```

成功后查看：

```bash
ls -la packages/desktop/out/*.dmg packages/desktop/out/*.zip
shasum -a 256 packages/desktop/out/*.dmg packages/desktop/out/*.zip
```

预期产物示例（版本目前为 `0.0.0`）：

- `packages/desktop/out/BookSkill-Desktop-0.0.0-macOS-universal.dmg`
- `packages/desktop/out/BookSkill-Desktop-0.0.0-macOS-universal.zip`

不要在 Linux 上运行上述打包命令并期待产物。本机验证：该命令退出码为 1，日志见 `docs/pkg/pack-macos-linux-reject.log`。

保留现有 Linux 解包目录命令（不是 macOS 样品）：

```bash
pnpm --filter @bookskill/desktop pack:dir
```

## 未签名应用在 macOS 上的打开方式

这是未签名、未公证的开发样品。Gatekeeper 会拦截普通双击。请使用下面任一方式，**不要全局关闭 Gatekeeper**：

1. 在访达中打开 DMG，将 `BookSkill Desktop.app` 拖到「应用程序」或任意目录后，**右键该应用 → 打开**，在提示中确认打开。
2. 若仍被拦截：打开「系统设置 → 隐私与安全性」，在被拦截记录处选择允许这次打开。

启动后，默认数据目录是 `~/Library/Application Support/BookSkill Desktop`。可用环境变量 `BOOKSKILL_DATA_DIR` 指向一个临时目录做隔离试用。路径若包含 `anythingllm`、`anything-llm` 或 `mintplex`，解析会失败，不会创建或覆盖该目录。

## GitHub Actions

工作流：`.github/workflows/macos-dev-build.yml`，名称「Unsigned macOS 13+ development build」。

- `runs-on: macos-14`（在 14/15 上构建可以，只要 `minimumSystemVersion` 仍是 `13.0`）
- 触发：`workflow_dispatch`、向 `integration` 开 pull request、推送到 `feat/PKG-001` 或 `integration`
- 现有 ubuntu `ci.yml` 的 lint / test / build 任务保持不变
- 作业环境设置 `CSC_IDENTITY_AUTO_DISCOVERY=false`
- 步骤：checkout、pnpm 10.34.6、Node 24、`pnpm install --frozen-lockfile`、`pnpm --filter @bookskill/desktop pack:mac`
- 上传 `packages/desktop/out/` 下的 `.dmg` 与 `.zip`，artifact 名：`BookSkill-Desktop-macOS-dev-unsigned`（不含未打包目录、`mac-arm64` 文件夹或 builder 缓存）

远程成功只代表未签名开发样品已打出，不是 G1，也不是正式发布。

手动触发（在已推送的 `feat/PKG-001` 上）：

```bash
gh workflow run macos-dev-build.yml --ref feat/PKG-001
```

## 已知限制

- 未签名、未公证；macOS 会显示开发者身份未知
- 不是正式发布，不得把它当作可分发给最终用户的安装包
- 证书仍未配置（B-003 / P-005），正式签名安装包仍被阻塞，需要证书与人工批准
- 打出产物 ≠ G1。G1 要求至少在一个目标 OS 上实际启动，并确认 BookSkill 数据目录隔离
- 本 Linux 环境不能本地验收 `.app` 能否启动
- Windows 11 x64 配置已就绪，但本任务不在 Linux 上打 Windows 包
