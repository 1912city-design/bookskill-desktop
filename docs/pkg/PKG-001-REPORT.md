# PKG-001 报告：未签名 macOS 13+ 开发样品打包路径

状态：已在 `feat/PKG-001` 提交打包配置、脚本、文档与 GitHub Actions 工作流，并向 `integration` 打开 PR。这是未签名开发样品路径，**不是正式发布，也未宣布 G1 通过**。

时间：2026-11-16（Asia/Shanghai）。主机：Linux x86_64 `grok-bot-vm-467333429`。

## 结论

**不能**在这台 Linux 云电脑上产出可用的 macOS 13+ `.dmg` / `.app`。

官方 electron-builder 规则：macOS DMG / `.app` 包装必须在 macOS 上运行。本机已确认缺失：`hdiutil`、`codesign`、`notarytool`、`xcodebuild`、`sw_vers`、`iconutil`、`security`、`lipo`、`pkgbuild`、`productbuild`、`osxcross`、`darling`，以及任何 Apple 签名身份。现有 `pack:dir` 写死 Linux x64 解包目录，脚本自身已写明它不是 V1 目标 OS 安装包。未尝试在 Linux 上打假 DMG，也未用浏览器原型或 Linux 构建代替。

最短可执行路径：在 macOS 13+ 机器上运行 `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @bookskill/desktop pack:mac`，或等待 / 下载 `.github/workflows/macos-dev-build.yml`（`runs-on: macos-15`，因 macos-14 已退役）产出的 artifact。

## 做了什么

- 为 `@bookskill/desktop` 增加 `electron-builder@26.18.0`（当前稳定 major，兼容 Electron 39），并提交更新后的 `pnpm-lock.yaml`
- 新增 `packages/desktop/electron-builder.yml`：`appId` 为 `design.city1912.bookskill.desktop`，macOS 13+ universal `.dmg`/`.zip`，未签名且未公证；同一文件包含 Windows 11 x64 NSIS/zip 目标，但未把 Linux 列为 V1 正式目标
- 新增 `packages/desktop/scripts/pack-macos.mjs` 与 `pack:mac`；非 darwin 立即退出码 1 并列出精确缺失项。保留 `pack:dir`
- 新增 `pack:win` / `pack-windows.mjs`：非 Windows 立即失败（本环境未要求跑通 Windows 打包）
- 新增 `.github/workflows/macos-dev-build.yml`（未改动 ubuntu `ci.yml` 的 lint/test/build）
- 文档：`docs/DEVELOPMENT.md` 打包一节、`docs/pkg/MACOS-DEV-BUILD.md`、本报告、`docs/pkg/pull-request.md`，以及 `packages/desktop/README.md` 命令更新

## 本机验证（Linux）

2026-11-16 15:27（Asia/Shanghai），工作区 `/workspace/bookskill-worktrees/PKG-001`，Node v24.22.1，pnpm 10.34.6：

- `pnpm install --frozen-lockfile`：退出码 0，锁文件一致
- `pnpm lint`：退出码 0
- `pnpm test`：退出码 0（validate-ci-workflow OK；repo-baseline 7 passed / 0 failed）
- `pnpm build`：退出码 0
- `pnpm --filter @bookskill/desktop test`：退出码 0（39 passed / 0 failed）
- `pnpm --filter @bookskill/desktop pack:mac`：退出码 1，精确列出缺失的 macOS 工具链与证书，未尝试打假 DMG。日志：`docs/pkg/pack-macos-linux-reject.log`
- 未生成、也未把 `packages/desktop/out/` 构建产物入库

## 明确不是什么

- 不是正式发布，未向 main / integration 合入，未打 GitHub Release
- 不是已签名 / 已公证安装包；B-003 仍然阻塞正式签名安装包
- 不是 G1 通过。G1 还需要在目标 OS 上实际启动，并确认 BookSkill 数据目录隔离

## Actions 运行说明

首次推送使用 `runs-on: macos-14`。作业在约 1 秒内被取消，未分配 runner。检查注释为：`The configuration 'macos-14-arm64-us-default' is not supported`。GitHub 已于 2026-11-02 退役 macos-14 镜像。已改为 `runs-on: macos-15`（`minimumSystemVersion` 仍为 13.0），并再次推送。ubuntu `ci.yml` 在同一 SHA 上已成功。

## Renderer 构建修复

首次在 `macos-15` 上跑 `pack:mac` 时，作业在「Pack unsigned macOS .dmg and .zip」失败。原因是 `packages/desktop/scripts/build.mjs` 用 `platform: "browser"` 打包 renderer 时，`relations/types.ts` 从 `@bookskill/core` 桶文件取值常量，esbuild 在分析该桶时解析了 Node 专用模块（`node:fs` / `node:zlib` / `node:sqlite` 等）。本机 Linux 上复现同一失败。

修复（未改 UI 功能逻辑）：

- `packages/desktop/src/renderer/relations/types.ts` 改为本地保存与 core 合同一致的关系状态 / 类型字符串，避免 renderer 入口导入 core 桶
- `scripts/build.mjs` 为 renderer 增加 `node:` stub（仅作分析安全网），并在产出后检查 `renderer.js` 不再引用 `node:` 内置模块

本机 `pnpm --filter @bookskill/desktop build` 现已退出码 0，`renderer.js` 中无 `node:` 引用。desktop 测试仍为 39 passed。

随后 `electron-builder` 因配置里的 `publish: never` 失败（26.x 会把它当成自定义 publisher 模块名）。已改为只在脚本里传 `--publish never`，配置中不再写该键。
