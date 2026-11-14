# 待决策清单

- 更新时间：2026-11-14 20:51 Asia/Shanghai
- 用途：把需要负责人拍板的事项集中在此，不在推进过程中逐条打扰。
- 红线（必须等用户）：影响产品核心质量、数据安全、授权、正式发布的决策。
- 其他事项按 `docs/GROK_EXECUTION_SPEC.md` 与 D-025 / `docs/policies/merge-policy.yml` 自动推进。

| ID | 类别 | 事项 | 为何必须等人 | 当前状态 | 建议选项 / 材料路径 |
|---|---|---|---|---|---|
| P-004 | 验收门 G1 | 提供 Windows 11 x64 / macOS 13+ 测试机或 CI runner，或批准以 Linux 开发构建作为中间证据 | 正式 G1 要求至少一个目标 OS 的开发构建；本机是 Linux | 待决策。不得在仅有 Linux 证据时宣布 G1 通过。G1 / G2 均已超时且未通过。 | 见 B-005。APP-001 本机仅有未签名 Linux dir 包。 |
| P-005 | 签名 | 配置代码签名证书与应用商店账户，或书面确认继续以“未签名开发构建”推进 | 影响正式安装包与发布 | 待决策。未签名开发构建与打包脚本仍可在 PKG-001 继续。 | 见 B-003。 |
| P-006 | 授权/支付 | 按发行地区确定支付渠道与授权服务方 | 影响真实购买与授权接通；未确定时只做 LicenseProvider 与测试授权 | 待决策。不得声称已开通真实购买。 | 见 B-004、D-014。 |
| P-007 | 品牌 | 产品正式名称、图标与商标 | 影响对外标识；现用暂名 BookSkill Desktop | 待决策，不阻塞本地开发。 | 见 D-001。 |
| P-008 | 法律 | 产品自身源代码许可证 | 须在法律审查结论之后对外宣称；L-001 至 L-012 已接受，但仍未选定 SPDX | 待决策。接受法律问题清单不等于已选定产品自身许可证。 | 见 D-011、D-026、L-010。 |
| P-009 | 平台范围 | Linux 是否在实际构建和验收通过后列入正式支持 | 改变 V1 平台范围（D-002） | 待决策。 | 当前 V1 仅为 Windows 11 x64 与 macOS 13+。 |
| P-010 | 数据完整性（后续） | IMPORT-001 去重目前是应用层 `content_hash` 查询，没有数据库唯一索引；失败 sidecar 与 SQLite 不在同一事务。并发重复导入仍可能写出重复行。 | 若补 `content_hash` 唯一索引，属于 schema 迁移，按 D-025 为高风险合入。 | 已记录。不在未确认前改 schema。 | 见 [PR #4](https://github.com/1912city-design/bookskill-desktop/pull/4) 与 `docs/import/IMPORT-001-REPORT.md`。 |
| P-011 | 数据完整性（后续） | READ-001 批注目前写入 `{dataDir}/library/{bookId}/annotations.json`，不是 SQLite 行；同书并发写入可能互相覆盖，写到一半崩溃时下次加载可能读成空列表。 | 若把批注迁入数据库，属于 schema 迁移，按 D-025 为高风险合入。 | 已记录。不在未确认前改 schema。 | 见 [PR #5](https://github.com/1912city-design/bookskill-desktop/pull/5) 与 `docs/read/READ-001-REPORT.md`。 |
| P-012 | 数据完整性（后续） | KNOW-001 合并不写入 `knowledge_relations`（避免删除被吸收卡后外键悬空）；被吸收卡上的 Skill 来源链接按既有删除契约去掉，不会自动改挂到保留卡。 | 若要可审计的合并记录，或合并时改挂 Skill 来源，可能需要新表或改变删除契约，按 D-025 为高风险。 | 已记录。不在未确认前改 schema 或删除契约。REL-001 只使用现有 `knowledge_relations` 表做建议/确认，不改合并/删除契约。 | 见 [PR #6](https://github.com/1912city-design/bookskill-desktop/pull/6) 与 `docs/know/KNOW-001-REPORT.md`。 |

已由负责人拍板、不再列入等待的事项：

- 发布仓库：`https://github.com/1912city-design/bookskill-desktop`。2026-11-14 已由负责人确认改为**公开**仓库（可见性 `PUBLIC`）。
- 允许从 `feat/REPO-001` 向 `main` 开 PR 并合入，以便 CI workflow 进入默认分支。该 PR 已于 2026-11-14 00:49 Asia/Shanghai 合入，merge `953ba8d`。
- 闭环合入规则 D-025：低/中风险在 CI + 独立 QA 通过后自动合入 `integration`；高风险与生产发布仍须人工确认。
- P-002：2026-11-14 20:20 Asia/Shanghai 确认将 `feat/DATA-001` 及叠在其上的 APP-001 / VERT-001 / FIXT-001 / IMPORT-001 / READ-001 / KNOW-001 合入 `integration`。已由 [PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7) 合入，merge `71f8390`，时间 2026-11-14 20:21 Asia/Shanghai。仍不合入 `main`、不发布。
- P-003：2026-11-14 负责人接受 GOV-001 的 L-001 至 L-012。记录为 D-026。这不构成生产发布授权，也不等于已选定产品自身源代码许可证（P-008 仍待决策）。
- P-001：`main` 分支保护已通过 repository ruleset `27261747` 启用（2026-11-14 20:50 Asia/Shanghai，`enforcement: active`）。细则与残差见 `docs/repo/BRANCH_PROTECTION.md`。

本清单不授权合并 `main`、不授权生产发布。
