# PROJECT_STATE

- 更新时间：2026-11-14 01:36 Asia/Shanghai
- 合同：`docs/GROK_EXECUTION_SPEC.md`（SHA-256 `7b2cd11ac44e4dcc5d9f4b219c837ce8ddc2be86856e02327352e545418b64d2`）
- 发布仓库：已连接，私有仓库 https://github.com/1912city-design/bookskill-desktop
- 默认分支 `origin/main`：`953ba8d`（合入 REPO-001，PR #1）
- 集成分支 `origin/integration`：`46aa811`（合入 D-025，PR #3）
- `origin/feat/VERT-001`：`f109cd2`（合入 IMPORT-001，PR #4；未合入 `integration` / `main`）

**当前不是正式交付。G1 / G2 未通过。** 第一次 GitHub Actions 已在 `main` 上跑通（[run 43466573707](https://github.com/1912city-design/bookskill-desktop/actions/runs/43466573707)，2026-11-14 00:49:46 Asia/Shanghai，`success`，约 19 秒）。这只证明仓库 CI 基线在 Linux runner 上可执行，不能代替目标 OS 验收。

## 本轮推进（2026-11-14 00:36 起）

- 用户确认可开 PR，并要求按规格做独立 QA 与闭环合入。
- [PR #1](https://github.com/1912city-design/bookskill-desktop/pull/1) `feat/REPO-001` → `main` 已于 00:49 Asia/Shanghai 合入（merge `953ba8d`），独立 QA 通过记录：`/workspace/bookskill-qa/REPO-001-PR1/QA_REPORT.md`。
- [PR #2](https://github.com/1912city-design/bookskill-desktop/pull/2) 已将同一基线合入 `integration`（00:41 Asia/Shanghai，`b941d4f`）。
- 合入规则已写入 D-025、`docs/policies/merge-policy.yml` 与 `docs/policies/apply-merge-policy.mjs`。
- 待决策集中在 `docs/PENDING_DECISIONS.md`，计划于 2026-11-14 09:30 Asia/Shanghai 汇总一次，不在推进中逐条询问。
- Phase D：IMPORT-001 已独立 QA 通过并合入 `feat/VERT-001`（PR #4，`f109cd2`，2026-11-14 01:05 Asia/Shanghai），未合入 `integration` / `main`，不得标 Done（P-002）。
- taste-skill 完整流程已跑完。独立核对 `logs/gate-3.txt` 与 `.taste-skill/gate.json`：`GATE: PASS`（2026-11-14 01:23 Asia/Shanghai），开着的 FAIL 无，10 条非阻断 WARN，2 条工作台-vs-营销栅格豁免未对上开放 finding。证据：`/workspace/bookskill-desktop/prototypes/desktop-shell/EVIDENCE.md`。这不是正式 G1，也不是可安装发运包。
- READ-001 已开 [PR #5](https://github.com/1912city-design/bookskill-desktop/pull/5)（`feat/READ-001` @ `c24bd87` → `feat/VERT-001`）。提交者本机测试 22/0 desktop、15/0 core（01:33 Asia/Shanghai）。远端 CI 两跑 success。已安排独立 QA。不得标 Done，不得自动合入 `integration` / `main`。KNOW-001 仍 Ready，等 READ-001 合入 `feat/VERT-001` 后再开工。

## 已完成（本地或已合入，均非正式交付）

- GOV-001：审查交付 Done（不构成法律批准）。分支 `feat/GOV-001` @ `18281a88ae64d38a9af38308490aa937cba28843`。待确认 L-001–L-012；公开发行仍受 B-002 阻塞。未合入。
- REPO-001：已合入 `integration` 与 `main`。Head 实现链 `adfa28c` / `9072603` / `630b761`。第一次 `main` CI success。不得据此宣布 G1/G2。
- BOT-001：本地 34/34 通过。分支 `feat/BOT-001` @ `f284b8fb042726e9ae32757613bb0b8afa18c6e2`。远端 PR/CI 现可启动，完成前不得标 Done。
- DATA-001：本地产物 Done，未合入；合入 `integration` 属高风险，见 P-002。分支 `feat/DATA-001` @ `8bf68e114237653fc86538ed28e47154e9a723e2`。
- APP-001：本地 Linux 开发骨架 Done；G1 未通过；未合入。分支 `feat/APP-001` @ `f98e9c11a5656c78fa4f3c367faf9d01a4a5bf63`。
- VERT-001：本地薄切片 Done；现含已合入的 IMPORT-001（`f109cd2`）；仍未合入 `integration` / `main`；不是正式交付。
- FIXT-001：许可测试样本仍可用，只读。

## 进行中

- IMPORT-001：已合入 `feat/VERT-001`（PR #4）；未进 `integration` / `main`；不得标 Done。
- READ-001：Pull Request，[PR #5](https://github.com/1912city-design/bookskill-desktop/pull/5)，头 `c24bd87`，待独立 QA。
- KNOW-001：Ready，工作树已快进至 `f109cd2`，等 READ-001 完成后再实现。
- taste-skill UI：GATE: PASS。产物 `/workspace/bookskill-ui-taste/`，已同步到 `/workspace/bookskill-desktop/prototypes/desktop-shell/`（当前仍为未跟踪工作副本，未合入任何分支）。
- D-025 合入策略：已合入 `integration`（PR #3，`46aa811`）。

## 明确未完成

- 分支保护未启用（P-001）。
- 已验收但未合入 `integration` / `main` 的功能分支：GOV-001、BOT-001、APP-001、DATA-001（高风险）、VERT-001（现含 IMPORT-001）。
- Phase E / F 仍为 Backlog。
- 不得宣布 G1、G2 或正式交付。

## 阻塞与待决策

见 `docs/BLOCKERS.md` 与 `docs/PENDING_DECISIONS.md`。B-001（仓库未连接）已解除。
