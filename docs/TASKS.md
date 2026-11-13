# TASKS

- 更新时间：2026-11-13 17:27 Asia/Shanghai
- 状态机：`Backlog → Ready → In Progress → Pull Request → CI → Independent QA → Auto-merge to integration（低/中风险）或 Human Approval（高风险）→ Done`
- 并行规则：最多 6 个互不冲突的开发任务；每个子系统同一时间只允许一个实现 Agent 修改；独立分支或 worktree。
- 重试：每任务最多 2 次自动重试，其后标 BLOCKED，其它任务继续。

## 文件所有权（Phase A，互不重叠）

| 任务 | 允许写入 | 禁止写入 |
|---|---|---|
| orchestrator（本轮） | `docs/PROJECT_STATE.md`、`docs/DECISIONS.md`、`docs/BLOCKERS.md`、`docs/TASKS.md`、`docs/tickets/**`、`README.md`、`.gitignore`、`docs/GROK_EXECUTION_SPEC.md`（仅复制合同） | 各任务交付目录中的报告与代码 |
| GOV-001 | `docs/UPSTREAM-LICENSES.md`、`docs/licenses/**`、`docs/gov/**`；只读克隆上游到 `/workspace/bookskill-upstream/anything-llm`（不提交该克隆进本仓库） | `.github/**`、`docs/DEVELOPMENT.md`、应用代码、`.bookskill/**`、上述 orchestrator 文件（状态由总控回写） |
| REPO-001 | `docs/DEVELOPMENT.md`、`docs/repo/**`、`.github/**`、产品侧构建/测试骨架（如 `package.json`、`pnpm-workspace.yaml`、`packages/repo-baseline/**`、`scripts/**`）、`.gitignore` 中与构建相关的增补 | `docs/UPSTREAM-LICENSES.md`、`docs/licenses/**`、`docs/gov/**`、`.bookskill/**`、orchestrator 治理文件正文（可在自己的报告里引用） |
| BOT-001 | `.bookskill/**`、`packages/bot-runtime/**`、`docs/bot/**`、对应测试 | `.github/**`、`docs/licenses/**`、`docs/gov/**`、`docs/DEVELOPMENT.md`、治理文件正文 |
| APP-001 | `packages/desktop/**`、`docs/app/**` | 根 `package.json`、`pnpm-workspace.yaml`、`packages/data/**`、`packages/repo-baseline/**`、`.bookskill/**`、治理文件 |
| DATA-001 | `packages/data/**`、`docs/data/**` | 根 `package.json`、`pnpm-workspace.yaml`、`packages/desktop/**`、`packages/repo-baseline/**`、`.bookskill/**`、治理文件 |

本地 worktree：

- GOV-001：`/workspace/bookskill-worktrees/GOV-001`，分支 `feat/GOV-001`
- REPO-001：`/workspace/bookskill-worktrees/REPO-001`，分支 `feat/REPO-001`
- BOT-001：`/workspace/bookskill-worktrees/BOT-001`，分支 `feat/BOT-001`
- APP-001：`/workspace/bookskill-worktrees/APP-001`，分支 `feat/APP-001`（基于 `feat/REPO-001`，不合入 main）
- DATA-001：`/workspace/bookskill-worktrees/DATA-001`，分支 `feat/DATA-001`（基于 `feat/REPO-001`，不合入 main）

无远端时：在分支上提交，并写本地 `pull-request.md` 作为 PR 草案，**不推送、不开远端 PR、不合入 `main`**。

## 看板

| ID | 阶段 | 状态 | 负责人 | 依赖 | 目标 |
|---|---|---|---|---|---|
| GOV-001 | A | Done（审查完成，不构成法律批准） | architect | 无 | 上游和许可证审查 |
| REPO-001 | A | Done（本地基线；远端 CI 因 B-001 未生效） | release_engineer | 无 | 仓库和 CI 基线 |
| BOT-001 | A | Local Complete / Remote BLOCKED | backend_engineer | 无 | 本地运行时与 34 项测试已通过；远端 PR/CI 仍阻塞，不得标 Done |
| APP-001 | B | In Progress | frontend_engineer | REPO-001 | 桌面骨架 |
| DATA-001 | B | Done（本地；未合入；合入 integration 需人工确认；远端 PR 因 B-001 未开） | backend_engineer | REPO-001 | 本地 schema 与迁移 |
| VERT-001 | C | Backlog | ai_skill_engineer | APP-001, DATA-001, GOV-001（测试材料许可） | 书到对话 Skill 的薄切片 |
| IMPORT-001 | D | Backlog | backend_engineer | VERT-001 | 导入、去重、失败与重试 |
| READ-001 | D | Backlog | frontend_engineer | VERT-001 | 章节、摘录、批注、来源定位 |
| KNOW-001 | D | Backlog | frontend_engineer | VERT-001 | 知识卡草稿/确认/编辑/合并/删除 |
| SEARCH-001 | D | Backlog | ai_skill_engineer | KNOW-001 | 全文/语义搜索与来源显示 |
| REL-001 | D | Backlog | ai_skill_engineer | KNOW-001 | 知识关系建议与用户确认 |
| CHAT-001 | E | Backlog | frontend_engineer | VERT-001 | 对话历史/输入/附件/停止/导出/删除 |
| CHAT-002 | E | Backlog | ai_skill_engineer | CHAT-001 | Skill 推荐与理由 |
| CHAT-003 | E | Backlog | ai_skill_engineer | CHAT-002 | 绑定 Skill 版本与补问 |
| CHAT-004 | E | Backlog | frontend_engineer | CHAT-003 | 来源侧栏与证据引用 |
| SKILL-001 | E | Backlog | frontend_engineer | VERT-001 | Skill 编辑器与状态机 |
| SKILL-002 | E | Backlog | ai_skill_engineer | SKILL-001 | 运行记录、评分、新版本草稿 |
| SKILL-003 | E | Backlog | ai_skill_engineer | SKILL-001 | Markdown/JSON 与 AnythingLLM 插件导出 |
| SKILL-004 | E | Backlog | product + ai_skill_engineer | SKILL-001 | 九个模板及正/反测试 |
| BACKUP-001 | F | Backlog | backend_engineer | DATA-001 | 完整本地导出/恢复 |
| SYNC-001 | F | Backlog | backend_engineer | BACKUP-001 | 可选 WebDAV/S3，默认关闭 |
| LIC-001 | F | Backlog | backend_engineer | REPO-001 | LicenseProvider 与测试授权 |
| PKG-001 | F | Backlog | release_engineer | APP-001, REPO-001 | 双平台可重复打包 |
| QA-001 | F | Backlog | qa_security | AT 所需功能任务 | 端到端、安全、隐私、升级回归 |
| REL-001 | F | Backlog | release_engineer | QA-001, GOV-001, PKG-001 | 候选发布包与发行文档 |

工单正文见 `docs/tickets/`。缺少验收条件的工单不得进入 Ready。APP-001 / DATA-001 在 REPO-001 的本地 CI 基线可用后进入 Ready（不必等待远端仓库）。
