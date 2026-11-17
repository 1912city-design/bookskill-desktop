# GRAPH-001：从蒸馏结果生成知识图谱（核心）

## 摘要

从 `origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577` 拉出 `feat/GRAPH-001`，用 DISTILL-001 公开 API 从 3 本定稿蒸馏夹具构建确定性知识图谱。节点类型对齐锁定 5 段（`positioning` / `principle` / `quote` / `framework` / `skill`）。图谱以 JSON 存在 BookSkill 数据目录，不改 `packages/data` schema，不做桌面 UI（GRAPH-002）。

风险：**中（medium）**。请保持本 PR OPEN，目标仍为 `integration`。不要合入，不要改指向 `main`，不要宣布完成或盖 G1/G2。自测不是独立 QA。

## 变更

- 新增 `packages/core/src/graph/**`：`buildKnowledgeGraph` / `loadKnowledgeGraph` / `saveKnowledgeGraph`
- `packages/core/src/index.ts` 仅追加 graph 导出，未改写 council / distill / 既有导出块
- 新增 `packages/core/test/graph-001.test.ts`
- 报告与测试日志：`docs/graph/`

## 验收对照

1. 三本定稿合计 54 个节点（≥30），五种类型齐全；每节点有 `type`、`label`、`source_filename`、`source_section`。
2. 70 条边均可解释；未确认解释显式标记为推断，不把推断写成夹具原文。
3. 加入第 4 份已校验 5 段蒸馏后重新构建，图谱包含新来源节点。
4. 缺少定位时标记未确认，不伪造 locator。
5. 测试（工作树 `/workspace/bookskill-worktrees/GRAPH-001`，Asia/Shanghai）：
   - `pnpm --filter @bookskill/core test`：**108/108**，exit 0，2026-11-17 21:29:04–21:29:05 CST
   - `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）：**66/66**，exit 0，2026-11-17 21:29:09–21:29:12 CST
6. 未合入，未触 `main`，未改锁定原件。

## 残差

见 `docs/graph/GRAPH-001-REPORT.md`。主要：调用方需在新增蒸馏后显式重建并保存图谱；无跨书边；无桌面视图；夹具默认无已确认 paragraph locator。

## 请不要

- 自行合并本 PR
- 把目标改成 `main` 或合入 `main`
- 标 Done / 盖 G1/G2 / 发布 / 宣布完成
