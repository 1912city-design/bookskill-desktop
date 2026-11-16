# PROJECT_STATE

- 更新时间：2026-11-16 22:10 Asia/Shanghai
- 合同：`docs/GROK_EXECUTION_SPEC.md`（SHA-256 `7b2cd11ac44e4dcc5d9f4b219c837ce8ddc2be86856e02327352e545418b64d2`）
- 发布仓库：已连接，**公开**仓库 https://github.com/1912city-design/bookskill-desktop
- 默认分支 `origin/main`：`953ba8d`（合入 REPO-001，PR #1）。分支保护：repository ruleset `27261747`，`enforcement: active`（P-001，2026-11-14 20:50 Asia/Shanghai）。
- 集成分支 `origin/integration`：`5ec4540`（2026-11-16 16:09:35 Asia/Shanghai 合入 PATH-001，[PR #14](https://github.com/1912city-design/bookskill-desktop/pull/14)）。此前已合入 DATA/APP/FIXT/VERT/IMPORT/READ/KNOW（PR #7）、BOT-001（PR #9）、GOV-001（PR #10）、REL-001（PR #11）、SEARCH-001（PR #12）。未进 `main`。
- `origin/feat/VERT-001`：`6d7914d`（已包含在上述 integration 合入中）

**当前不是正式交付。G1 / G2 均已超时且未通过。** 不得宣布 G1、G2 或正式交付。`main` 上第一次 GitHub Actions 成功（[run 43466573707](https://github.com/1912city-design/bookskill-desktop/actions/runs/43466573707)）以及 integration 合入后的 CI 成功，只证明 Linux runner 上的 CI 基线可执行，不能代替目标 OS 验收。

## 本轮推进（2026-11-14 20:20 起）

- 负责人确认仓库已公开；接受 L-001 至 L-012（D-026）；确认 P-002 合入 `integration`（不合入 `main`、不发布）。
- [PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7) 已于 20:21 Asia/Shanghai 合入 `integration`，merge `71f8390`。合入后 push CI：[run 43594409927](https://github.com/1912city-design/bookskill-desktop/actions/runs/43594409927) success（20:21:45 Asia/Shanghai）。本机合并复核：data 11、core 24、desktop 28，全部通过。
- 本机未找到所称 commit `16dc36d`（分支 `docs/accept-public-and-legal`）。已在当前 `integration` 上重写等价治理文档：B-001 标明公开已连接，B-002 为 ACCEPTED，P-003 关闭，并新增 D-026。
- P-001：原先存在的 ruleset `27261747` 为 `disabled` 且未匹配 `main`、未填写必过检查。已改为 `active`，作用于 `refs/heads/main`，必过 `lint, test, and build`，禁止强推和删分支，只接受 PR。残差：因只有一个 GitHub 协作者，必过人工批准数设为 0，避免无法合入。细则见 `docs/repo/BRANCH_PROTECTION.md`。
- SEARCH-001 / REL-001 工单已补验收条件，进入 Ready，从 `origin/integration` 拉独立分支实施。
- BOT-001、GOV-001 按 D-025 开向 `integration` 的 PR，走独立 QA；不得标 Done，直到 CI + 独立 QA 合入。

## 已完成（本地或已合入 integration，均非正式交付，未进 main）

- GOV-001：审查交付完成；L-001–L-012 已于 2026-11-14 接受（D-026）。清单与验证器仍在 `feat/GOV-001`，待自身 PR + QA 后合入。
- REPO-001：已合入 `integration` 与 `main`。
- DATA-001 / APP-001 / VERT-001 / FIXT-001 / IMPORT-001 / READ-001 / KNOW-001：已随 [PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7) 合入 `integration`（`71f8390`）。未进 `main`，不是正式交付。
- D-025 合入策略：已合入 `integration`（PR #3）。

## 进行中

- BOT-001：本地 34/34 通过；远端 PR + CI + 独立 QA 启动中，完成前不得标 Done。
- taste-skill UI：已有 `GATE: PASS`（2026-11-14 01:23）。本轮继续由 frontend_engineer 做桌面壳美学完善（Inventory → Draw → Build → Assets → Inspect + Gate），证据同步到原型。不是正式 G1，也不是可安装发运包。
- SEARCH-001 / REL-001：工单已就绪，待实现。
- 本治理文档更新：分支 `docs/accept-public-and-legal`。

## 明确未完成

- 未合入 `main`，未发布。
- G1 / G2 未通过。G3 / G4 未启动。
- Phase E / F 仍为 Backlog。
- P-004 至 P-012 仍待决策或已记录待后续高风险改动。

## 阻塞与待决策

见 `docs/BLOCKERS.md` 与 `docs/PENDING_DECISIONS.md`。B-001 已解除。B-002 已 ACCEPTED。


## 本轮推进（2026-11-16 22:10 Asia/Shanghai）

负责人要求提升四项实用性：强化搜索、知识关联建议、模板 + Skill 编辑器、本地版本历史。已拆成可测试工单并启动实现，非正式交付，不宣布 G1/G2。

- 工单：`docs/tickets/SEARCH-002.md`、`REL-002.md`、`SKILL-001.md`、`SKILL-004.md`、`VER-001.md`、`VER-002.md`
- 立即开工：SEARCH-002（ai_skill_engineer）、SKILL-001（frontend_engineer）、VER-001（backend_engineer）
- 排队：REL-002（SEARCH-002 开 PR 后）、SKILL-004（REL-002 开 PR 后）、VER-002（VER-001 接口稳定后）
- VER-001 含知识卡修订表（schema V3），按 D-025 为高风险，独立 QA 通过后仍须人工确认才能合入 `integration`（见 P-013）
- 未签名 macOS 开发样品 `1378c01`（push run 43829187100）七项核心路径已独立 QA 通过，可作后续功能验证底包；本轮功能须重新打官方包并经独立 QA 后才能称为可在该构建上使用。不得使用已失败的 `f78aa00` 包。

