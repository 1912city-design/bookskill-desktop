# REPO-001：仓库和 CI 基线

- ID：REPO-001
- 目标：提供可重复的安装依赖、lint、unit test、build 命令；提交 CI workflow；给出分支保护建议。新环境按文档可构建；CI 会因测试失败而失败。
- 负责人 Agent：release_engineer
- 依赖：无
- 输入/受影响模块：`docs/DEVELOPMENT.md`、`.github/**`、产品侧构建骨架与基线测试、`docs/repo/**`
- 允许工具：创建/修改上述文件、安装开发依赖、运行 lint/test/build、写本地 PR 草案
- 禁止操作：推送或保护远端 `main`（仓库未连接）；把 AnythingLLM 官方二进制当构建产物；把上游内部数据库当业务 API；读取密钥；合并到 `main`；声称远端 CI 已接通
- 状态：In Progress
- 启动时间：2026-11-13 17:10 Asia/Shanghai

## 验收条件（可测试）

1. `docs/DEVELOPMENT.md` 写清在新环境安装依赖、lint、unit test、build 的命令，且这些命令在本机实际可执行。
2. 至少有一条会失败的单元测试被证明会使测试命令以非零退出码失败；修复后测试命令通过。需留下两次运行的日志。
3. 存在 GitHub Actions（或同等）workflow 文件：在测试失败时 job 失败。可用 `act` 或等效静态/本地校验证明条件分支存在；若无法在本机跑 Actions，不得声称远端 CI 已绿。
4. 写出分支保护建议（必测通过、禁止直接推 `main`、PR 评审规则），路径 `docs/repo/BRANCH_PROTECTION.md`。在远端未连接时仅作为建议，不伪称已在 GitHub 生效。
5. 构建骨架不得覆盖或依赖先前 AnythingLLM 容器中的用户数据目录。

## 测试命令

```bash
# 以 DEVELOPMENT.md 中的最终命令为准，预期包含：
pnpm install
pnpm lint
pnpm test
pnpm build
# 以及故意失败用例的日志：docs/repo/ci-fail-proof.log
```

## 交付物路径

- `docs/DEVELOPMENT.md`
- `.github/workflows/ci.yml`
- `docs/repo/BRANCH_PROTECTION.md`
- `docs/repo/REPO-001-REPORT.md`
- `docs/repo/pull-request.md`
- 构建骨架与测试（按实现放置，避开 GOV-001 / BOT-001 目录）

## 失败升级条件

依赖安装或工具缺失时最多重试 2 次并记录；之后 BLOCKED，给出最短解决路径，不阻塞 GOV-001 / BOT-001。
