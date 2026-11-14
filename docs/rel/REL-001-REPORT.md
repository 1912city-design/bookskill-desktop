# REL-001 交接报告

- 任务：AI / 规则只能**建议**知识卡之间的关系；用户确认后才写入正式关系。正式关系使用既有表 `knowledge_relations`，关系类型至少覆盖 `supports`、`contradicts`、`example_of`、`related_to`。未确认前不得成为正式关系（对应 D-017）。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/REL-001`
- 基础：`origin/integration` @ `71f8390`（含已合入的 KNOW-001）
- 工作区：`/workspace/bookskill-worktrees/REL-001`
- 完成时间：2026-11-14 20:59 Asia/Shanghai
- 实现提交：`a96abf332a8fc0418d9e298ad12a7205c7f27e42`
- 状态：本地实现与测试已完成。准备推送 `feat/REL-001` 并打开目标为 `integration` 的 PR。**未合入 `main` / `integration`，未发布，未标 Done，未进入 Phase E/F。** 这不是正式发运，也不是 G1。
- 风险等级：**中（medium）**。使用既有 `knowledge_relations` 表，未改 schema / 迁移，未改 KNOW-001 合并或删除契约。

## 状态命名

本实现使用既有 `knowledge_relations(id, from_card_id, to_card_id, relation_type, status)` 五列，不新增表或列。

| `status` 常量 | 存储值 | 含义 |
|---|---|---|
| `RELATION_STATUS_SUGGESTED` | `suggested` | 建议态。`suggestRelation` 写入的唯一状态。出现在建议列表，**不得**出现在已确认列表。 |
| `RELATION_STATUS_VERIFIED` | `verified_by_user` | 正式关系。只有显式的 `confirmRelation`（对应用户确认）可以把建议提升为此状态。与知识卡确认使用同一 token（D-017）。 |
| `RELATION_STATUS_REJECTED` | `rejected` | 驳回态。`rejectRelation` **标记**建议行为 `rejected`，而不是删除该行，以便留下痕迹。驳回后既不出现在建议列表，也不出现在已确认（正式）列表，更不能残留为正式关系。已确认的正式关系不能通过本 API 驳回。 |

允许的 `relation_type`（`ALLOWED_RELATION_TYPES`）：`supports`、`contradicts`、`example_of`、`related_to`。其他值（包括来源链接用的 `derived_from`）会被 API 拒绝。

自环（`from_card_id = to_card_id`）在 API 层以明确错误拒绝，不依赖 SQLite 的 `CHECK (from_card_id <> to_card_id)`。两端知识卡必须已经存在。

列出（`listSuggestedRelations` / `listConfirmedRelations`）与建议都不会自动把建议提升为正式关系。

## 做了什么

在 `@bookskill/core` 与 `@bookskill/desktop` 上实现 REL-001 关系建议 / 确认 / 驳回 / 列表，只追加知识库入口下的关系面板与 IPC，不重写知识卡合并 / 删除实现，不改默认路由。

- 新增 `packages/core/src/relations.ts`：`suggestRelation`（写入 `status=suggested`）、`confirmRelation`（升级为 `verified_by_user`）、`rejectRelation`（标记为 `rejected`）、`listSuggestedRelations` / `listConfirmedRelations`（以及带过滤的 `listRelations`）、`loadRelation`。另提供不写库的规则辅助 `proposeRelationType`，供测试与 UI 默认类型使用；建议 API 仍要求显式传入 `relationType`。
- 经 `packages/core/src/index.ts` **仅追加**导出。未修改 `packages/core/src/knowledge.ts`（P-012：合并不 INSERT 合并边；`deleteKnowledgeCard` 删除契约保持原样）。未修改 `workspace.ts`、`packages/data/**`、导入管道或 SEARCH-001 文件。
- 新增 `packages/desktop/src/renderer/relations/**`：关系视图、建议表单、待确认列表（确认 / 驳回按钮）、已确认正式关系列表。未重写 `packages/desktop/src/renderer/knowledge/**`。关系面板复用既有 `.knowledge-surface` 等样式类，未改 `styles.css`。
- 在现有 `BookskillDesktopBridge` 上追加 `listSuggestedRelations` / `listConfirmedRelations` / `suggestRelation` / `confirmRelation` / `rejectRelation`，以及对应 IPC（`relations:listSuggested` 等）。预加载与主进程同步追加。默认路由仍为 `chat`（`DEFAULT_ROUTE_ID` 未改）。仅在「知识库」导航描述末尾追加关系建议说明，未新增顶级导航。
- 测试只使用 FIXT-001 许可样本（`fixtures/bookskill-test-primer.epub`）。覆盖建议 → 确认、建议 → 驳回、非法自环被拒绝，以及删除任一端知识卡后建议行与正式行都被既有删除契约清理。

未修改：`packages/core/src/knowledge.ts`、`packages/data/**` 既有迁移、导入管道、阅读 UI、SEARCH-001、FIXT 样本、taste-skill 原型、治理文件（`docs/PROJECT_STATE.md`、`docs/TASKS.md`、`docs/DECISIONS.md`、`docs/BLOCKERS.md`、非本票工单）。未把本票标为 Done，未进入 Phase E/F，未合入 `main`。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 对两张已存在的知识卡，可以生成一条关系建议；建议在确认前不得出现在“已确认关系”列表中 | **通过。** 从 FIXT-001 EPUB 生成两张卡后调用 `suggestRelation`，行状态为 `suggested`，出现在 `listSuggestedRelations`，`listConfirmedRelations` 为空。列出建议不会改变状态。 |
| 2 | 用户确认后，关系以正式状态写入 `knowledge_relations`，且 `relation_type` 为允许集合之一 | **通过。** `confirmRelation` 后该行 `status=verified_by_user`，`relation_type` 为 `supports` / `related_to` 等允许值之一；此时建议列表不再包含该行，已确认列表包含它。 |
| 3 | 用户可以驳回建议；驳回后不得残留为正式关系 | **通过。** `rejectRelation` 将状态标为 `rejected`。该行不再出现在建议列表或已确认列表中，状态也不是 `verified_by_user`。 |
| 4 | 删除任一端知识卡时，既有删除契约仍成立（相关关系行被清理）；本票不得削弱该行为 | **通过。** 测试调用既有 `deleteKnowledgeCard`（未改其实现）。删除起始卡或目标卡后，该卡上的建议关系与已确认关系行均被清理；原书与定位仍在。源码检查确认 `knowledge.ts` 仍执行 `DELETE FROM knowledge_relations WHERE from_card_id = ? OR to_card_id = ?`，且没有 `INSERT INTO knowledge_relations`（P-012）。 |
| 5 | 自动化测试覆盖建议 → 确认、建议 → 驳回、非法自环被拒绝；失败时非零退出 | **通过。** `packages/core/test/rel-001.test.ts` 与 `packages/desktop/test/rel-001.test.ts` 使用 `node:test` + `assert`。自环在写入前被拒绝且不留行。`pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test` 退出码均为 0。既有测试继续通过。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/REL-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**32 passed，0 failed**（既有 24 项 + 本任务新增 8 项）。时间：2026-11-14 20:59 CST（Asia/Shanghai）。完整输出：`docs/rel/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**33 passed，0 failed**（既有 28 项 + 本任务新增 5 项，含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建）。时间：2026-11-14 20:59 CST（Asia/Shanghai）。完整输出：`docs/rel/pnpm-desktop-test-output.txt`

## P-012 与删除契约

- **未修改** `packages/core/src/knowledge.ts`。`mergeKnowledgeCards` 仍不向 `knowledge_relations` INSERT 合并边；`deleteKnowledgeCard` 仍先删除 `from_card_id` / `to_card_id` 匹配的关系行，再删除来源与卡片。本票测试只**调用**删除 API 以证明清理，没有削弱或改写该函数。
- 自动化测试读取 `knowledge.ts` 源码，断言不存在 `INSERT INTO knowledge_relations`，并保留原有 DELETE 语句。

## 交付物路径

- `packages/core/src/relations.ts` — 关系建议 / 确认 / 驳回 / 列表 API
- `packages/core/src/index.ts` — 仅追加导出
- `packages/core/test/rel-001.test.ts` — 验收 1–5 的核心自动化测试
- `packages/desktop/src/renderer/relations/**` — 关系类型、列表 enrichment、HTML 视图
- `packages/desktop/test/rel-001.test.ts` — 关系面板、默认路由与 IPC 接线测试
- `packages/desktop/src/renderer/main.ts` — 仅追加关系面板接线（知识库路由下渲染）
- `packages/desktop/src/main/main.ts`、`preload.cjs` — 仅追加关系 IPC
- `packages/desktop/src/shared/shell-info.ts` — 在既有桥接上追加关系方法
- `packages/desktop/src/shared/navigation.ts` — 仅追加知识库描述中的关系说明；`DEFAULT_ROUTE_ID` 仍为 `"chat"`
- `docs/rel/REL-001-REPORT.md`
- `docs/rel/pnpm-core-test-output.txt`
- `docs/rel/pnpm-desktop-test-output.txt`

## 未解决风险

- **驳回采用标记而非删除。** `rejected` 行会留在 `knowledge_relations` 中，直到任一端知识卡被删除（走既有删除契约）才会清掉。当前 UI 不展示已驳回列表。同一对卡片可以再次生成一条新的建议（本实现未加唯一约束，也未改 schema）。
- **同一 `(from, to, type)` 没有唯一约束。** 现有表不能加列或加约束；重复建议在 API 层也未禁止。若后续需要去重，应由 Orchestrator 评估是否改 schema 或只在 API 层拦截。
- **合并不会改挂关系。** 与 P-012 / 既有删除契约一致：被吸收卡上的建议或正式关系会随删除一并去掉，不会自动改指到保留卡。
- **实机操作依赖主进程 IPC。** 自动化测试覆盖 core API、目录 enrichment 和 HTML 渲染，以及预加载 / 主进程源码接线检查，没有跑完整 Electron 窗口点击。交互回归需独立 QA 在实机中确认。
- 这不是正式发布，也不是可安装发运包。未进入 Phase E/F。未将 REL-001 标为 Done。

## 风险等级说明

**中（medium）。** 只追加关系 API、知识库下的关系面板和 IPC，写入既有 `knowledge_relations` 表，未改迁移、未改 KNOW-001 合并 / 删除实现、未改默认路由。若后续必须为关系去重或合并改挂加新表 / 新列，应由 Orchestrator 记入待决事项并由 DATA 线处理，届时风险应升高。
