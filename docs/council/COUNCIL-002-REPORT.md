# COUNCIL-002 交接报告

- 任务：把已合入的 COUNCIL-001 核心 API 接到桌面，在现有「问题对话」路径里展示三个稳定席位，支持单席问答与至少两席连续发言再总结的圆桌。每条发言显示 `source_filename`。不新增一级导航，`DEFAULT_ROUTE_ID` 仍为 `chat`。
- 负责人：frontend_engineer（BookSkill Frontend Engineer）
- 分支：`feat/COUNCIL-002`
- 基线：`origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577`（VER-001 merge）
- 工作树：`/workspace/bookskill-worktrees/COUNCIL-002`
- 实现时间：2026-11-17 21:23–21:30 Asia/Shanghai
- 分支 tip / 实现提交：`SHA_PLACEHOLDER`
- 状态：本地实现与测试已完成，已准备（或已打开）目标为 `integration` 的 PR。**未自行合入，未触 `main`，未宣布完成，未盖 G1/G2，未发布，未把工单标为 Done。** 自测不是独立 QA。
- 风险等级：**中（medium）**。UI 与 IPC 接线；未改 schema / 迁移；席位 Skill 保持 `draft`，不会自动发布。

## 变更摘要

在现有对话页（`chat`）下方增加「智囊团席位」面板，调用已合入的 COUNCIL-001 公开 API：

- `establishCouncilSeats` / `listCouncilSeats`
- `askCouncilSeat`
- `runCouncilRoundtable`
- `createFixtureCouncilAdapter`（测试注入或显式启用的夹具演示适配器）

三个稳定席位：

| seat_id | 名称 | 书名 | source_filename | Skill 状态 |
|---|---|---|---|---|
| `sunzi-decision` | 决策席 | 孙子兵法 | `孙子兵法_蒸馏结果.md` | draft |
| `lunyu-conduct` | 处事席 | 论语 | `论语_蒸馏结果.md` | draft |
| `laozi-wuwei` | 无为席 | 道德经 | `道德经_蒸馏结果.md` | draft |

主进程模块 `packages/desktop/src/main/council.ts` 负责建立席位、调用核心编排并返回桌面视图数据。未配置生成适配器时，`ask` / `roundtable` 返回失败并在面板以 `council-error` 显示，不会假装在线模型成功。测试注入 `createFixtureCouncilAdapter()`；桌面也可显式点击「使用夹具演示适配器」，结果标注为「夹具演示适配器（非在线模型）」。也可用环境变量 `BOOKSKILL_COUNCIL_ADAPTER=fixture` 显式启用同一夹具适配器。

编造引用会被核心 `validateCouncilCitations` 拒绝；桌面捕获后显示错误，不把编造原文当作已确认出处。

只改了 `packages/desktop` 与本目录文档。未改 `packages/core/src/council/**`、`distill/**`、`graph/**`、`packages/data`，未改夹具字节或 `SHA256SUMS`。未新增 graph/renderer 文件，避免与后续 GRAPH-002 抢同一新文件。未开工 GRAPH-002 / VER-002。

## IPC 与桥接

| 桥接方法 | IPC | 说明 |
|---|---|---|
| `listCouncilSeats()` | `council:listSeats` | 建立/复用 draft 席位并列出 |
| `askCouncilSeat({ seatId, question, useFixtureAdapter? })` | `council:askSeat` | 单席问答 |
| `runCouncilRoundtable({ question, seatIds?, useFixtureAdapter? })` | `council:runRoundtable` | 圆桌（默认三席，至少两席 + 总结） |
| `enableFixtureCouncilAdapter()` | `council:enableFixtureAdapter` | 显式启用夹具演示适配器 |

上述方法均为 `BookskillDesktopBridge` **必填**字段。已补齐既有完整桥接桩：

- `packages/desktop/test/rel-001.test.ts`
- `packages/desktop/test/rel-002.test.ts`

`distill-002.test.ts` 以及其他 desktop 测试不构造完整 `BookskillDesktopBridge` 对象，无需补桩。

## 主要文件

新增：

- `packages/desktop/src/main/council.ts`
- `packages/desktop/src/renderer/council/types.ts`
- `packages/desktop/src/renderer/council/view.ts`
- `packages/desktop/test/council-002.test.ts`
- `docs/council/COUNCIL-002-REPORT.md`
- `docs/council/pull-request.md`
- `docs/council/COUNCIL-002-pnpm-core-test-output.txt`
- `docs/council/COUNCIL-002-pnpm-desktop-test-output.txt`

追加接线：

- `packages/desktop/src/main/main.ts`
- `packages/desktop/src/main/preload.cjs`
- `packages/desktop/src/renderer/main.ts`
- `packages/desktop/src/renderer/styles.css`
- `packages/desktop/src/shared/shell-info.ts`
- `packages/desktop/test/rel-001.test.ts`
- `packages/desktop/test/rel-002.test.ts`

主进程可以值导入 `@bookskill/core`。新的 `renderer/council/**` 只使用本地类型，不得值导入 core 桶（测试已断言）。

## UI 验收与 testid

面板挂在现有「问题对话」路由内，不是第六个一级导航。`DEFAULT_ROUTE_ID` 仍为 `"chat"`。一级路由仍是 `chat` / `library` / `knowledge` / `skills` / `settings`。

| testid | 用途 |
|---|---|
| `council-panel` | 智囊团面板 |
| `council-seat-sunzi-decision` | 决策席 |
| `council-seat-lunyu-conduct` | 处事席 |
| `council-seat-laozi-wuwei` | 无为席 |
| `council-question` | 问题输入 |
| `council-ask` | 单席提问 |
| `council-roundtable` | 召开圆桌 |
| `council-utterance` | 发言（含席位与总结条目） |
| `council-source-filename` | 每条发言的来源文件名 |
| `council-summary` | 圆桌总结标记 |
| `council-error` | 可见失败（含未配置适配器、编造引用） |
| `council-citation` | 已通过校验的夹具引用 |
| `council-enable-fixture` | 显式启用夹具演示适配器 |
| `council-adapter-kind` | 当前适配器类型说明 |

## 验收对照

| # | 条件 | 结果 |
|---|---|---|
| 1 | 桌面可看到三个稳定席位，testid 稳定，不新增一级导航 | **自测通过。** `listDesktopCouncilSeats` 返回三席且均为 `draft`。`renderCouncilPanel` 含 `council-seat-sunzi-decision` / `lunyu-conduct` / `laozi-wuwei`。`NAV_ITEMS.length === 5`，`DEFAULT_ROUTE_ID === "chat"`，导航源中无 `id: "council"`。 |
| 2 | 单席提问返回内容能指向对应夹具，并显示 `source_filename` | **自测通过。** 向 `sunzi-decision` 注入夹具适配器后，发言与引用均指向 `孙子兵法_蒸馏结果.md`，面板渲染 `council-source-filename`。 |
| 3 | 圆桌至少两席依次发言再总结；每条发言带来源文件名；引用为夹具子串或标未确认 | **自测通过。** 三席按序发言后一条「圆桌总结」；每条都有 `source_filename`。编造原文会被核心拒绝，UI 以 `council-error` 显示「未确认」，不渲染 `council-citation`。 |
| 4 | 未配置生成适配器时不得假装成功 | **自测通过。** 无适配器时返回 `NO_COUNCIL_ADAPTER_REASON`，面板显示 `council-error`，不出现发言，`data-adapter-kind` 为 `none`。 |
| 5 | `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0 | **自测通过。** 见下方测试结果。 |
| 6 | 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main` | **遵守。** 本报告只记录自测；不自行合并。 |

## 测试命令与结果

环境：Node `v24.22.1`，pnpm `10.34.6`。工作树 `/workspace/bookskill-worktrees/COUNCIL-002`。时区 Asia/Shanghai（CST，UTC+8）。

### `@bookskill/core`

```bash
pnpm --filter @bookskill/core test
```

- 时间：2026-11-17 21:29:54–21:29:55 Asia/Shanghai
- 结果：100 passed，0 failed
- 退出码：0
- 日志：`docs/council/COUNCIL-002-pnpm-core-test-output.txt`

此前在 21:28:53–21:28:54 Asia/Shanghai 已跑通同一命令，同样 100/0、exit 0。

### `@bookskill/desktop`

```bash
pnpm --filter @bookskill/desktop test
```

该脚本包含 `tsc -p tsconfig.json --noEmit`，再跑 `node --test test/*.test.ts`。

- 时间：2026-11-17 21:30:17–21:30:20 Asia/Shanghai
- 结果：74 passed，0 failed（含新增 8 项 COUNCIL-002 用例）
- 退出码：0
- `tsc --noEmit`：已运行（作为 test script 的前置步骤，未单独失败）
- 日志：`docs/council/COUNCIL-002-pnpm-desktop-test-output.txt`

此前在 21:29:29–21:29:32 Asia/Shanghai 已跑通同一命令，同样 74/0、exit 0。

夹具 SHA-256 与 `packages/core/test/fixtures/distill/SHA256SUMS` 一致，实现过程未改字节：

- `孙子兵法_蒸馏结果.md` `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- `论语_蒸馏结果.md` `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- `道德经_蒸馏结果.md` `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`
- `蒸馏提示词模板.md` `7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2`

## 残差 / 后续

- 夹具演示适配器或测试注入适配器不是在线模型；未配置适配器时必须显式启用或注入后才能提问。
- 单元测试不打开打包后的 Electron 窗口；桌面真实窗口交互需独立 QA。
- 独立 QA 通过前不得合入，不得宣布完成 / 可试用，不得盖 G1/G2，不得发布。
- 席位 Skill 仍为 draft，本票不自动发布，也不把 AnythingLLM workspace Pin 做成 UI 步骤。
- 后续工单可再打磨席位卡片、圆桌选席交互或知识库入口；本票未在知识库路径增加入口。
- 未开工 GRAPH-002 / VER-002。

## 夹具哈希

未改 `packages/core/test/fixtures/distill/**` 或桌面夹具副本字节，也未改 `SHA256SUMS`。测试断言哈希保持不变。
