# BLOCKERS

- 更新时间：2026-11-14 20:51 Asia/Shanghai
- 规则：许可证、安全、支付、个人数据或外部副作用不明确时标记为 `BLOCKED`，写明所需的人类决策，不得自行假设。不依赖这些项的本地工作继续推进。
- 待决策汇总：`docs/PENDING_DECISIONS.md`。

| ID | 状态 | 阻塞内容 | 影响 | 需要的人类决策 / 权限 | 不被阻塞的工作 |
|---|---|---|---|---|---|
| B-001 | RESOLVED | 发布仓库已连接，且已于 2026-11-14 确认为公开仓库 `1912city-design/bookskill-desktop`。`main` 与已验收功能分支已推送；CI workflow 已进入 `main`。 | 曾阻塞远端 PR、Actions 与分支保护配置。 | 无。P-001 已通过 ruleset 启用。 | 远端 PR、读取 Actions、按 D-025 合入 `integration`。 |
| B-002 | ACCEPTED | 负责人已于 2026-11-14 接受 GOV-001 的 L-001 至 L-012（D-026）。审查交付本身仍不是法律意见书以外的额外结论。 | 法律问题清单不再阻塞继续开发与公开源码仓库。生产发布、签名安装包与对外宣称产品自身许可证仍分别受 B-003、P-005、P-008 约束。 | 无新的法律确认。产品自身 SPDX 选型见 P-008。 | 本地开发、公开仓库上的 PR/CI、合入 `integration`（仍不合入 `main`、不发布）。 |
| B-003 | BLOCKED | 代码签名证书、应用商店账户未配置。 | 不能出具已签名的正式 Windows/macOS 安装包。 | 负责人配置证书与商店账户，或书面确认以“未签名开发构建”继续（P-005）。 | 未签名开发构建与打包脚本可先做（PKG-001 时）。 |
| B-004 | BLOCKED | 支付渠道与发行地区未确定。 | 不能接通真实支付，不能声称已开通购买。 | 负责人按发行地区确定支付/授权服务方（P-006）。 | 可实现 `LicenseProvider` 与测试授权（LIC-001）。 |
| B-005 | OPEN | 当前执行环境是 Linux x86_64，不是 V1 目标 OS。 | 不得仅凭本机 Linux 证据宣布 G1 通过。G1 已超时未通过。 | 提供 Windows 11 x64 / macOS 13+ 测试机或 CI runner，或批准先以 Linux 开发构建作为中间证据（P-004）。 | 本机可先搭可重复构建与测试；目标 OS 构建在 runner 可用后补做。 |
| B-006 | PARTIAL | AnythingLLM 源码已于 2026-11-13 17:12 Asia/Shanghai 只读检出到 `/workspace/bookskill-upstream/anything-llm`（`1626d971c73d70a68602a662e3baf52e160c62ff`），未入库。适配层接入方式仍待代码审计。 | 桌面壳可在独立数据目录上先做骨架，但不得把上游内部库当业务 API，也不得再分发官方桌面二进制。 | 适配方式由 architect 后续审计确认。 | APP-001 / DATA-001 / VERT-001 / Phase D 可并行。 |
| B-007 | OPEN | BOT-001 本地 34/34 已通过；远端 PR/CI/独立 QA 按本轮推进启动。在该任务自身 PR + CI + 独立 QA 完成前不得标 Done。 | 只影响 BOT-001 的远端验收，不阻塞 Phase D。 | 无新的人类决策。按 D-025 开 PR 并走独立 QA。 | 角色配置、状态持久化、预算/重试/超时、审计日志及“不能合并主分支或调用生产发布工具”的本地测试已完成。 |

## 非阻塞说明

- 未要求用户在聊天中粘贴 API 密钥。
- 未读取 `书籍蒸馏工作台/运行时` 下的密钥文件。
- 开发 Agent 的模型密钥与未来产品用户的模型配置保持分离；产品侧不写入开发密钥。
- `integration` 已包含 P-002 栈（[PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7)，merge `71f8390`，2026-11-14 20:21 Asia/Shanghai）。`main` 仍为 `953ba8d`。这仍不是 G1/G2 或正式交付。
