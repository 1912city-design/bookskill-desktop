# TASKS

- 更新时间：2026-11-16 22:10 Asia/Shanghai
- 状态机：`Backlog → Ready → In Progress → Pull Request → CI → Independent QA → Auto-merge to integration（低/中风险）或 Human Approval（高风险）→ Done`
- 合入规则：D-025 与 `docs/policies/merge-policy.yml`。低/中风险在 CI + 独立 QA 通过后由 Orchestrator 自动合入 `integration`，不逐个询问。高风险与生产发布、以及分支保护启用前合入 `main`，须人工确认（记入 `docs/PENDING_DECISIONS.md`）。
- 并行规则：最多 6 个互不冲突的开发任务；每个子系统同一时间只允许一个实现 Agent 修改；独立分支或 worktree。
- 重试：每任务最多 2 次自动重试，其后标 BLOCKED，其它任务继续。QA 不通过时开缺陷工单并退回实现 Agent，不空等。

## 文件所有权（互不重叠）

| 任务 | 允许写入 | 禁止写入 |
|---|---|---|
| orchestrator | `docs/PROJECT_STATE.md`、`docs/DECISIONS.md`、`docs/BLOCKERS.md`、`docs/TASKS.md`、`docs/PENDING_DECISIONS.md`、`docs/tickets/**`、`docs/policies/**`、`README.md`、`.gitignore`、`docs/GROK_EXECUTION_SPEC.md`（仅复制合同） | 各任务交付目录中的报告与实现代码 |
| GOV-001 | `docs/UPSTREAM-LICENSES.md`、`docs/licenses/**`、`docs/gov/**` | 应用代码、`.bookskill/**`、治理文件正文 |
| REPO-001 | `docs/DEVELOPMENT.md`、`docs/repo/**`、`.github/**`、产品侧构建骨架、`.gitignore` 中与构建相关的增补 | 许可证目录、`.bookskill/**`、治理文件正文 |
| BOT-001 | `.bookskill/**`、`packages/bot-runtime/**`、`docs/bot/**`、对应测试 | `.github/**`、许可证目录、`docs/DEVELOPMENT.md`、治理文件正文 |
| APP-001 | `packages/desktop/**`、`docs/app/**` | 根 `package.json`、`pnpm-workspace.yaml`、`packages/data/**`、`packages/repo-baseline/**`、`.bookskill/**`、治理文件 |
| DATA-001 | `packages/data/**`、`docs/data/**` | 根 `package.json`、`pnpm-workspace.yaml`、`packages/desktop/**`、`packages/repo-baseline/**`、`.bookskill/**`、治理文件 |
| VERT-001 | 切片所需包（如 `packages/core/**`）、`docs/vert/**`、切片测试；为接线可有限修改 `packages/desktop/**` 与 `packages/data/**` | 根 `package.json`、`pnpm-workspace.yaml`、`.github/**`、`.bookskill/**`、治理文件正文；不得改 FIXT-001 样本 |
| IMPORT-001 | 见 `docs/tickets/IMPORT-001.md`（导入管道与 `docs/import/**`） | 知识卡实现、阅读 UI、治理文件、taste-skill 原型树 |
| READ-001 | 见 `docs/tickets/READ-001.md`（`packages/desktop/src/renderer/read/**`、`docs/read/**`） | 导入管道、知识卡实现、taste-skill 原型树、治理文件 |
| KNOW-001 | 见 `docs/tickets/KNOW-001.md`（`knowledge` 核心与 `packages/desktop/src/renderer/knowledge/**`、`docs/know/**`） | 导入管道、阅读 UI、taste-skill 原型树、治理文件 |
| SEARCH-001 | 见 `docs/tickets/SEARCH-001.md`（搜索核心与 `packages/desktop/src/renderer/search/**`、`docs/search/**`） | 知识关系实现、导入管道、阅读 UI、taste-skill 原型树、治理文件 |
| REL-001 | 见 `docs/tickets/REL-001.md`（关系建议/确认与 `packages/desktop/src/renderer/relations/**`、`docs/rel/**`） | 搜索实现、导入管道、阅读 UI、taste-skill 原型树、治理文件；不得改 KNOW-001 合并/删除契约 |
| PATH-001 | 见已合入实现（书库导入与带来源对话接线）；本轮不新开 | 治理文件、打包脚本、taste-skill 原型树 |
| PKG-001 | 见 `docs/pkg/**`、macOS 未签名打包脚本与 Actions（独立分支 `feat/PKG-001`） | 治理文件正文、业务 schema、taste-skill 原型树 |
| SEARCH-002 | 见 `docs/tickets/SEARCH-002.md`（`packages/core/src/search/**`、`packages/desktop/src/renderer/search/**`、`docs/search/**`） | 关系实现、知识卡合并/删除、导入管道、治理文件、`packages/data` 迁移 |
| REL-002 | 见 `docs/tickets/REL-002.md`（关系发现 API 与 `packages/desktop/src/renderer/relations/**`、`docs/rel/**`） | 搜索实现、导入管道、阅读 UI、KNOW-001 合并/删除契约、治理文件、`packages/data` 迁移 |
| SKILL-001 | 见 `docs/tickets/SKILL-001.md`（`packages/desktop/src/renderer/skills/**`、`docs/skill/**`） | `packages/data` 迁移、`packages/core/src/skills.ts` 版本写入核心（归 VER-001）、搜索/关系实现、治理文件 |
| SKILL-004 | 见 `docs/tickets/SKILL-004.md`（`packages/core/src/skill-templates/**`、`docs/skill/**`） | 桌面编辑器 UI、`packages/data` 迁移、搜索/关系实现、治理文件 |
| VER-001 | 见 `docs/tickets/VER-001.md`（`packages/data` V3 迁移、`packages/core` Skill/知识卡历史 API、`docs/versioning/**`） | 桌面 UI、搜索/关系实现、治理文件正文 |
| VER-002 | 见 `docs/tickets/VER-002.md`（Skill/知识卡历史界面与 IPC） | `packages/data`、VER-001 核心 API、搜索/关系实现、治理文件 |

本地 worktree：

- GOV-001：`/workspace/bookskill-worktrees/GOV-001`，`feat/GOV-001`
- REPO-001：`/workspace/bookskill-worktrees/REPO-001`，`feat/REPO-001`（已合入 `integration` 与 `main`）
- BOT-001：`/workspace/bookskill-worktrees/BOT-001`，`feat/BOT-001`
- APP-001：`/workspace/bookskill-worktrees/APP-001`，`feat/APP-001`
- DATA-001：`/workspace/bookskill-worktrees/DATA-001`，`feat/DATA-001`
- VERT-001：`/workspace/bookskill-worktrees/VERT-001`，`feat/VERT-001` @ `6d7914d`（已随 PR #7 进入 `integration` @ `71f8390`）
- IMPORT-001 / READ-001 / KNOW-001：各自 feature tip 仍保留；内容已随 PR #7 进入 `integration`
- SEARCH-001 / REL-001：已合入 `origin/integration` @ `5ec4540`（各自 feature 工作树仍保留）
- PATH-001：已合入 `origin/integration` @ `5ec4540`
- PKG-001：`/workspace/bookskill-worktrees/PKG-001`，`feat/PKG-001` @ `1378c01`（PR #13 仍开放，未进 integration / main）
- SEARCH-002：`/workspace/bookskill-worktrees/SEARCH-002`，`feat/SEARCH-002`
- REL-002：`/workspace/bookskill-worktrees/REL-002`，`feat/REL-002`（AI Skill Engineer 在 SEARCH-002 开出 PR 后开工）
- SKILL-001：`/workspace/bookskill-worktrees/SKILL-001`，`feat/SKILL-001`
- SKILL-004：`/workspace/bookskill-worktrees/SKILL-004`，`feat/SKILL-004`（在 REL-002 开出 PR 后开工）
- VER-001：`/workspace/bookskill-worktrees/VER-001`，`feat/VER-001`
- VER-002：工作树待 Frontend 在 VER-001 接口稳定后创建（`feat/VER-002`）
- 本轮工单文档：`/workspace/bookskill-worktrees/ORCH-utility-tickets`，`docs/ORCH-utility-tickets`
- 产品 UI 原型（taste-skill GATE: PASS，继续美学完善）：`/workspace/bookskill-ui-taste`，同步副本 `/workspace/bookskill-desktop/prototypes/desktop-shell/`（仍为未跟踪工作副本，未合入任何分支）
- 治理文档：`/workspace/bookskill-worktrees/accept-public`，`docs/accept-public-and-legal`

发布仓库已连接且为公开：`https://github.com/1912city-design/bookskill-desktop`。按 D-025 开远端 PR；Orchestrator 不自行合入 `main`、不发布。

## 看板

| ID | 阶段 | 状态 | 负责人 | 依赖 | 目标 |
|---|---|---|---|---|---|
| GOV-001 | A | Landed on `integration`（[PR #10](https://github.com/1912city-design/bookskill-desktop/pull/10)；未进 `main`；D-026：L-001–L-012 已接受） | architect | 无 | 上游和许可证审查 |
| REPO-001 | A | Done（已合入 `integration` 与 `main`；第一次 `main` Actions 为 success，不是 G1/G2） | release_engineer | 无 | 仓库和 CI 基线 |
| BOT-001 | A | Landed on `integration`（[PR #9](https://github.com/1912city-design/bookskill-desktop/pull/9)；未进 `main`） | backend_engineer | 无 | 本地 bot-runtime 与 Agent 基线 |
| APP-001 | B | Landed on `integration`（[PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7)，`71f8390`；未进 `main`；G1 未通过） | frontend_engineer | REPO-001 | 桌面骨架 |
| DATA-001 | B | Landed on `integration`（[PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7)，`71f8390`；未进 `main`） | backend_engineer | REPO-001 | 本地 schema 与迁移 |
| VERT-001 | C | Landed on `integration`（[PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7)，`71f8390`；未进 `main`；不是正式交付；未宣布 G1/G2） | ai_skill_engineer | APP-001, DATA-001, GOV-001（FIXT-001 已提供 CC0 样本） | 书到对话 Skill 的薄切片 |
| IMPORT-001 | D | Landed on `integration`（经 PR #4 QA 后随 [PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7) 合入，`71f8390`；未进 `main`） | backend_engineer | VERT-001 | 导入、去重、失败与重试 |
| READ-001 | D | Landed on `integration`（经 [PR #5](https://github.com/1912city-design/bookskill-desktop/pull/5) QA 后随 [PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7) 合入，`71f8390`；未进 `main`） | frontend_engineer | VERT-001 + IMPORT-001 | 章节、摘录、批注、来源定位 |
| KNOW-001 | D | Landed on `integration`（经 [PR #6](https://github.com/1912city-design/bookskill-desktop/pull/6) QA 后随 [PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7) 合入，`71f8390`；未进 `main`） | frontend_engineer | VERT-001 + READ-001 | 知识卡草稿/确认/编辑/合并/删除 |
| SEARCH-001 | D | Landed on `integration`（[PR #12](https://github.com/1912city-design/bookskill-desktop/pull/12)；未进 `main`） | ai_skill_engineer | KNOW-001 | 全文/语义搜索与来源显示 |
| REL-001 | D | Landed on `integration`（[PR #11](https://github.com/1912city-design/bookskill-desktop/pull/11)；未进 `main`） | ai_skill_engineer | KNOW-001 | 知识关系建议与用户确认 |
| CHAT-001 | E | Backlog | frontend_engineer | VERT-001 | 对话历史/输入/附件/停止/导出/删除 |
| CHAT-002 | E | Backlog | ai_skill_engineer | CHAT-001 | Skill 推荐与理由 |
| CHAT-003 | E | Backlog | ai_skill_engineer | CHAT-002 | 绑定 Skill 版本与补问 |
| CHAT-004 | E | Backlog | frontend_engineer | CHAT-003 | 来源侧栏与证据引用 |
| SEARCH-002 | D | In Progress | ai_skill_engineer | SEARCH-001 | 模糊匹配、更快响应、分组高亮呈现 |
| REL-002 | D | Ready（排队，SEARCH-002 开 PR 后开工） | ai_skill_engineer | REL-001 | 自动发现隐藏关联，确认后才正式 |
| SKILL-001 | E | In Progress | frontend_engineer | VERT-001 | Skill 编辑器与状态机 |
| SKILL-002 | E | Backlog | ai_skill_engineer | SKILL-001 | 运行记录、评分、新版本草稿 |
| SKILL-003 | E | Backlog | ai_skill_engineer | SKILL-001 | Markdown/JSON 与 AnythingLLM 插件导出 |
| SKILL-004 | E | Ready（排队，REL-002 开 PR 后开工） | ai_skill_engineer | VERT-001（与 SKILL-001 契约对齐） | 九个模板及正/反测试；另含概念卡草稿模板 |
| BACKUP-001 | F | Backlog | backend_engineer | DATA-001 | 完整本地导出/恢复 |
| SYNC-001 | F | Backlog | backend_engineer | BACKUP-001 | 可选 WebDAV/S3，默认关闭 |
| LIC-001 | F | Backlog | backend_engineer | REPO-001 | LicenseProvider 与测试授权 |
| VER-001 | E | In Progress | backend_engineer | DATA-001, KNOW-001, VERT-001 | Skill/知识卡本机版本历史 API；知识卡修订为高风险 V3 迁移 |
| VER-002 | E | Ready（排队，待 VER-001 接口稳定） | frontend_engineer | VER-001 | Skill/知识卡版本历史界面 |
| PKG-001 | F | In Progress（macOS 未签名开发打包，[PR #13](https://github.com/1912city-design/bookskill-desktop/pull/13) 仍开放；非正式发布，未进 main） | release_engineer | APP-001, REPO-001, PATH-001 | 双平台可重复打包 |
| QA-001 | F | Backlog | qa_security | AT 所需功能任务 | 端到端、安全、隐私、升级回归 |
| REL-001 | F | Backlog | release_engineer | QA-001, GOV-001, PKG-001 | 候选发布包与发行文档 |

工单正文见 `docs/tickets/`。缺少验收条件的工单不得进入 Ready。
