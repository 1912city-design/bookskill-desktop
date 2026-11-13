# BookSkill 执行器配置（BOT-001）

本目录存放 Grok 执行器的角色、工具、预算与状态机配置。由 `packages/bot-runtime` 加载。

| 文件 | 用途 |
|---|---|
| `roles.json` | 合同规定的 8 个角色及其允许/禁止操作 |
| `tools.json` | 允许工具与显式禁止工具（含别名） |
| `budget.json` | 预算、最多 2 次自动重试、超时 |
| `state-machine.json` | 任务状态与合法迁移 |

运行时状态与审计日志写到 `runtime/` 与 `logs/`（已在仓库 `.gitignore` 中忽略）。不要把真实密钥写入本目录或提交进仓库。

远端 PR/CI 在发布仓库连接之前保持 BLOCKED（见 `docs/BLOCKERS.md` 的 B-001 / B-007）。
