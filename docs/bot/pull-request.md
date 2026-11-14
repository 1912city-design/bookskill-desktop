# PR 草案：BOT-001 Grok 执行器配置与护栏

> 状态：**未创建远端 PR。** 发布仓库尚未连接，`gh` 未登录。本文件只是本地说明，供仓库接通后使用。远端 PR/CI 验收项为 **BLOCKED**，引用 `docs/BLOCKERS.md` 的 **B-001** / **B-007**。不要把本文件当作已打开的 Pull Request。

## 标题

`feat(bot-runtime): BOT-001 Grok 执行器角色、护栏、状态机与审计日志`

## 基线与分支

- 分支：`feat/BOT-001`
- 建议目标：`integration`（不得直接合入 `main`）
- 工作目录：`/workspace/bookskill-worktrees/BOT-001`

## 摘要

落地项目角色配置、工具清单、任务状态持久化、预算/重试/超时，以及带脱敏的审计日志。未知角色与被禁工具会被拒绝。运行时**不能**合并主分支或调用生产发布工具。

## 变更范围（文件所有权）

只包含：

- `.bookskill/**`
- `packages/bot-runtime/**`
- `docs/bot/**`

未修改：`.github/**`、`docs/licenses/**`、`docs/gov/**`、`docs/DEVELOPMENT.md`、`docs/repo/**`、`packages/repo-baseline/**`、根 `package.json`、`README.md`、治理文件与 tickets、`docs/GROK_EXECUTION_SPEC.md`。

## 验收

- [x] 8 个合同角色，测试拒绝未知角色；orchestrator 不直接合并代码
- [x] 被禁工具（合并主分支、生产发布、读取生产密钥、删除线上数据）调用失败并写入审计日志
- [x] 状态机合法迁移可持久化；非法迁移被拒绝；高风险不得自动合入
- [x] 预算、最多 2 次自动重试、超时有测试
- [x] 审计日志含任务 ID、角色、动作、时间、结果；密钥明文被脱敏
- [ ] **BLOCKED（B-001 / B-007）**：Agent 在远端创建 PR 并读取 CI。发布仓库连接前不得勾选。

## 测试

```bash
cd packages/bot-runtime
npm test
```

最近一次本地结果（2026-11-13 17:17 Asia/Shanghai）：34 passed, 0 failed, exit 0。完整输出见 `docs/bot/BOT-001-REPORT.md`。

## 风险与审查要点

- 本变更风险为 **medium**（执行器权限模型，但不含数据迁移、授权、同步加密、外部操作或生产发布实现）。即便如此，在远端 CI 与独立 QA 通过之前不得合入。
- 请确认源码中仍不存在可用的 merge main / production release 路径。
- 仓库接通后，远端适配器必须继续拒绝被禁工具，不能为了打通 PR 而放开护栏。

## 合入规则

- 不得合并到 `main`。
- 不得由提交者或 orchestrator 自行合并。
- 生产发布始终需要人工批准；本 PR 不包含发布步骤。
