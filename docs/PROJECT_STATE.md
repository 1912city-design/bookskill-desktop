# PROJECT_STATE

- 更新时间：2026-11-13 17:21 Asia/Shanghai
- 更新人：orchestrator
- 产品暂名：BookSkill Desktop
- 当前阶段：Phase A — 仓库与交付底座
- 当前验收门：G0 本地条件已满足（仓库盘点、构建命令、工单就绪）。G1 可构建骨架进行中（目标 2026-11-13 23:08 前 Asia/Shanghai）。远端仓库仍未连接，不得声称远端 CI 已绿或可发布安装包。
- 产品状态：开发中的本地草案，**不是**正式交付、也不是发布候选

## 一句话结论

**发布仓库尚未连接。** 已建立本地 Git 工作区草案 `/workspace/bookskill-desktop`（仅 `main` 本地分支，无 remote）。正在执行 GOV-001、REPO-001、BOT-001。在负责人指定组织/仓库并完成本地到远端的连接之前，不得声称可提交远端 PR 或发布安装包。

## 环境清单（2026-11-13 17:09 Asia/Shanghai 实测）

### 工作区与既有材料

| 项 | 状态 | 说明 |
|---|---|---|
| 执行合同 | 已找到 | 实际路径为 `/workspace/书籍蒸馏工作台/GROK_EXECUTION_SPEC.md`（用户给出的 `/workspace/artifacts/GROK_EXECUTION_SPEC.md` 不存在）。已复制到本仓库 `docs/GROK_EXECUTION_SPEC.md`，未改原文。 |
| 产品仓库 | **未连接** | `/workspace/bookskill-desktop` 为本次新建的本地草案；该目录先前不存在。 |
| 远端 Git 仓库 | **未连接** | 未指定组织/仓库名。GitHub 连接器已登录账号 `1912city-design`（https://github.com/1912city-design），`list_my_repositories` 返回空列表（可见仓库数为 0）。`gh` CLI 未登录。 |
| 任务板 | 本地文件 | 见 `docs/TASKS.md` 与 `docs/tickets/`。无 Jira/GitHub Issues 远程任务板。 |
| CI | 未接通远端 | 由 REPO-001 建立本地可重复命令与 workflow 文件；在仓库未连接前，GitHub Actions 不会实际运行。 |
| 构建环境 | 部分可用 | 见下方工具版本。当前机器是 Linux x86_64，不是 V1 正式支持的 Windows 11 / macOS 13+。 |
| 签名 / 商店 / 法律审批 | 未配置 | 见 `docs/BLOCKERS.md`。 |
| Secret Manager / CI Secrets | 未配置 | 未要求、也不会在聊天或仓库中写入密钥。 |

### 本机工具（box，Linux x86_64）

| 工具 | 版本 / 状态 |
|---|---|
| OS | Linux 6.12.113+（主机名 grok-bot-vm-467333429），x86_64 |
| 磁盘 | `/` 128G，已用约 67G，可用约 61G（53%） |
| git | 2.47.3（无全局 `user.name` / `user.email`；本仓库使用本地身份 `BookSkill Orchestrator`） |
| gh | 2.103.0，**未登录任何 GitHub host** |
| node | v24.22.1 |
| npm | 随 node 安装；npx 11.21.1 |
| pnpm | 已安装（`/usr/local/bin/pnpm`） |
| yarn | 未安装 |
| python3 | 3.13.5 |
| rustc / cargo | 已安装 |
| go | 已安装 |
| docker | 29.1.4，daemon 可用 |
| electron | 未在 PATH 中发现 |
| Java | 未检查为必需，未作为基线依赖 |

### GitHub 与连接器

- cursor-github 连接器：已连接，75 个工具，账号 `1912city-design`，公开仓库 0，可见仓库 0。
- cursor-origin 连接器：已连接。未发现已指定的 BookSkill 产品仓库。
- `gh auth status`：未登录。因此即便本地写好 PR，当前也不能用 `gh` 推送或开 PR。
- 不得在未获负责人指定仓库的情况下，把本地草案推送到任意远端或创建新的公开仓库。

### 上游 AnythingLLM

- 技术决策：基于 AnythingLLM **源码**构建桌面产品，不重新包装官方桌面二进制。
- 源码检出：**未找到**。`/home/box/anythingllm-test` 仅有一个 `test.txt`，不是仓库。工作区内无 AnythingLLM git clone。
- 正在运行的容器：`mintplexlabs/anythingllm:1.19.0`，名称 `books-distill-anythingllm`，端口 `3001`，状态 healthy（约在盘点前 1 小时已在运行）。这是先前「书籍蒸馏工作台」使用的**官方镜像实例**，不是本产品的源码构建，也不是 V1 交付形态。
- orchestrator **不会**把该容器的存储、密钥或用户书籍当作产品仓库的一部分，也不会读取其中的密钥文件。

### 先前材料（只读参考，不纳入本仓库，不混用旧角色）

`/workspace/书籍蒸馏工作台/` 中有先前「书籍蒸馏工作台」的离线 HTML 原型、蒸馏结果、AnythingLLM 工作区配置和运行时脚本。用户本机同步路径为 `/Users/jasonwong/书籍蒸馏工作台`（纯本地，不放 iCloud）。

这些材料属于另一条产品线的既有交付，**不是** BookSkill Desktop 的产品仓库。本项目不调用「书籍蒸馏产品 Chief of Staff」「蒸馏 Manager」「工具 Manager」。运行时目录中存在密钥文件（权限 600），本仓库 `.gitignore` 已排除同类路径，盘点时未读取其内容。

### 权限边界（已执行）

允许：读项目文档、建本地分支/worktree、改分支文件、跑测试、写本地任务状态与交接文档。

禁止（已遵守）：读生产密钥、访问真实用户书籍、推送主分支、合并自己的 PR、删除线上数据、未经人工确认发布生产、绕过支付或授权系统、在聊天中要求粘贴 API 密钥。

## 进展（2026-11-13 17:21 Asia/Shanghai）

- GOV-001：审查交付 Done（不构成法律批准）。分支 `feat/GOV-001` @ `18281a88ae64d38a9af38308490aa937cba28843`。独立复测 `python3 docs/licenses/verify_gov001.py` exit 0。上游 AnythingLLM `1626d971c73d70a68602a662e3baf52e160c62ff`。待确认 L-001–L-012；公开发行仍受 B-002 阻塞。未合入 main。
- REPO-001：本地基线 Done。分支 `feat/REPO-001` @ `630b761`。独立复测 `pnpm test` 7/0 exit 0，`pnpm lint` 0，`pnpm build` 0。失败证明 `docs/repo/ci-fail-proof.log` exit 1。远端 CI 因 B-001 未生效，不得称为已绿。未合入 main。
- BOT-001：本地产物完成，远端验收未完成，**不得标 Done**。分支 `feat/BOT-001` @ `f284b8f`。`npm test` 34/0 exit 0。阻塞 B-001 / B-007。
- FIXT-001：本地完成。分支 `feat/FIXT-001` @ `3a804f4`。校验脚本 exit 0。
- APP-001、DATA-001：已从 `feat/REPO-001` 拉出独立分支开工（不合入 main）。

## 本轮已完成（orchestrator）

1. 读取执行合同并做环境盘点（本文档）。
2. 建立本地仓库草案，写入固定决策、阻塞项和带验收条件的任务清单。
3. 启动 GOV-001、REPO-001、BOT-001（独立分支 / worktree，文件所有权互不重叠）。

## 下一步（依赖已满足即执行，不等阶段会议）

- 完成 GOV-001 / REPO-001 / BOT-001 的可检查产物与测试。
- 在不依赖远端仓库的前提下继续本地开发。负责人指定组织/仓库后，再连接 remote、启用真实 CI 与分支保护。
- Phase A 本地底座就绪后启动 APP-001、DATA-001，并尽早切入 VERT-001。
