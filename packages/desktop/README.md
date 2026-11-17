# @bookskill/desktop

BookSkill Desktop 的自有 Electron 壳与一级导航。这不是 AnythingLLM 官方桌面二进制的再包装，也不包含 AnythingLLM / Mintplex 的商标、图标或 wordmark。

当前本机（Linux x86_64 云电脑）只能做开发运行、冒烟，以及未签名的 Linux 解包目录构建。**不能**在这台 Linux 主机上交叉编译或产出可用的 macOS 13+ `.dmg` / `.app`。V1 目标 OS 是 Windows 11 x64 和 macOS 13+。**不能**据此宣布 G1 已通过。

- `pnpm pack:dir`：未签名的 Linux 解包目录，仅供本机开发，不是 V1 安装包，请继续保留。
- `pnpm pack:mac`：未签名的 macOS 13+ 开发样品（`.dmg` + `.zip`）。必须在 macOS 13+ 机器或 GitHub-hosted `macos-15` runner（macos-14 已退役）上执行。在 Linux 上会以退出码 1 立即失败，并列出精确缺失项。这不是正式发布，也不是已签名 / 已公证的安装包。
- `pnpm pack:win`：未签名的 Windows 11 x64 打包入口。必须在 Windows 上执行；在非 Windows 主机会以退出码 1 失败。

配置见 `electron-builder.yml`（`appId`: `design.city1912.bookskill.desktop`）。说明见 `docs/pkg/MACOS-DEV-BUILD.md`。

## 命令

在仓库根目录：

```bash
pnpm install
pnpm --filter @bookskill/desktop test
pnpm --filter @bookskill/desktop start
pnpm --filter @bookskill/desktop smoke
pnpm --filter @bookskill/desktop pack:dir
```

在 macOS 13+ 机器上打未签名开发样品（不要在 Linux 上运行并期待产物）：

```bash
pnpm install --frozen-lockfile
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @bookskill/desktop pack:mac
```

产物在 `packages/desktop/out/`，例如 `BookSkill-Desktop-0.0.0-macOS-universal.dmg`。未签名应用在 macOS 上需在访达中右键点「打开」，或到「系统设置 → 隐私与安全性」允许这次打开。不要全局关闭 Gatekeeper。

也可用 GitHub Actions 工作流 `.github/workflows/macos-dev-build.yml` 产出同样的未签名开发样品，再下载 artifact。远程成功只代表开发样品已打出，不是 G1，也不是正式发布。

可用 `BOOKSKILL_DATA_DIR` 指向临时目录做首次启动测试。路径若包含 `anythingllm`、`anything-llm` 或 `mintplex`，解析会失败，不会创建或覆盖该目录。

pnpm 10 可能跳过 `electron` 的安装脚本。`start` / `smoke` / `pack:dir` / `pack:mac` / `pack:win` 会通过 `scripts/ensure-electron.mjs` 在二进制缺失时调用官方 `install.js`。
