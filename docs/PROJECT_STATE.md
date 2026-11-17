# PROJECT_STATE

## 当前快照（2026-11-17 21:18 Asia/Shanghai）

这不是正式交付。G1 / G2 已超时且未通过，G3 / G4 未启动。不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

- 发布仓库：https://github.com/1912city-design/bookskill-desktop （公开，已连接）
- `origin/main`：`953ba8d6d74fb174e076a208a09b67a70c18b996`（仅 REPO-001）
- `origin/integration`：`5fe203b0b1c24d64b53415ddf2242297b225e577`（2026-11-17 21:18:46 Asia/Shanghai，Merge [PR #15](https://github.com/1912city-design/bookskill-desktop/pull/15) VER-001）。parents：`b3a240c` + `3241ee2`。
- 已在 integration、未进 main：DATA/APP/FIXT/VERT/IMPORT/READ/KNOW、BOT-001、GOV-001、REL-001、SEARCH-001、PATH-001、SEARCH-002、SKILL-001、REL-002、SKILL-004、COUNCIL-001、DISTILL-001、DISTILL-002、VER-001（schema V3）
- 官方未签名 macOS 开发包仍钉在 `1378c01` / Actions run 43829187100，七条核心路径独立 QA 为 PASS；该包不含 11-16 晚之后合入的功能。失败包 `f78aa00` 不得再用。PKG-001 [PR #13](https://github.com/1912city-design/bookskill-desktop/pull/13) 仍开放。
- VER-001 独立 QA：`/workspace/bookskill-qa/VER-001-PR15-3241ee2/QA_REPORT.md`（通过，高风险）。桌面历史 UI 仍属 VER-002。
- 本轮已冻结并启动：GRAPH-001（核心，ai_skill）、COUNCIL-002（智囊团桌面，frontend，优先可演示闭环）。已冻结并排队：GRAPH-002（图谱桌面，frontend，在 COUNCIL-002 开出 PR 后开工）、DISTILL-003、SKILL-FUSE-001（均在 GRAPH-001 开出 PR 后由 ai_skill 依次开工）。
- 仍待决策：P-004 至 P-012（P-013 已确认并执行：VER-001 只合入 integration）。

以下为 2026-11-14 及更早的历史正文，指针可能过时，以本节与 GitHub 为准。

- 更新时间：2026-11-14 20:51 Asia/Shanghai
- 合同：`docs/GROK_EXECUTION_SPEC.md`（SHA-256 `7b2cd11ac44e4dcc5d9f4b219c837ce8ddc2be86856e02327352e545418b64d2`）
- 发布仓库：已连接，**公开**仓库 https://github.com/1912city-design/bookskill-desktop
- 默认分支 `origin/main`：`953ba8d`（合入 REPO-001，PR #1）。分支保护：repository ruleset `27261747`，`enforcement: active`（P-001，2026-11-14 20:50 Asia/Shanghai）。
- 集成分支 `origin/integration`：`71f8390`（[PR #7](https://github.com/1912city-design/bookskill-desktop/pull/7)，P-002 人工确认后合入 DATA/APP/FIXT/VERT/IMPORT/READ/KNOW）
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
