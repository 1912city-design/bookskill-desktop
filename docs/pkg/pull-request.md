# PR 草案：PKG-001 未签名 macOS 13+ 开发样品打包

- 目标分支：`integration`（不是 `main`）
- 源分支：`feat/PKG-001`
- 标题：PKG-001: unsigned macOS 13+ development packaging (not an official release)

## 摘要

为 BookSkill Desktop 接上未签名 macOS 13+ 开发样品的打包路径：electron-builder 配置、`pack:mac` 脚本、文档，以及 `macos-15` GitHub Actions 工作流。当前 Linux 云电脑不能产出可用的 `.dmg` / `.app`；样品必须在 macOS 或该 Actions 作业中构建。

这不是正式发布，不是已签名 / 已公证的安装包，也未宣布 G1 通过。

## 为什么不能在 Linux 上打 macOS 包

electron-builder 要求 macOS 包装在 macOS 上运行。本环境缺失 `hdiutil`、`iconutil`、`xcodebuild`、`sw_vers`、`codesign`、`notarytool`、`security`、Apple 签名身份，以及 osxcross / darling。`pack:mac` 在非 darwin 主机上立即失败；`pack:dir` 仍只用于未签名 Linux 解包目录。

## 变更

- `packages/desktop/electron-builder.yml`：`appId=design.city1912.bookskill.desktop`，macOS 13+ universal `.dmg`/`.zip`（未签名、未公证），以及 Windows 11 x64 目标（配置完整，本 PR 样品只做 macOS）
- `packages/desktop/scripts/pack-macos.mjs`、`pack-windows.mjs`，`pack:mac` / `pack:win` 脚本；保留 `pack:dir`
- `electron-builder@26.18.0` 与更新后的锁文件
- `.github/workflows/macos-dev-build.yml`（不修改现有 ubuntu CI 作业）
- `docs/DEVELOPMENT.md`、`docs/pkg/**`、`packages/desktop/README.md`

## 验证

- Linux 上 `pnpm lint` / `pnpm test` / `pnpm build` / `pnpm --filter @bookskill/desktop test` 通过
- Linux 上 `pnpm --filter @bookskill/desktop pack:mac` 以退出码 1 失败，并列出精确缺失项
- 未签名 macOS 产物由 Actions `macos-dev-build` 作业或 macOS 13+ 机器生成

## 打开未签名样品

下载 artifact 或本地 `packages/desktop/out/` 中的 `.dmg` 后，在访达中右键 `BookSkill Desktop.app` 选择「打开」，或到「系统设置 → 隐私与安全性」允许这次打开。不要全局关闭 Gatekeeper。默认数据目录：`~/Library/Application Support/BookSkill Desktop`。可用 `BOOKSKILL_DATA_DIR` 做隔离试用。

## 不在本 PR 范围内

- 合入 `main` 或自行合并到 `integration`
- 正式发布、签名、公证
- 宣布 G1 通过
- 把签名私钥或公证凭据写入仓库
