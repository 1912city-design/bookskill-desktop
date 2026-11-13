# KNOW-001：知识卡草稿/确认、编辑、合并、删除

- ID：KNOW-001
- 阶段：D
- 目标：知识卡以 `draft` 创建，用户确认后才变为 `verified_by_user`；支持编辑、合并、删除；删除卡片不得删除原书（对应 AT-03）。
- 负责人 Agent：frontend_engineer（BookSkill Frontend Engineer）
- 依赖：VERT-001 + READ-001。从已含 READ-001 的 `origin/feat/VERT-001`（`a83e0a0`）拉出独立分支。
- 状态：Landed on `feat/VERT-001`（[PR #6](https://github.com/1912city-design/bookskill-desktop/pull/6)，merge `6d7914d`，2026-11-14 01:51 Asia/Shanghai）。未进 `integration` / `main`，不得标 Done。
- 启动时间：2026-11-14 00:52 Asia/Shanghai（工作树）
- 实现启动时间：2026-11-14 01:39 Asia/Shanghai
- PR 打开时间：2026-11-14 01:48 Asia/Shanghai
- 合入时间：2026-11-14 01:51 Asia/Shanghai（独立 QA PASS 后仅合入 `feat/VERT-001`）
- 分支 / 工作树：`feat/KNOW-001` @ `4129bd5`，`/workspace/bookskill-worktrees/KNOW-001`
- 视觉参考（只读，禁止改）：`/workspace/bookskill-desktop/prototypes/desktop-shell/`，证据 `/workspace/bookskill-desktop/prototypes/desktop-shell/EVIDENCE.md`
- 风险等级（预估）：低/中（不得让 AI 自动发布为正式卡，见 D-017 / D-018）
- 测试样本：只使用 FIXT-001 或同等许可/合成样本。

## 允许写入

- `packages/core/src/knowledge.ts` 与新建 `packages/core/src/knowledge/**`、对应测试
- 新建 `packages/desktop/src/renderer/knowledge/**` 及对应测试
- `docs/know/**`
- `packages/core/src/index.ts` 与 `packages/desktop/src/renderer/main.ts` / `index.html` / `styles.css` 仅允许追加知识库入口接线

## 禁止写入

- 导入管道文件（IMPORT-001 所有权）与 `packages/desktop/src/renderer/read/**`（READ-001 所有权）
- `packages/data/**` 既有迁移（若确需新表，PR 标明高风险并记入 `docs/PENDING_DECISIONS.md`）
- FIXT-001 样本正文、治理文件、`/workspace/bookskill-ui-taste/**`
- 不得合入 `main`，不得发布，不得进入 Phase E/F
- 不得让 AI 把草稿自动变为 `verified_by_user` 或自动发布 Skill

## 验收条件（可测试）

1. 从来源生成的知识卡初始状态为 `draft`。
2. 用户编辑并确认后，状态变为 `verified_by_user`，且来源关系保持不变。
3. 支持合并与删除知识卡；删除卡片后原书仍在，书中定位仍可用。
4. AI 不能自行把草稿确认为正式卡。
5. 自动化测试覆盖上述路径；失败时非零退出。

## 测试命令

```bash
# 在 /workspace/bookskill-worktrees/KNOW-001
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

## 交付物路径

- `docs/know/KNOW-001-REPORT.md`
- 实现与测试（见允许写入）
- 远端 PR 四件套

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 IMPORT-001 / READ-001 的文件。
