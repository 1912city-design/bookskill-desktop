# COUNCIL-002：智囊团桌面席位与圆桌（P1，可演示闭环）

- ID：COUNCIL-002
- 阶段：E
- 目标：把已合入的 COUNCIL-001 核心 API 接到桌面：在现有对话/知识路径里提供三个席位卡片，支持单席问答与至少两席连续发言再总结的圆桌。每条发言必须显示 `source_filename`。不新增一级导航。
- 负责人 Agent：frontend_engineer（BookSkill Frontend Engineer）
- 依赖：COUNCIL-001、DISTILL-001、DISTILL-002 已在 `origin/integration`（`5fe203b`）。调用核心公开 API，不要重写席位或夹具解析。
- 状态：Ready（本轮优先开工，以便先形成可演示的智囊团闭环）
- 风险等级：中（UI 与 IPC；不改 schema；不自动发布 Skill）
- 基线：从 `origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577` 拉出 `feat/COUNCIL-002`
- 测试样本：三本定稿夹具只读副本，不得改哈希，不得改原件。

## 稳定席位

- `sunzi-decision`：决策席 / 孙子兵法
- `lunyu-conduct`：处事席 / 论语
- `laozi-wuwei`：无为席 / 道德经

## 允许修改

- 新建 `packages/desktop/src/renderer/council/**`
- 追加接线：对话视图或知识库内的席位入口、`packages/desktop/src/main/**`、`preload`、shared 类型、`styles.css`、`packages/desktop/test/council-002.test.ts`
- 建议 IPC：`council:askSeat`、`council:runRoundtable`；桥接方法须加入完整 `BookskillDesktopBridge`，并补齐既有测试桩（含 rel-001 / rel-002 / distill 等）
- 主进程可以导入 `@bookskill/core`；renderer 不得值导入 core 桶

## 禁止修改

- `packages/core/src/council/**`、`packages/core/src/distill/**`、`packages/core/src/graph/**`、`packages/data`
- 第六个一级导航；`DEFAULT_ROUTE_ID` 必须仍为 `chat`
- 锁定模板与定稿原件；编造引用原文；自动发布 Skill

## 验收条件（已冻结）

1. 桌面可看到三个稳定席位（`data-testid` 稳定，例如 `council-seat-sunzi-decision` 等），不新增一级导航。
2. 单席提问返回内容能指向对应夹具，并显示 `source_filename`。
3. 圆桌：至少两个席位依次发言，再给出总结；每条发言带来源文件名；引用不得编造原文（须为夹具子串，或明确标推断/未确认）。
4. 未配置生成适配器时不得假装成功。
5. `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）均为 exit 0。
6. 独立 QA 通过前不得合入，不得宣布完成，不得盖 G1/G2，不得发布，不得合入 `main`。

## 交付

- 分支 `feat/COUNCIL-002`，工作树建议 `/workspace/bookskill-worktrees/COUNCIL-002`
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决残差
- 不要自己合并，不要触 `main`
