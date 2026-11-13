# PROJECT_STATE

- 更新时间：2026-11-14 00:52 Asia/Shanghai
- 合同：`docs/GROK_EXECUTION_SPEC.md`（SHA-256 `7b2cd11ac44e4dcc5d9f4b219c837ce8ddc2be86856e02327352e545418b64d2`）
- 发布仓库：已连接，私有仓库 https://github.com/1912city-design/bookskill-desktop
- 默认分支 `origin/main`：`953ba8d`（合入 REPO-001，PR #1）
- 集成分支 `origin/integration`：`b941d4f`（合入 REPO-001，PR #2）

**当前不是正式交付。G1 / G2 未通过。** 第一次 GitHub Actions 已在 `main` 上跑通（[run 43466573707](https://github.com/1912city-design/bookskill-desktop/actions/runs/43466573707)，2026-11-14 00:49:46 Asia/Shanghai，`success`，约 19 秒）。这只证明仓库 CI 基线在 Linux runner 上可执行，不能代替目标 OS 验收。

## 本轮推进（2026-11-14 00:36 起）

- 用户确认可开 PR，并要求按规格做独立 QA 与闭环合入。
- [PR #1](https://github.com/1912city-design/bookskill-desktop/pull/1) `feat/REPO-001` → `main` 已于 00:49 Asia/Shanghai 合入（merge `953ba8d`），独立 QA 通过记录：`/workspace/bookskill-qa/REPO-001-PR1/QA_REPORT.md`。
- [PR #2](https://github.com/1912city-design/bookskill-desktop/pull/2) 已将同一基线合入 `integration`（00:41 Asia/Shanghai，`b941d4f`）。
- 合入规则已写入 D-025、`docs/policies/merge-policy.yml` 与 `docs/policies/apply-merge-policy.mjs`。
- 待决策集中在 `docs/PENDING_DECISIONS.md`，计划于 2026-11-14 09:30 Asia/Shanghai 汇总一次，不在推进中逐条询问。
- Phase D 工单与独立 worktree 已建立；IMPORT-001 交给 backend_engineer 立即开工。READ-001 / KNOW-001 工作树已就绪，实现排在 taste-skill UI 流程之后，以免打断现有 frontend 任务。
- BookSkill Frontend Engineer 继续只跑完 taste-skill：Inventory → Draw → Build → Assets → Inspect + Gate，只优化 UI，不进入其他阶段。工作区：`/workspace/bookskill-ui-taste`。

## 已完成（本地或已合入，均非正式交付）

- GOV-001：审查交付 Done（不构成法律批准）。分支 `feat/GOV-001` @ `18281a88ae64d38a9af38308490aa937cba28843`。待确认 L-001–L-012；公开发行仍受 B-002 阻塞。未合入。
- REPO-001：已合入 `integration` 与 `main`。Head 实现链 `adfa28c` / `9072603` / `630b761`。第一次 `main` CI success。不得据此宣布 G1/G2。
- BOT-001：本地 34/34 通过。分支 `feat/BOT-001` @ `f284b8fb042726e9ae32757613bb0b8afa18c6e2`。远端 PR/CI 现可启动，完成前不得标 Done。
- DATA-001：本地产物 Done，未合入；合入 `integration` 属高风险，见 P-002。分支 `feat/DATA-001` @ `8bf68e114237653fc86538ed28e47154e9a723e2`。
- APP-001：本地 Linux 开发骨架 Done；G1 未通过；未合入。分支 `feat/APP-001` @ `f98e9c11a5656c78fa4f3c367faf9d01a4a5bf63`。
- VERT-001：本地薄切片 Done；未合入；不是正式交付。分支 `feat/VERT-001` @ `7cc95eea53e4fe620332dd0cf804a6063cd5582c`。
- FIXT-001：许可测试样本仍可用，只读。

## 进行中

- IMPORT-001：Ready / In Progress，`feat/IMPORT-001` 基于 `feat/VERT-001`。
- READ-001 / KNOW-001：Ready，工作树已建，等待 frontend 完成 taste-skill 后再实现。
- taste-skill UI：既有任务，目录 `/workspace/bookskill-ui-taste`。截至编排时尚无 `EVIDENCE.md`，也未同步到 `prototypes/desktop-shell/`。
- D-025 合入策略文档：分支 `feat/D-025-merge-policy`，低/中风险，将走 CI + 独立 QA 后自动合入 `integration`。

## 明确未完成

- 分支保护未启用（P-001）。
- 已验收但未合入的功能分支：GOV-001、BOT-001、APP-001、DATA-001（高风险）、VERT-001。
- Phase E / F 仍为 Backlog。
- 不得宣布 G1、G2 或正式交付。

## 阻塞与待决策

见 `docs/BLOCKERS.md` 与 `docs/PENDING_DECISIONS.md`。B-001（仓库未连接）已解除。
