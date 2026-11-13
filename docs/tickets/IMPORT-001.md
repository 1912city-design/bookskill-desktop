# IMPORT-001：导入、去重、失败状态和重试

- ID：IMPORT-001
- 阶段：D
- 目标：在 VERT-001 薄切片之上，补齐 PDF/EPUB/MD/TXT 导入、去重、失败状态和重试，并留下可重复测试。
- 负责人 Agent：backend_engineer（BookSkill Backend Engineer）
- 依赖：VERT-001（本地已验收，未合入 main / integration）。从 `feat/VERT-001` 拉出独立分支，不要从只有仓库基线的 `main` 起做。
- 状态：Ready / 启动中
- 启动时间：2026-11-14 00:52 Asia/Shanghai
- 分支 / 工作树：`feat/IMPORT-001`，`/workspace/bookskill-worktrees/IMPORT-001`
- 风险等级（预估）：低/中（若必须新增或修改 schema 迁移，则升为高风险，合入 `integration` 需人工确认；本地实现与测试仍继续）
- 测试样本：只使用 FIXT-001 的许可/CC0 样本，或同等自有、开放许可、人工合成内容。不得把无授权整本书写入仓库。

## 允许写入

- `packages/core/src/import-book.ts`、`parse-epub.ts`、`parse-pdf.ts`、`chunks.ts`、`zip.ts`
- 新建 `packages/core/src/import/**` 与对应测试 `packages/core/test/**`（仅导入/去重/失败/重试）
- `docs/import/**`
- `packages/core/src/index.ts` 仅允许追加本任务的导出，禁止无关重构

## 禁止写入

- `packages/core/src/knowledge.ts`、`conversation.ts`、`skills.ts`、`recommend.ts`、`stub-adapter.ts`
- `packages/desktop/src/renderer/**`（阅读/知识卡 UI 归 READ-001 / KNOW-001）
- `packages/data/**` 的既有迁移（除非为失败/重试状态所必需；一旦改迁移须在 PR 标明高风险）
- FIXT-001 样本正文、治理文件（`docs/DECISIONS.md`、`docs/PROJECT_STATE.md`、`docs/BLOCKERS.md`、`docs/TASKS.md`、`docs/PENDING_DECISIONS.md`、`docs/policies/**`）
- 不得合入 `main`，不得发布

## 验收条件（可测试）

1. 能导入 FIXT-001（或同等许可）中的 PDF、EPUB、MD、TXT，并写入 BookSkill 自有库，而不是 AnythingLLM 内部库。
2. 对同一文件的重复导入可被识别（不产生第二条独立书记录，或明确标记为重复）；测试必须覆盖此路径。
3. 导入失败时有持久化的失败状态（可查询、可展示给后续 UI），且不会写坏已存在的书库数据。
4. 失败项可以重试；重试成功后状态更新，已有成功记录保持不变。
5. 相关单测在失败断言时以非零退出码失败；修复后 `pnpm --filter @bookskill/core test`（或本任务新增包的等效命令）退出码 0。
6. 仓库中不新增无授权整书。数据目录继续拒绝 AnythingLLM / mintplex 路径名。

## 测试命令

```bash
# 在 /workspace/bookskill-worktrees/IMPORT-001
pnpm --filter @bookskill/core test
# 若本任务新增包，再跑对应 filter；最终应能纳入 pnpm lint / test / build
```

## 交付物路径

- 实现与测试（见允许写入）
- `docs/import/IMPORT-001-REPORT.md`
- 后续远端 PR 必须附：改动摘要、验收条件逐条结果、测试命令及结果、未解决风险、风险等级

## 失败升级条件

最多自动重试 2 次；其后标 BLOCKED，写最短路径，不阻塞 READ-001 / KNOW-001。若涉及 schema 迁移，记入 `docs/PENDING_DECISIONS.md`，本地工作继续。
