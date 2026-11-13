# 待决策清单

- 更新时间：2026-11-14 01:02 Asia/Shanghai
- 用途：把需要负责人拍板的事项集中在此，不在推进过程中逐条打扰。由例行「BookSkill 决策汇总」在 2026-11-14 09:30 Asia/Shanghai 发送一次汇总。
- 红线（必须等用户）：影响产品核心质量、数据安全、授权、正式发布的决策。
- 其他事项按 `docs/GROK_EXECUTION_SPEC.md` 与 D-025 / `docs/policies/merge-policy.yml` 自动推进。

| ID | 类别 | 事项 | 为何必须等人 | 当前状态 | 建议选项 / 材料路径 |
|---|---|---|---|---|---|
| P-001 | 仓库治理 | 按 `docs/repo/BRANCH_PROTECTION.md` 启用 `main` 分支保护（必测通过、禁止直接推送、禁止强推、PR 评审规则） | 改变默认分支保护，属于仓库治理，需管理员操作 | 待决策。CI workflow 已在 `main`，第一次 Actions 已成功：https://github.com/1912city-design/bookskill-desktop/actions/runs/43466573707 （2026-11-14 00:49:46 Asia/Shanghai，`success`，约 19 秒）。保护尚未启用。 | 启用文档中的建议规则；检查名以仓库中实际出现的 CI 作业名为准。 |
| P-002 | 高风险合入 | 是否将 `feat/DATA-001`（以及叠在其上的 APP-001 / VERT-001 / FIXT-001 / IMPORT-001）合入 `integration` | 数据迁移，D-025 高风险，需人工确认。IMPORT-001 本身为中风险且未改 schema，但其分支历史包含 DATA-001（`af14b5c`），不能单独快进到 `integration`。 | 待决策。DATA-001 本地已验收（schema v2，11 tests 通过），未合入。IMPORT-001 本地已完成，PR #4 面向 `feat/VERT-001`，不自动晋升 `integration`。 | DATA-001 报告：`/workspace/bookskill-worktrees/DATA-001/docs/data/DATA-001-REPORT.md`。IMPORT-001：https://github.com/1912city-design/bookskill-desktop/pull/4 。确认后由 Orchestrator 按栈合入 `integration`，仍不合入 `main`、不发布。 |
| P-003 | 法律 | 确认或驳回 GOV-001 的 L-001 至 L-012 | 许可证/法律结论，禁止在未确认前公开发行 | 待决策。审查交付已完成，不构成法律批准。公开发行仍阻塞（B-002）。 | `docs/licenses/legal-questions.md`（在 `feat/GOV-001` / `/workspace/bookskill-worktrees/GOV-001`）。 |
| P-004 | 验收门 G1 | 提供 Windows 11 x64 / macOS 13+ 测试机或 CI runner，或批准以 Linux 开发构建作为中间证据 | 正式 G1 要求至少一个目标 OS 的开发构建；本机是 Linux | 待决策。不得在仅有 Linux 证据时宣布 G1 通过。 | 见 B-005。APP-001 本机仅有未签名 Linux dir 包。 |
| P-005 | 签名 | 配置代码签名证书与应用商店账户，或书面确认继续以“未签名开发构建”推进 | 影响正式安装包与发布 | 待决策。未签名开发构建与打包脚本仍可在 PKG-001 继续。 | 见 B-003。 |
| P-006 | 授权/支付 | 按发行地区确定支付渠道与授权服务方 | 影响真实购买与授权接通；未确定时只做 LicenseProvider 与测试授权 | 待决策。不得声称已开通真实购买。 | 见 B-004、D-014。 |
| P-007 | 品牌 | 产品正式名称、图标与商标 | 影响对外标识；现用暂名 BookSkill Desktop | 待决策，不阻塞本地开发。 | 见 D-001。 |
| P-008 | 法律 | 产品自身源代码许可证 | 须在法律审查结论之后对外宣称 | 待决策。 | 见 D-011、B-002。 |
| P-009 | 平台范围 | Linux 是否在实际构建和验收通过后列入正式支持 | 改变 V1 平台范围（D-002） | 待决策。 | 当前 V1 仅为 Windows 11 x64 与 macOS 13+。 |

| P-010 | 数据完整性（后续） | IMPORT-001 去重目前是应用层 `content_hash` 查询，没有数据库唯一索引；失败 sidecar 与 SQLite 不在同一事务。并发重复导入仍可能写出重复行。 | 若补 `content_hash` 唯一索引，属于 schema 迁移，按 D-025 为高风险合入。 | 已记录，不阻塞当前 IMPORT-001 面向 `feat/VERT-001` 的 QA。不在未确认前改 schema。 | 见 PR #4 与 `docs/import/IMPORT-001-REPORT.md`。09:30 汇总时可决定是否授权后续高风险迁移。 |

已由负责人拍板、不再列入等待的事项：

- 发布仓库：`https://github.com/1912city-design/bookskill-desktop`（私有）。
- 允许从 `feat/REPO-001` 向 `main` 开 PR 并合入，以便 CI workflow 进入默认分支。该 PR 已于 2026-11-14 00:49 Asia/Shanghai 合入，merge `953ba8d`。
- 闭环合入规则 D-025：低/中风险在 CI + 独立 QA 通过后自动合入 `integration`；高风险与生产发布仍须人工确认。

本清单不授权合并 `main`、不授权生产发布。
