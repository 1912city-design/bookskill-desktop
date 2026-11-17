# GRAPH-002：知识库内可交互图谱视图（P1）

- ID：GRAPH-002
- 阶段：E
- 目标：在现有「知识库」视图内展示 GRAPH-001 的图谱：可交互、点击节点跳到对应段落（或标明未确认）。生命图谱按书聚合。不新增一级导航。
- 负责人 Agent：frontend_engineer（BookSkill Frontend Engineer）
- 依赖：GRAPH-001 冻结 API（见同目录 `GRAPH-001.md`）。可在 `feat/GRAPH-002` 上按该契约先做 UI；若本分支尚未合入 GRAPH-001，使用本地临时适配器或夹具图谱，但三本定稿必须能走通预览与定位。
- 状态：Ready（本轮先开 COUNCIL-002 以尽快演示智囊团；本票在 COUNCIL-002 开出 PR 后立即开工，或在其合入前按文件隔离并行准备，但不要与 COUNCIL-002 抢同一新文件）
- 风险等级：中（UI 与 IPC；不改 schema）
- 基线：从当时的 `origin/integration` 拉出 `feat/GRAPH-002`（当前尖端是 `5fe203b`；开工前再 fetch）
- 测试样本：三本定稿夹具只读副本，不得改哈希，不得改原件。

## 允许修改

- 新建 `packages/desktop/src/renderer/graph/**`
- 追加接线：知识库视图、`packages/desktop/src/main/**`、`preload`、shared 类型、`styles.css`、`packages/desktop/test/graph-002.test.ts`
- 建议 IPC：`graph:load`、`graph:locate`；桥接：`loadKnowledgeGraph`、`locateGraphNode`。`BookskillDesktopBridge` 是必填字段类型，所有既有测试桩都必须补齐新方法，否则 desktop `tsc` 失败

## 禁止修改

- `packages/core/src/graph/**`（归 GRAPH-001）、`packages/core/src/distill/**`、`packages/core/src/council/**`、`packages/data`
- 第六个一级导航；`DEFAULT_ROUTE_ID` 必须仍为 `chat`
- 锁定模板与定稿原件；自动发布 Skill

## 验收条件（已冻结）

1. 知识库内可打开图谱视图（`data-testid` 必须稳定，例如 `library-graph`），不新增一级导航。
2. 三本定稿合计能看到节点与边；点击节点跳到对应段落，或明确标「未确认」，不得伪造定位。
3. 按书聚合可见（生命图谱/按书分组至少一种）。
4. 增加一份已校验蒸馏后，图谱可更新（可用夹具/临时适配器断言）。
5. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。
6. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

## 交付

- 分支 `feat/GRAPH-002`，工作树建议 `/workspace/bookskill-worktrees/GRAPH-002`
- 远端 PR：目标 `integration`，风险 medium
- 不要自己合并，不要触 `main`
