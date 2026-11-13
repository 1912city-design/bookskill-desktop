# BOT-001 报告：Grok 执行器配置与护栏

- 任务：BOT-001
- 角色：backend_engineer
- 分支：`feat/BOT-001`
- 工作目录：`/workspace/bookskill-worktrees/BOT-001`
- 时间：2026-11-13 17:17 Asia/Shanghai（CST，UTC+8）
- 本地验收：通过（34 个测试全部通过）
- 远端 PR / CI：**BLOCKED**（`docs/BLOCKERS.md` 的 B-001 / B-007）

## 摘要

已在本地落地 Grok 执行器的角色配置、工具权限、任务状态持久化、预算/重试/超时，以及带密钥脱敏的审计日志。运行时以 fail-closed 策略执行：未知角色、角色无权、被禁工具一律失败并写入审计日志。

**没有实现任何可用的「合并 main」或「发布生产」路径。** 源码中不调用 `child_process`，不执行 git/gh 合并或发布命令。`create_pull_request` 与 `read_ci_results` 在权限上对工程角色开放，但因发布仓库未连接、`gh` 未登录，调用时抛出 `REMOTE_BLOCKED`，不得标为完成。

本任务未 push、未开远端 PR、未合并 main/integration、未读取生产密钥。

## 配置与代码路径

| 路径 | 说明 |
|---|---|
| `.bookskill/roles.json` | 仅含合同 8 个角色，及各自允许/禁止操作 |
| `.bookskill/tools.json` | 允许清单 + 显式禁止清单（含中英别名）；策略为 fail-closed |
| `.bookskill/budget.json` | `maxAutoRetries=2`、任务/工具超时、并发与费用/token 预算 |
| `.bookskill/state-machine.json` | Backlog → … → Auto-merge to integration / Human Approval → Done |
| `.bookskill/README.md` | 配置目录说明；runtime/logs 已被 gitignore |
| `packages/bot-runtime/` | 自包含运行时与测试（包名 `bot-runtime`，未改根 `package.json`） |
| `packages/bot-runtime/src/index.js` | `createRuntime()` 对外入口 |
| `packages/bot-runtime/src/roles.js` | 角色校验；拒绝未知角色 |
| `packages/bot-runtime/src/tools.js` | 工具规范化、全局拒绝、角色授权 |
| `packages/bot-runtime/src/state-machine.js` | 合法迁移与高风险门禁 |
| `packages/bot-runtime/src/budget.js` | 重试、超时、预算 |
| `packages/bot-runtime/src/store.js` | 任务状态原子持久化（默认 `.bookskill/runtime/tasks.json`） |
| `packages/bot-runtime/src/audit.js` | JSONL 审计日志（默认 `.bookskill/logs/audit.jsonl`） |
| `packages/bot-runtime/src/redact.js` | 密钥明文脱敏 |
| `packages/bot-runtime/src/executor.js` | 工具调用护栏；被禁工具只失败，不执行副作用 |
| `packages/bot-runtime/src/remote.js` | 远端 PR/CI 适配器，当前固定返回 B-001 / B-007 |
| `docs/bot/pull-request.md` | 远端可用后的 PR 说明草案（本次未创建远端 PR） |

运行时日志目录 `.bookskill/runtime/` 与 `.bookskill/logs/` 已在仓库 `.gitignore` 中，测试使用临时目录，没有把真实密钥提交进仓库。

## 验收逐条

| # | 验收条件 | 结果 | 证据 |
|---|---|---|---|
| 1 | 角色配置只包含合同中的 8 个角色，写明允许/禁止操作；测试拒绝未知角色 | **通过** | `.bookskill/roles.json`；测试 `roles.json contains exactly the eight contract roles`、`runtime accepts each contract role and rejects unknown roles`（含「蒸馏 Manager」「工具 Manager」等旧角色）、`createRuntime refuses a catalog that adds an unknown role`。orchestrator 禁止合并代码与 `modify_branch_files`。 |
| 2 | 工具清单显式排除：合并主分支、生产发布、读取生产密钥、删除线上数据。调用被禁工具必须失败并写审计日志 | **通过** | `.bookskill/tools.json` 的 `denied`；测试 `invoking a denied tool fails and is written to the audit log`、`denied aliases also fail`、`denied production tools never return a successful result`（8 个角色 × 6 个被禁工具全部失败）。审计结果码为 `DENIED_TOOL`。源码检查确认不存在可用合并/发布路径。 |
| 3 | 任务状态可持久化，覆盖合法迁移；非法迁移被拒绝 | **通过** | 低/中风险：… → Independent QA → Auto-merge to integration → Done。高风险：不得自动合入，必须 Human Approval。缺验收条件不能进入 Ready。非法跳转被拒绝。状态写入磁盘后可重新加载。orchestrator 不能把任务迁入 Auto-merge to integration。 |
| 4 | 预算、重试（最多 2 次）、超时有配置并有测试 | **通过** | 第 1、2 次失败可重试；第 3 次失败进入 `BLOCKED`。工具超时、任务超时、费用/token 超限、超过 6 个进行中开发任务均被拒绝。 |
| 5 | 审计日志记录任务 ID、角色、动作、时间、结果；不得写入密钥明文 | **通过** | `audit log records task id, role, action, time, and result`；`plaintext secrets are redacted from the audit log` 证明 `apiKey`/`token`/`password`/`authorization` 及文本中的示例密钥均被替换为 `[REDACTED]`。 |
| 6 | 远端「可创建 PR 并读取 CI」若因发布仓库未连接而无法演示，必须标 BLOCKED（B-001 / B-007），不得标 Done | **BLOCKED** | 见下节。本地已证明这两个工具对工程角色**权限允许**，但适配器抛出 `RemoteBlockedError`（消息含 B-001 / B-007），并写入审计结果 `REMOTE_BLOCKED`。 |

## 远端 PR / CI：BLOCKED

引用 `docs/BLOCKERS.md`：

- **B-001**：发布仓库尚未连接。负责人未指定 Git 组织/仓库。`gh` CLI 未登录。不能创建真实远端 PR，不能启用 GitHub Actions，不能配置远端分支保护。
- **B-007**：BOT-001 的「Agent 可创建 PR 并读取 CI」依赖 B-001，远端验收项不能标 Done。

因此本报告将「可创建 PR 并读取 CI」标为 **BLOCKED**，不标 Done。本地护栏、状态机、预算与审计不受该阻塞影响，已完成并经测试证明。

解除阻塞需要：指定组织/仓库（或授权创建私有仓库），完成推送权限与 `gh`/CI 配置。不要在聊天里粘贴密钥。

## 测试命令与完整结果

因根目录 `package.json` / pnpm workspace 由 REPO-001 拥有，本包自包含测试。命令：

```bash
cd packages/bot-runtime
npm test
# 等价于：
node --test tests/audit.test.js tests/budget.test.js tests/executor.test.js tests/roles.test.js tests/state-machine.test.js tests/tools.test.js
```

执行时间：2026-11-13 17:17:11 Asia/Shanghai（CST）。退出码：0。完整输出：

```
> bot-runtime@0.1.0 test
> node --test tests/audit.test.js tests/budget.test.js tests/executor.test.js tests/roles.test.js tests/state-machine.test.js tests/tools.test.js

✔ audit log records task id, role, action, time, and result (8.488417ms)
✔ plaintext secrets are redacted from the audit log (4.733609ms)
✔ budget.json caps automatic retries at 2 and declares timeouts (3.856562ms)
✔ a task may retry at most twice and is BLOCKED on the third failure (8.849713ms)
✔ a tool call that exceeds toolTimeoutMs is rejected (3.989626ms)
✔ a task that exceeds taskTimeoutMs is rejected (3.471754ms)
✔ cost and token budgets are enforced (3.143636ms)
✔ starting more than six in-flight development tasks is rejected (7.341086ms)
✔ runtime source does not implement a usable merge-main or production-release path (6.085303ms)
✔ create_pull_request and read_ci_results are permission-allowed but BLOCKED when the remote is disconnected (6.619646ms)
✔ unknown roles cannot invoke tools (2.758673ms)
✔ denied production tools never return a successful result (9.128631ms)
✔ roles.json contains exactly the eight contract roles (5.31136ms)
✔ runtime accepts each contract role and rejects unknown roles (3.860004ms)
✔ orchestrator is forbidden from merging code and changing implementation files (2.766006ms)
✔ product cannot change technical decisions (1.893967ms)
✔ release_engineer cannot self-publish a production release (1.924341ms)
✔ qa_security can veto a pass (2.20241ms)
✔ createRuntime refuses a catalog that adds an unknown role (0.621265ms)
✔ state-machine.json covers the contract states (5.379439ms)
✔ a low or medium risk ticket can follow the legal happy path through auto-merge to Done (12.535256ms)
✔ a high-risk ticket cannot auto-merge and must go through Human Approval (6.937168ms)
✔ each high-risk category is treated as high risk even if the risk field says medium (3.355091ms)
✔ Backlog cannot become Ready without acceptance criteria (2.270886ms)
✔ illegal transitions are rejected (3.990459ms)
✔ orchestrator cannot transition a ticket into Auto-merge to integration (3.423385ms)
✔ task state is persisted and reloaded (3.157482ms)
✔ tools.json explicitly denies merge main, production release, reading production secrets, and deleting production data (4.822544ms)
✔ invoking a denied tool fails and is written to the audit log (10.039605ms)
✔ denied aliases also fail (5.926166ms)
✔ orchestrator cannot invoke merge or modify_branch_files tools (4.3148ms)
✔ product cannot write technical decisions (2.829726ms)
✔ unknown tools are rejected fail-closed (1.76689ms)
✔ an allowlisted tool still succeeds for a permitted role (1.857972ms)
ℹ tests 34
ℹ suites 0
ℹ pass 34
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 113.489536
```

## 被禁工具如何失败（证据）

调用 `merge_main`、`production_release`、`read_production_secrets`、`delete_production_data`（以及 `push_main`、`merge_own_pr` 和中英别名，如「合并主分支」「发布生产」）时：

1. `assertToolAllowed` / `isDeniedTool` 抛出 `DeniedToolError`（`code=DENIED_TOOL`）。
2. `executor.invoke` 在失败分支写入审计日志后重新抛出，不执行任何合并或发布副作用。
3. 测试 `denied production tools never return a successful result` 对全部 8 个角色重复验证，没有任何一次返回成功。
4. 测试 `runtime source does not implement a usable merge-main or production-release path` 检查 `packages/bot-runtime/src` 不含 `child_process`、`spawn`/`exec`，也不含指向 main 的 git/gh 合并或发布命令；executor 未导出 `mergeMain` / `publishProduction`。

「Auto-merge to integration」只是任务状态名：运行时只更新持久化状态，不执行 `git merge`，更不会合并 `main`。高风险类别（数据迁移、授权、同步加密、执行外部操作、发布）即使 `risk` 字段写成 medium，也不能进入该状态。

## 未解决风险

1. **远端 PR/CI 未接通（B-001 / B-007）**：仓库连接后需要把 `createRemoteAdapter` 换成只允许「创建 PR / 读取 CI」、仍然拒绝合并 main 与生产发布的真实适配器，并用隔离环境补测。当前适配器故意不可用，避免伪称成功。
2. **与 REPO-001 的集成**：本包未改根 `package.json`。根 workspace / CI 接好后，应用 `pnpm --filter bot-runtime test` 或 `pnpm --dir packages/bot-runtime test` 纳入 CI。在此之前，本地以本包 `npm test` 为准。
3. **允许工具目前是模拟执行**：`run_tests`、`modify_branch_files` 等返回 `{ ok, simulated }`，尚未接到真实 git worktree。这是护栏层的预期范围，不构成「已实现桌面产品功能」。
4. **审计脱敏基于模式匹配**：覆盖常见 key=value、Bearer、`sk-`、GitHub token、AWS 访问键和私钥块，以及名称含 secret/token/password 的字段。非常规密钥格式仍可能漏检，后续可按需加强。
5. **并发写入**：任务存储采用临时文件 rename 的原子写，但没有跨进程锁。多 worker 同时持久化时需后续补锁。

## 提交说明

- 仅在 `feat/BOT-001` 提交允许路径：`.bookskill/**`、`packages/bot-runtime/**`、`docs/bot/**`。
- 未 push、未开远端 PR、未合并 main 或 integration、未读取密钥。
- 实现提交：`1a4d586dd9ed83788abb11382cdff4e4cc7bdb95`（`feat(BOT-001): add Grok executor runtime and guardrails`，2026-11-13 17:17:30 Asia/Shanghai）。
- 本报告与 PR 草案的完整版如随后另有提交，以 `feat/BOT-001` 分支 tip 为准。
