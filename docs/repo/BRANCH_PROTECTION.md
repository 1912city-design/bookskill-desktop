# 分支保护建议（REPO-001）

**状态：仅建议，尚未生效。** 发布仓库尚未连接，本文不得被理解为已在 GitHub 上启用分支保护或规则集。负责人指定组织/仓库并完成推送权限后，再按下列规则配置。

依据执行合同：主分支始终受保护；生产发布始终需人工批准；低/中风险改动可在 CI 与独立 QA 全通过后自动合入 `integration`；高风险（数据迁移、授权、同步加密、执行外部操作、发布）仍需人工确认。Agent 不能直接推送主分支，也不能合并自己的 PR。

## `main`

建议作为默认受保护分支，启用：

1. **禁止直接推送。** 只接受来自 pull request 的合并。关闭 force push，禁止删除该分支。
2. **必须通过状态检查。** 将 GitHub Actions job `lint, test, and build`（workflow 文件 `.github/workflows/ci.yml`）设为 required status check。检查未通过时不能合并。后续若增加独立 QA 检查，一并设为 required。
3. **要求 PR 评审。** 至少 1 个未参与该 PR 提交的人类或指定维护者批准。不建议让同一实现 Agent 自己批准自己的 PR。
4. **要求分支保持最新。** 合并前必须包含目标分支上的最新提交后再跑 required checks。
5. **限制绕过。** 管理员也不应默认绕过上述规则。如需紧急例外，由负责人书面记录。
6. **限制谁能推送到匹配该规则的分支。** 仅维护者角色；执行 Agent 的 token 不得拥有直接推 `main` 或绕过保护的权限。

合入 `main` 的来源建议为已经过 CI + 独立 QA（及高风险人工确认）的 `integration`，而不是从功能分支直接合入 `main`。

## `integration`

本地已预留该分支名（见决策 D-022）。远端启用后建议：

1. 同样要求 required status check（至少 `lint, test, and build`）通过。
2. 禁止 force push 与删除。
3. 低/中风险：CI 与独立 QA 全通过后允许自动合并（例如 auto-merge），仍走 pull request，不直接推送。
4. 高风险改动（数据迁移、授权、同步加密、执行外部操作、发布）关闭自动合并，必须人工批准。
5. 不将 `integration` 当作生产发布分支。生产发布走 `REL-001`，且始终需人工批准。

## 功能分支

- 命名建议：`feat/<TASK-ID>`，例如 `feat/REPO-001`。每个任务使用独立分支或 worktree。
- 功能分支可以推送到远端（仓库连接之后），但必须通过 PR 进入 `integration`。
- 无远端时：只在本地分支提交，并写 `docs/repo/pull-request.md` 作为 PR 草案；不推送、不开远端 PR、不合入 `main`。

## 与 CI 的对应关系

在 GitHub 仓库 Settings → Branches / Rulesets 中，required check 的名称必须与 workflow 里 job 的 `name` 一致：`lint, test, and build`。

在规则实际保存到 GitHub 并出现绿色勾之前，不得声称分支保护已生效。
