# REL-002 交接报告

- 任务：在已合入的 REL-001 关系建议 / 确认 / 驳回 API 上，增加可重复运行的本机发现。根据共用来源、正文/标题重叠、卡片类型规则，自动找出尚未存在的隐藏联系，并写成 `suggested` 建议。严格遵守 D-017：发现过程不得写入正式关系；只有用户确认后才成为 `verified_by_user`。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/REL-002`
- 基础：`origin/integration` @ `5ec45405b2487c1f5e2fa9f35acd0d9ba882f92a`（含已合入的 REL-001 / SEARCH-001 / PATH-001）
- 工作区：`/workspace/bookskill-worktrees/REL-002`
- 完成时间：2026-11-16 22:23 Asia/Shanghai
- 实现提交：`c60494ec9805b9b4a9e79cd889eb374b9484ca32`
- 状态：本地实现与测试已完成。准备推送 `feat/REL-002` 并打开目标为 `integration` 的 PR。**未合入 `main` / `integration`，未发布，未标 Done，未开始 SKILL-004。** 这不是正式发运，也不是 G1。
- 风险等级：**中（medium）**。增强既有 `knowledge_relations` 与 REL-001 API，未改 schema / 迁移，未改 KNOW-001 合并或删除契约，P-012 仍有效。

## 这是 REL-001 的增强，不是另一套关系系统

本票没有新建关系表、状态机或确认流。发现器复用 `suggestRelation` 写入 `status=suggested`，确认与驳回仍走既有 `confirmRelation` / `rejectRelation`。允许的类型仍是 `supports` / `contradicts` / `example_of` / `related_to`。默认路由仍为 `chat`。

## 发现如何工作

`discoverKnowledgeRelations` 扫描书库中的有序卡片对（跳过自环），按下列规则决定是否提出建议。每条建议带一个可测试的 `reason` 字段，供收件箱展示。理由**不落新列**：现有表仍是 `(id, from_card_id, to_card_id, relation_type, status)` 五列，展示时用同一套规则即时解释。

优先级（同一对卡片只取最高优先级的一条理由，关系类型仍由既有 `proposeRelationType` 决定）：

1. **`shared_source`（共用来源段落）**  
   两端知识卡共享同一个 `source_chunk_id`，或共享同一个段落 locator（`paragraphId`）。
2. **`type_rule`（类型规则）**  
   案例 → 原则，默认 `example_of`；原则 → 案例，默认 `supports`。
3. **`text_overlap`（标题/正文重叠）**  
   对标题+正文做本机、确定性的 Jaccard 相似度。分词规则：长度 ≥ 2 的拉丁/数字词，以及汉字单字与相邻汉字二元组。**阈值为 `TEXT_OVERLAP_THRESHOLD = 0.45`。** 测试使用固定合成文本，分别明确高于或低于该阈值。不使用 embedding，不调用外部托管搜索或向量服务。

发现函数本身只调用 `suggestRelation`，**只写入 `suggested`**。源码检查与运行时断言都禁止它写入 `verified_by_user`。

## 幂等与已驳回行为

去重键是有向的 `(from_card_id, to_card_id, relation_type)`：

- 重复运行发现时，若该三元组已有 `suggested` 行，则复用该行，不插入重复待确认建议。
- 若该三元组已是 `verified_by_user`，发现不会覆盖、改写或再插入一条建议。
- 若该三元组已是 `rejected`，发现不会自动再次插入为 `suggested`，更不会写成正式关系。
- 自环（`from_card_id = to_card_id`）在解释阶段被跳过；既有 `suggestRelation` 仍会在写入前拒绝自环。

## D-017、P-012、schema 与默认路由

- **D-017：** `discoverKnowledgeRelations` 不得、也不会把关系写成 `verified_by_user`。只有既有 `confirmRelation`（以及桌面层显式的确认 / 批量确认 IPC，内部仍调用 `confirmRelation`）可以提升为正式关系。
- **P-012：** 未修改 `packages/core/src/knowledge.ts`。合并不 INSERT 合并边；`deleteKnowledgeCard` 仍先执行 `DELETE FROM knowledge_relations WHERE from_card_id = ? OR to_card_id = ?`。
- **Schema：** 未改 `packages/data` 既有迁移，未增表或加列。建议理由不入库。
- **默认路由：** `DEFAULT_ROUTE_ID` 仍为 `"chat"`。只追加了发现 IPC 与关系面板控件，未新增顶级导航。

## 桌面呈现

知识库下的关系面板追加：

- 「发现隐藏关联」按钮（`relations:discover`）
- 每条待确认建议的简短理由（`shared_source` / `text_overlap` / `type_rule`）
- 多选后的批量确认 / 批量驳回（`relations:confirmMany` / `relations:rejectMany`，内部循环调用既有确认 / 驳回 API）

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 隐藏联系可被发现：共用来源、标题/正文重叠、类型规则；每条建议带可测试理由；确认前不得出现在已确认列表 | **通过。** 双次从同一段落起草的卡，以及不同 chunk 但同一 `paragraphId` 的卡，均以 `shared_source` 被发现。固定合成文本在阈值 0.45 之上以 `text_overlap` / `related_to` 被发现，无关文本不会。案例 → 原则以 `type_rule` / `example_of` 被发现。发现结果的 status 均为 `suggested`，`listConfirmedRelations` 在确认前为空。 |
| 2 | D-017：发现函数本身不得写入 `verified_by_user`；测试断言发现结果全是 `suggested` | **通过。** 运行时断言所有发现行都是 `suggested`，且发现前后已确认行数不变。源码检查 `discoverKnowledgeRelations` 不出现 `RELATION_STATUS_VERIFIED` / `verified_by_user`，只通过 `suggestRelation` 写入。 |
| 3 | 幂等与去重：重复发现不产生重复待确认建议；不覆盖已确认；已驳回同一对+类型不得自动再插入为 `suggested`；自环必须拒绝 | **通过。** 第二次发现复用同一 id，行数不变。确认后状态保持 `verified_by_user`，不再出现新的相同三元组建议。驳回后再发现仍为 `rejected`，不进入建议或已确认列表。自环在解释阶段为 `null`，库中无自环行；`suggestRelation` 仍拒绝自环写入。 |
| 4 | 用户确认后成为正式关系，类型属于允许集合；驳回后不得残留为正式关系 | **通过。** 发现后的 `confirmRelation` 将 `example_of` 提升为 `verified_by_user`；`rejectRelation` 将对应建议标为 `rejected`，不再出现在已确认列表。桌面测试覆盖批量确认 / 批量驳回。 |
| 5 | 删除任一端知识卡时，既有删除契约仍成立 | **通过。** 测试只**调用**既有 `deleteKnowledgeCard`，未改其实现。删除一端后，发现产生的建议行与已确认行均被清理。源码检查确认 `knowledge.ts` 仍执行原 DELETE，且没有 `INSERT INTO knowledge_relations`。 |
| 6 | 自动化测试覆盖发现 → 确认、发现 → 驳回、重复发现、已驳回不再自动建议、非法自环；失败时非零退出 | **通过。** `packages/core/test/rel-002.test.ts` 与 `packages/desktop/test/rel-002.test.ts` 覆盖上述路径。既有 REL-001 及其他已在 integration 上的测试继续通过。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/REL-002` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**45 passed，0 failed**（含已在 integration 上的既有用例，以及本票新增 8 项）。时间：2026-11-16 22:22 CST（Asia/Shanghai）。
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**47 passed，0 failed**（含 `tsc --noEmit`、`@bookskill/repo-baseline` 构建，以及本票新增 4 项）。时间：2026-11-16 22:23 CST（Asia/Shanghai）。

## 交付物路径

- `packages/core/src/relations.ts` — 追加 `discoverKnowledgeRelations`、`explainDiscoveryProposal`、`textOverlapScore` 与理由常量
- `packages/core/src/index.ts` — 仅追加导出
- `packages/core/test/rel-002.test.ts` — 验收 1–6 的核心自动化测试
- `packages/desktop/src/renderer/relations/**` — 建议理由、发现按钮、批量确认 / 驳回
- `packages/desktop/test/rel-002.test.ts` — 收件箱呈现、目录 enrichment、默认路由与 IPC 接线测试
- `packages/desktop/src/renderer/main.ts`、`packages/desktop/src/main/main.ts`、`preload.cjs`、`packages/desktop/src/shared/shell-info.ts` — 仅追加发现 / 批量 IPC 与接线
- `docs/rel/REL-002-REPORT.md`
- 既有 `docs/rel/REL-001-REPORT.md` 未删除

未修改：`packages/core/src/knowledge.ts`、`packages/data/**` 既有迁移、导入管道、阅读 UI、SEARCH-001 / SEARCH-002、FIXT 样本、taste-skill 原型、治理文件。未把本票标为 Done，未开始 SKILL-004，未合入 `main`。

## 未解决风险与后续

- **理由不入库。** 为避免改 schema，建议理由在列出时按同一规则重算。若卡片正文或来源在建议生成之后被大幅编辑，收件箱上的理由可能与当初发现时不一致；若规则不再匹配，目录层会显示为空理由，但建议行仍保留，直到用户确认或驳回。
- **同一 `(from, to, type)` 在表上仍无唯一约束。** 去重只在发现 API 层执行。手动多次 `suggestRelation` 仍可能插入重复行（REL-001 已记录的残差）。若后续要加唯一约束，需评估 schema 变更，风险应升高。
- **有向成对建议。** 案例/原则类型规则会分别产生 `example_of` 与 `supports` 两条有向建议。这与 `proposeRelationType` 一致，但收件箱可能同时出现互为反向的两条。
- **正文重叠是词汇 Jaccard，不是语义相似度。** 阈值 0.45 针对测试中的固定合成文本调定；真实书库里措辞差异大的相关卡片可能漏检，高频套话可能误检。
- **实机操作依赖主进程 IPC。** 自动化测试覆盖 core API、目录 enrichment、HTML 渲染和预加载 / 主进程源码接线，没有跑完整 Electron 窗口点击。交互回归需独立 QA 在实机中确认。
- 这不是正式发布，也不是可安装发运包。未进入 Phase E/F。未将 REL-002 标为 Done。须独立 QA 通过后才能合入 `integration`。

## 风险等级说明

**中（medium）。** 只在既有关系 API 与知识库关系面板上追加本机发现、理由展示和批量确认 / 驳回，写入既有 `knowledge_relations` 表，未改迁移、未改 KNOW-001 合并 / 删除实现、未改默认路由。若后续必须为理由持久化或关系去重加新表 / 新列，应由 Orchestrator 记入待决事项并由 DATA 线处理，届时风险应升高。
