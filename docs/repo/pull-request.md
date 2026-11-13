# PR 草案：REPO-001 仓库和 CI 基线

- 分支：`feat/REPO-001` → 目标分支（仓库连接后）：`integration`
- 类型：低/中风险工程基线（不加生产发布、不改授权/数据迁移）
- 状态：**仅本地草案。** 发布仓库尚未连接，本文不是已提交的 GitHub Pull Request。不要推送、不要打开远端 PR、不要合入 `main`。

## 改动摘要

为 BookSkill Desktop 本地仓库补上可重复的安装、lint、单元测试和构建命令，以及 GitHub Actions 工作流文件和分支保护建议。新增 `@bookskill/repo-baseline` 包，锁定产品数据目录与 AnythingLLM 用户数据隔离。这是仓库/CI 基线，不是桌面安装包，也不是正式发布。

本地 CI 等价命令是 `pnpm run local-ci` 或 `bash scripts/ci-local.sh`。不要使用 `pnpm ci`（pnpm 预留命令，不会执行仓库脚本）。

## 验收条件逐条结果

1. `docs/DEVELOPMENT.md` 已写明 `pnpm install` / `pnpm lint` / `pnpm test` / `pnpm build`，并在本机实际执行通过。
2. 故意失败的单元测试使 `pnpm test` 以退出码 1 结束；修正后退出码 0。失败日志：`docs/repo/ci-fail-proof.log`。通过日志：`docs/repo/ci-pass-proof.log`。
3. `.github/workflows/ci.yml` 的 Test 步骤运行 `pnpm test`，无 `continue-on-error`。已用 `scripts/validate-ci-workflow.mjs` 做静态校验。本机无 `act`，远端 CI 未接通，不能称为已绿。
4. 分支保护建议见 `docs/repo/BRANCH_PROTECTION.md`，明确尚未在 GitHub 生效。
5. 构建骨架使用 BookSkill 自有数据目录逻辑，不覆盖、不依赖 AnythingLLM 容器或官方桌面用户数据。

## 测试命令及结果

在 `/workspace/bookskill-worktrees/REPO-001`，Asia/Shanghai：

```bash
pnpm install --frozen-lockfile  # exit 0  (2026-11-13 17:16:57 CST)
pnpm lint                       # exit 0  (2026-11-13 17:17:49 CST)
pnpm test                       # exit 1  with intentional failing assertion; see docs/repo/ci-fail-proof.log
pnpm test                       # exit 0, 7 passed after the assertion was repaired; see docs/repo/ci-pass-proof.log
pnpm build                      # exit 0  (2026-11-13 17:17:35 CST)
bash scripts/ci-local.sh        # exit 0  (2026-11-13 17:18:04 CST)
```

Node v24.22.1，pnpm 10.34.6。CI workflow 使用 Node 24。

## 未解决风险

- 发布仓库未连接（B-001）：无法真正启用 Actions 与分支保护。
- 本机未安装 `act`；用本地失败证明与 workflow 静态校验代替。
- 本机非 V1 目标 OS；签名证书未配置。安装包工作留给 PKG-001。
- TypeScript 锁定 5.9.x，以兼容当前 typescript-eslint 8。

## 建议审阅者

连接远端仓库后，由独立 QA 复核；不要由本任务实现者自行合并。合入目标为 `integration`，不要直接合入 `main`。
