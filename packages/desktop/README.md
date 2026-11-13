# @bookskill/desktop

BookSkill Desktop 的自有 Electron 壳与一级导航。这不是 AnythingLLM 官方桌面二进制的再包装，也不包含 AnythingLLM / Mintplex 的商标、图标或 wordmark。

当前本机只完成了 **Linux x86_64 开发构建与冒烟**。V1 目标 OS 是 Windows 11 和 macOS 13+。**不能**据此宣布 G1 已通过。`pnpm pack:dir` 产出的是未签名的解包目录，不是正式安装包。

## 命令

在仓库根目录：

```bash
pnpm install
pnpm --filter @bookskill/desktop test
pnpm --filter @bookskill/desktop start
pnpm --filter @bookskill/desktop smoke
pnpm --filter @bookskill/desktop pack:dir
```

可用 `BOOKSKILL_DATA_DIR` 指向临时目录做首次启动测试。路径若包含 `anythingllm`、`anything-llm` 或 `mintplex`，解析会失败，不会创建或覆盖该目录。

pnpm 10 可能跳过 `electron` 的安装脚本。`start` / `smoke` / `pack:dir` 会通过 `scripts/ensure-electron.mjs` 在二进制缺失时调用官方 `install.js`。
