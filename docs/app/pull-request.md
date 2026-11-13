# PR 草案：APP-001 桌面骨架

- 分支：`feat/APP-001` → 目标分支（仓库连接后）：`integration`
- 类型：桌面壳与导航骨架（不发布正式版、不打包官方二进制、不改授权或数据迁移）
- 状态：**仅本地草案。** 发布仓库尚未连接，本文不是已提交的 GitHub Pull Request。不要推送、不要打开远端 PR、不要合入 `main` 或 `integration`。

## 改动摘要

新增 `@bookskill/desktop`（`packages/desktop`）：BookSkill 自己的 Electron 壳、五个一级导航、可见错误边界，以及首次启动时的独立数据目录初始化。产品名是 `BookSkill Desktop`。图标与界面为原作，不是 AnythingLLM 官方桌面二进制的再包装，也不使用其商标或 wordmark。

自动测试命令：

```bash
pnpm --filter @bookskill/desktop test
```

Linux 开发冒烟与未签名 dir：

```bash
pnpm --filter @bookskill/desktop smoke
pnpm --filter @bookskill/desktop pack:dir
```

未改根 `package.json`、`pnpm-workspace.yaml`、`.github` 或 `packages/data`。因新工作区包，根 `pnpm-lock.yaml` 有相应更新。

**这次交付不能宣布 G1 已通过。** 本机只验证了 Linux x86_64。V1 目标 OS 是 Windows 11 与 macOS 13+。`out/` 中的产物是未签名开发目录，不是正式安装包。

## 验收条件逐条结果

1. 应用显示 `BookSkill Desktop`，并提供五个可导航一级入口；默认进入问题对话。Linux 冒烟与单测均通过。
2. 渲染或启动失败时显示可见错误面板，不是白屏。单测覆盖该行为；`?crash=1` / `?bootError=` 可重复复现。
3. 首次启动在 `BOOKSKILL_DATA_DIR` 或 BookSkill 默认目录下创建结构；拒绝 AnythingLLM / Mintplex 路径且不创建这些目录。
4. Linux 开发构建可启动。未提供 Windows 11 / macOS 13+ 构建，G1 未通过。
5. `pnpm --filter @bookskill/desktop test` 本机退出码 0（15 passed / 0 failed）。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/APP-001`，Asia/Shanghai：

```bash
pnpm --filter @bookskill/desktop test      # exit 0, 15 passed / 0 failed, 2026-11-13 17:28:10 CST
pnpm --filter @bookskill/desktop smoke     # exit 0, 2026-11-13 17:27 CST
pnpm --filter @bookskill/desktop pack:dir  # exit 0, unsigned Linux dir at packages/desktop/out/BookSkill Desktop-linux-x64
```

证据文件：`docs/app/linux-smoke-result.json`、`docs/app/linux-smoke-layout.json`、`docs/app/linux-pack-smoke-result.json`、`docs/app/linux-pack-dir.txt`。完整说明见 `docs/app/APP-001-REPORT.md`。

## 风险与跟随项

- 需要 Windows 11 与 macOS 13+ 开发构建和启动证据后，才能评估 G1。
- 根 CI 尚未调用桌面包测试。
- pnpm 10 可能跳过 Electron install script；`scripts/ensure-electron.mjs` 会在二进制缺失时补齐。
- 数据目录布局是 APP-001 骨架，需与 DATA-001 正式 schema 衔接。
