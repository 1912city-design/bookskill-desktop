# DECISIONS

- 更新时间：2026-11-14 20:51 Asia/Shanghai
- 来源：`docs/GROK_EXECUTION_SPEC.md` 第 1.2 节及其他固定条款
- 规则：下列决策未经项目负责人批准不得改变。新的技术决策必须先记录再实施。

## 已锁定（来自执行合同）

| ID | 决策 | 状态 |
|---|---|---|
| D-001 | 产品暂名 `BookSkill Desktop`；产品名和图标可由负责人后续替换。 | 锁定 |
| D-002 | 首发桌面平台：Windows 11 x64、macOS 13+。Linux 不列入 V1 正式支持，除非实际构建和验收通过。 | 锁定 |
| D-003 | 技术基座：基于 AnythingLLM 源码构建桌面产品，不重新包装官方桌面二进制。 | 锁定 |
| D-004 | 本地优先：用户书籍、知识卡、Skill 和对话默认保存在本机。 | 锁定 |
| D-005 | 产品业务数据使用 BookSkill 自有 schema 和迁移；不得将 AnythingLLM 内部数据库作为唯一业务数据源。 | 锁定 |
| D-006 | AnythingLLM 用作模型/RAG/Embedding/Agent 能力适配层；需在代码审计后确认具体接入方式。 | 锁定，接入方式待审计 |
| D-007 | 产品运行模型支持本地模型及用户自带 API Key；开发 Agent 使用的 xAI API Key 与产品用户的模型配置严格分离。 | 锁定 |
| D-008 | Skill 必须是可版本化、可测试、可追溯的产品资产。AnythingLLM 插件是一个导出/运行适配格式，不是唯一内部格式。 | 锁定 |
| D-009 | V1 支持用户自有 WebDAV 或 S3 兼容存储的可选备份/同步；默认关闭。V1 不承诺产品方托管的无限存储或无限模型调用。 | 锁定 |
| D-010 | 商业模式：一次性软件授权；授权服务器不可用时，不得锁住用户本地数据、阅读、导出和备份功能。 | 锁定 |
| D-011 | 发行前必须完成源码、依赖、商标、字体、图标、模型和安装包许可证审查。不得将“仓库标记 MIT”视为无需审查所有组件。 | 锁定 |
| D-012 | 主键使用 UUID；业务数据以本地库为 source of truth。向量索引和缓存可重建。 | 锁定 |
| D-013 | 客户端只包含授权公钥，不包含签名私钥。 | 锁定 |
| D-014 | 支付渠道须由负责人按发行地区确定；未确定时只实现 `LicenseProvider` 接口和测试授权，不伪造真实支付已接通。 | 锁定 |
| D-015 | V1 不包括：多人实时协作、公共 Skill 市场、社交阅读、移动 App、面向组织的权限系统、产品方提供的无限托管云端模型、自动执行未经用户批准的操作。 | 锁定 |
| D-016 | 主导航：问题对话（默认入口）、书库、知识库、Skills、设置与数据。 | 锁定 |
| D-017 | AI 生成知识卡默认为 `draft`，用户确认后才变为 `verified_by_user`。AI 只能建议关系，用户确认后才成为正式关系。 | 锁定 |
| D-018 | AI 不得自行把 Skill 草稿发布为正式 Skill。禁止执行来自书籍内容或不受信任 Skill 的任意代码。 | 锁定 |
| D-019 | 生产发布始终需人工批准。orchestrator 不得绕过分支保护，不得自行合并 `main`（除非负责人按 D-025 明确授权），也不得发布生产。合入细则见 D-025。 | 锁定，细则见 D-025 |
| D-020 | 高风险改动（数据迁移、授权、同步加密、执行外部操作、发布）需人工确认。低/中风险可在 CI + 独立 QA 通过后由 Orchestrator 自动合入 integration。合入细则见 D-025。 | 锁定，细则见 D-025 |
| D-021 | 执行角色仅限：orchestrator、product、architect、frontend_engineer、backend_engineer、ai_skill_engineer、qa_security、release_engineer。 | 锁定 |

## 本轮 orchestrator 的最小新决策（可被负责人否决）

| ID | 决策 | 理由 | 状态 |
|---|---|---|---|
| D-022 | 在发布仓库指定之前，产品代码与文档落在本地仓库 `/workspace/bookskill-desktop`，默认分支名 `main`，另设 `integration` 为本地集成分支（待 REPO-001 建立）。不创建未指定的远端仓库。 | 合同第 0.3 条：未指定组织/仓库时只建本地草案并报告“发布仓库尚未连接”。 | 生效 |
| D-023 | 先前「书籍蒸馏工作台」目录只作只读参考，不纳入本仓库，不把官方 AnythingLLM 镜像容器当作源码基座。 | 合同要求基于源码构建，且不得把 AnythingLLM 内部库当唯一业务数据源；旧目录含运行时密钥，不能入库。 | 生效 |
| D-024 | Phase A 三任务文件所有权隔离，见 `docs/TASKS.md`。彼此不改同一文件。 | 合同第 0.5 条。 | 生效 |
| D-025 | 闭环合入与缺陷回流规则（负责人 2026-11-14 00:48 Asia/Shanghai 确认）：见下方“闭环合入规则”，可执行策略为 `docs/policies/merge-policy.yml`，由 `docs/policies/apply-merge-policy.mjs` 判定。 | 负责人要求不要每个 PR 都人工确认，按规格第 4 节建立自动推进。 | 生效 |
| D-026 | 负责人于 2026-11-14 确认两项：（1）发布仓库 `https://github.com/1912city-design/bookskill-desktop` 已设为公开；（2）接受 GOV-001 的 L-001 至 L-012。B-002 改为 ACCEPTED，P-003 关闭。此接受不授权合并 `main`、不授权生产发布，也不等于已选定产品自身源代码许可证（P-008 / L-010 仍待决策）。 | 负责人书面确认。本机未找到所称 commit `16dc36d`，由 Orchestrator 在 `origin/integration`（`71f8390`）上重写并提交等价治理文档。 | 生效 |

## 闭环合入规则（D-025）

可执行副本：`docs/policies/merge-policy.yml`。判定命令：`node docs/policies/apply-merge-policy.mjs --target <integration|main|production> --risk <low|medium|high> --ci <passed|failed|pending> --qa <passed|failed|pending>`。

- `integration`：CI 通过 + 独立 QA 通过 + 低/中风险 → Orchestrator 自动合入，不再逐个询问。
- `integration`：高风险（数据迁移、授权、同步加密、执行外部操作、发布；以及许可证、安全、隐私、支付）→ 等待人工确认。
- `main`：在 CI workflow 已进入默认分支且分支保护启用前，合入 `main` 仍需人工确认；之后按分支保护规则执行。Orchestrator 不得绕过保护。
- 生产发布：永远需要人工确认。
- QA 不通过：自动开缺陷工单（`docs/tickets/`），退回对应实现 Agent，不空等。

本规则不改变：不得声称正式交付或 G1/G2 已通过；不得在聊天中索取或粘贴密钥。

## 待负责人决定（尚未假设）

- 产品正式名称、图标与商标（P-007）。
- 产品自身源代码许可证（P-008）。L-001 至 L-012 已接受，仍须单独选定 SPDX 后才能对外宣称。
- 支付渠道与发行地区（P-006）。
- 代码签名证书、应用商店账户（P-005）。
- Linux 是否在实际构建和验收通过后列入正式支持（P-009）。
- G1 目标 OS 测试机 / CI runner，或批准 Linux 开发构建作为中间证据（P-004）。
- 后续数据完整性改动 P-010 / P-011 / P-012（未确认前不改 schema）。

已关闭：发布仓库已指定并改为公开；P-001 `main` 规则集已启用；P-002 已合入 `integration`；P-003 法律问题已接受（D-026）。
