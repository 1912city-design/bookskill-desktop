# 分支保护建议（REPO-001）

**状态：`main` 已通过 repository ruleset 生效（P-001）。** 规则集 `main`（id `27261747`），`enforcement: active`，作用于 `refs/heads/main`。配置时间：2026-11-14 20:50 Asia/Shanghai。核对：`GET /repos/1912city-design/bookskill-desktop/rules/branches/main` 返回 deletion、non_fast_forward、pull_request、required_status_checks。Classic Branch protection API 仍返回 404，因为本仓库用的是 ruleset，不是 classic 保护；二者不要混为一谈。

已启用的规则：

1. 禁止删除 `main`。
2. 禁止 force push（non_fast_forward）。
3. 只接受来自 pull request 的合并（不允许直接推送到 `main`）。
4. 必须通过状态检查 `lint, test, and build`（GitHub Actions app `integration_id` 15368），并且分支必须包含目标分支最新提交后再跑检查（`strict_required_status_checks_policy`）。
5. 无 bypass actors；当前账号 `current_user_can_bypass` 为 `never`。

残差（已记录，不是未启用）：仓库目前只有一个 GitHub 协作者 `1912city-design`。按原文“至少 1 个未参与该 PR 提交的人类批准”若设为必过，会在只有同一账号开 PR 时无法合入。因此 `required_approving_review_count` 现为 0。若日后增加独立审查者，再把该计数改为 1。

`integration` 的规则集尚未启用。建议仍是：必过同一 CI 检查、禁止 force push 与删除；低/中风险按 D-025 在 CI + 独立 QA 后自动合入；高风险与生产发布仍须人工确认。不将 `integration` 当作生产发布分支。

## 原先的建议条文（仍作对照）

依据执行合同：主分支始终受保护；生产发布始终需人工批准；低/中风险改动可在 CI 与独立 QA 全通过后自动合入 `integration`；高风险（数据迁移、授权、同步加密、执行外部操作、发布）仍需人工确认。Agent 不能直接推送主分支，也不能合并自己的 PR 到 `main`（除非负责人明确授权且不绕过保护）。

合入 `main` 的来源建议为已经过 CI + 独立 QA（及高风险人工确认）的 `integration`，而不是从功能分支直接合入 `main`。

## 功能分支

- 命名建议：`feat/<TASK-ID>`，例如 `feat/REPO-001`。每个任务使用独立分支或 worktree。
- 功能分支可以推送到远端，但必须通过 PR 进入 `integration`。

## 与 CI 的对应关系

required check 的名称必须与 workflow 里 job 的 `name` 一致：`lint, test, and build`。
