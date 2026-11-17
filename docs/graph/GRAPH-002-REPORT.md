# GRAPH-002 报告：知识库内可交互图谱视图

- 工单：GRAPH-002
- 分支：`feat/GRAPH-002`
- 工作树：`/workspace/bookskill-worktrees/GRAPH-002`
- 基线：`origin/integration` @ `b6ff0ea0bcc024371341ea782eb06bee93cb9d44`（已合入 GRAPH-001 PR #23 与 COUNCIL-002 PR #24）
- 风险：中
- 目标分支：`integration`（不指向 `main`，不自行合入）

## 摘要

在现有「知识库」视图内展示已合入的 GRAPH-001 知识图谱：按书聚合（含生命图谱摘要），节点可点。点击后若定位是夹具/蒸馏原文子串且已确认，则跳到对应段落；否则明确标「来源定位未确认」，不伪造定位。未新增一级导航，`DEFAULT_ROUTE_ID` 仍为 `chat`。

本分支开工时 GRAPH-001 已合入 integration。桌面主进程通过薄封装调用公开 API（`buildKnowledgeGraph`、`loadKnowledgeGraph`、`saveKnowledgeGraph`、`knowledgeGraphPath`），没有重写 `packages/core/src/graph/**`，也没有长期临时核心实现。`graph:locate` 是桌面层能力：只有夹具子串才视为可确认跳转。

## 验收对照

1. 知识库内可打开图谱视图，稳定 testid：`library-graph`，以及 `library-graph-node`、`library-graph-edge`、`library-graph-book-group`、`library-graph-life`、`library-graph-locate`、`library-graph-unconfirmed`、`library-graph-error`、`library-graph-passage`。不新增一级导航。
2. 三本定稿合计可见节点与边。点击节点跳到对应段落，或标明「未确认」/ `UNCONFIRMED_LOCATION_LABEL`（`来源定位未确认`）。定位若不是夹具子串则保持未确认，不编造精确出处。
3. 按书聚合可见：生命图谱（按书聚合）与按书分组均有。
4. 再导入一份已校验的第 4 份 5 段蒸馏后，图谱包含新书节点（测试用合成夹具，未改三本定稿字节）。
5. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。
6. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。本报告不是独立 QA。

## 实现要点

- 新文件：`packages/desktop/src/main/graph.ts`，`packages/desktop/src/renderer/graph/types.ts`，`packages/desktop/src/renderer/graph/view.ts`，`packages/desktop/test/graph-002.test.ts`
- 追加接线：`main.ts` / `preload.cjs` / `shell-info.ts` / 知识库视图 / `renderer/main.ts` / `styles.css`；`rel-001.test.ts` 与 `rel-002.test.ts` 补齐桥接桩
- IPC：`graph:load`、`graph:locate`
- 桥接：`loadKnowledgeGraph`、`locateGraphNode`（追加在既有 council 方法之后，未删除 `listCouncilSeats`、`askCouncilSeat`、`runCouncilRoundtable`、`enableFixtureCouncilAdapter`）
- 主进程可值导入 `@bookskill/core`；新建 renderer/graph 代码只使用本地类型，不值导入 core 桶
- 未修改：`packages/core/src/graph/**`、`packages/core/src/distill/**`、`packages/core/src/council/**`、`packages/data`、夹具字节与 SHA256SUMS、COUNCIL-002 专属文件（`packages/desktop/src/main/council.ts`、`packages/desktop/src/renderer/council/**`、`packages/desktop/test/council-002.test.ts`）

## 测试命令与结果

环境：Node v24.22.1，pnpm 10.34.6。时区标签均为 Asia/Shanghai（CST，UTC+8）。

### `@bookskill/core test`

- 命令：`pnpm --filter @bookskill/core test`
- 开始：2026-11-17 21:43:04 Asia/Shanghai
- 结束：2026-11-17 21:43:06 Asia/Shanghai
- 结果：108 pass / 0 fail，exit 0
- 日志：`docs/graph/GRAPH-002-pnpm-core-test-output.txt`

### `@bookskill/desktop test`（含 `tsc --noEmit`）

- 命令：`pnpm --filter @bookskill/desktop test`（脚本为 `pnpm --filter @bookskill/repo-baseline build && tsc -p tsconfig.json --noEmit && node --test --test-reporter=spec test/*.test.ts`）
- 开始：2026-11-17 21:43:35 Asia/Shanghai
- 结束：2026-11-17 21:43:39 Asia/Shanghai
- 结果：81 pass / 0 fail，exit 0；`tsc --noEmit` 已执行
- 日志：`docs/graph/GRAPH-002-pnpm-desktop-test-output.txt`

## 残差

- 单元测试通过 `BOOKSKILL_DATA_DIR` + `initializeDataDir` / `openSliceWorkspace` 与渲染 HTML 断言覆盖预览与定位，不打开已打包的 Electron 窗口。
- 定位不是夹具原文子串时保持未确认，不得把推断写成精确出处。
- 本票自测不是独立 QA。独立 QA 通过前不得合入、不得宣布完成、不得盖 G1/G2、不得发布、不得合入 `main`。
- 图谱构建依赖桌面已导入的蒸馏结果（`library/distill`）。知识库打开时会按当前蒸馏重建并写入数据目录中的 GRAPH-001 图谱文件。
