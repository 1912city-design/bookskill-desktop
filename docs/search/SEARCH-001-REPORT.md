# SEARCH-001 交接报告

- 任务：在已导入书籍、摘录与知识卡上提供可测试的全文搜索；结果标明内容类型（原文 / AI 归纳 / 用户判断）并回链到来源定位。语义检索无嵌入索引时，使用确定性的本机关键词扩展与词面重叠作为 V1 薄实现，并在报告中写明边界。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/SEARCH-001`
- 基础：起始于 `origin/integration` @ `71f8390`（KNOW-001 已在该基础上）。开 PR 前已变基到 `origin/integration` @ `1beaf80`（含随后合入的 GOV-001 / BOT-001 / D-026 文档）。
- 工作区：`/workspace/bookskill-worktrees/SEARCH-001`
- 实现提交：`117f25ddee0946af5dc48b6472a00201eb5c8bd2`（变基后的功能提交；若随后仅追加本报告哈希记录，以该功能提交为准）
- 完成时间：2026-11-14 21:02 CST（Asia/Shanghai）
- 状态：本地实现与测试已完成。已推送 `feat/SEARCH-001` 并准备打开目标为 `integration` 的 PR。**未合入 `main` / `integration`，未发布，未标 Done，未进入 Phase E/F。** 这不是正式发布，也不是 G1 / 可安装发运包。
- 风险等级：**中（medium）**。未改 `packages/data` 既有迁移，未新增 FTS / 向量表，未调用外部托管向量或搜索服务，未写入真实 API 密钥。搜索在应用层对现有表与批注文件做只读扫描。

## 做了什么

在 `@bookskill/core` 与 `@bookskill/desktop` 上实现 SEARCH-001 全文搜索，以及无嵌入索引时的本机语义降级。只追加搜索模块、测试、IPC 与壳层接线，不改默认路由，不重写知识库 / 阅读器 / 导入逻辑。

- 新建 `packages/core/src/search/**`：从现有 `source_chunks`、`knowledge_cards`（及其 `knowledge_sources`）和 `annotations` 表只读收集记录；全文检索使用规范化短语匹配与显著词 AND；语义模式使用确定性同义词 / 词干扩展 + 词面重叠（至少两个扩展词命中）与 Jaccard 排序。空查询或无命中返回空列表，不抛错、不伪造成功。
- 经 `packages/core/src/index.ts` 仅追加导出 `searchLibrary` / `searchRecords` / `collectSearchableRecords` 及内容类型常量。未改 `workspace.ts`、`knowledge.ts` 的合并 / 删除契约。
- 新建 `packages/desktop/src/renderer/search/**`：把阅读器文件型摘录（`library/<bookId>/annotations.json`）一并纳入搜索。摘录正文标为「原文」，非空用户批注标为「用户判断」。提供壳层搜索面板（内容类型、书 + locator、跳转到来源），语义模式展示本机降级说明。
- 在 Electron 主进程 / preload / `BookskillDesktopBridge` 上追加 `search:query` / `searchLibrary`。渲染入口追加搜索条，点击结果可跳到书中定位或知识卡。`DEFAULT_ROUTE_ID` 仍为 `"chat"`；未新增顶级导航入口，未改 `NAV_ITEMS` / `ROUTE_IDS`。
- 测试只使用 FIXT-001 许可样本（`fixtures/bookskill-test-primer.epub`）。搜索前后对比书籍 / 切片 / 知识卡状态 / 批注行与批注文件的哈希或快照，证明搜索只读。

未修改：`packages/desktop/src/renderer/knowledge/**`、`read/**`、导入管道、FIXT-001 样本、taste-skill 原型树、治理文件、`packages/data` 迁移、`packages/core/src/knowledge.ts` 的合并 / 删除契约、REL-001 文件。未把 AnythingLLM 内部库当业务搜索 API。

## 内容类型映射

| 来源 | 标签 |
|---|---|
| `source_chunks.text` | 原文 |
| 文件型摘录的选区正文（`excerpt.text`） | 原文 |
| 业务库 `annotations` 表中 `type` 为 `excerpt` / `highlight` / `passage` 的 `body` | 原文 |
| 知识卡 `status = draft`（按 D-017，AI / 系统生成的草稿） | AI 归纳 |
| 知识卡 `status = verified_by_user` | 用户判断 |
| 文件型摘录的非空 `note`，以及 `annotations` 表中其他类型（如 `note`）的 `body` | 用户判断 |

知识卡若没有可关联的书与来源切片，则不进入结果，以保证每条命中都有可回跳的「书 + locator」。locator 优先使用已确认的段落定位符（如 `P1.3`）；未确认来源只显示「来源定位未确认」。

## 语义路径边界（V1 薄实现）

**当前没有嵌入索引，也没有新增 FTS / 向量表。** `mode: "semantic"` 不会、也没有能力调用托管向量服务。它固定声明：

- `fallback: "local_keyword_expansion"`
- `backend: "local_deterministic"`

行为：对查询做轻量词干与确定性同义组扩展（中英），再按扩展词与记录词的重叠数（至少 2 个）和 Jaccard 排序。这不是语义嵌入，不能替代向量检索；对改写较大或同义词表未覆盖的查询可能漏检。全文模式（默认）不做扩展，要求短语命中或全部显著词命中。

源码与测试禁止 `fetch`、`node:http(s)` 以及 openai / pinecone / weaviate 等托管向量客户端。未读取、未写入真实 API 密钥。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 对已导入的许可测试书，至少一种全文查询返回非空结果；每条含内容类型（原文 / AI 归纳 / 用户判断）以及可回跳的来源定位（书 + locator） | **通过。** 对 FIXT-001 EPUB 查询 `paragraph identifier`，命中原文切片 `P1.3`、草稿知识卡（AI 归纳）以及用户批注（用户判断）；每条都有 `bookId` / `bookTitle` 与 locator。桌面测试同时覆盖文件型摘录与批注，HTML 渲染含三类标签与「BookSkill Test Primer · P1.3」。 |
| 2 | 对不存在的查询返回空列表，而不是抛错或伪造成功 | **通过。** `xyzzyplughqqq999` 与空白查询均返回 `results: []`。桌面空态渲染 `search-empty`，不渲染假结果列表。 |
| 3 | 语义路径若未落地嵌入索引：必须有明确的降级行为并在报告写明；不得静默调用外部托管向量服务 | **通过。** 语义查询返回 `fallback: "local_keyword_expansion"`、`backend: "local_deterministic"`。改写查询「citation requirement for claims on a knowledge card」仍能命中 `P1.3`。UI 展示本机降级说明。源码扫描确认无托管向量客户端。 |
| 4 | 搜索不得修改书籍、知识卡状态或批注文件 | **通过。** 多次全文 / 语义 / 空结果查询后，书籍 `content_hash`、知识卡 `draft` / `verified_by_user` 状态、`annotations` 行与 `annotations.json` 文件哈希均与查询前一致。 |
| 5 | 自动化测试覆盖上述路径；失败时非零退出 | **通过。** `packages/core/test/search-001.test.ts` 与 `packages/desktop/test/search-001.test.ts` 使用 `node:test` + `assert`。`pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test` 退出码均为 0；既有测试继续通过。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/SEARCH-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**29 passed，0 failed**（既有 24 项 + 本任务新增 5 项）。时间：2026-11-14 21:02 CST（Asia/Shanghai）。完整输出：`docs/search/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**34 passed，0 failed**（既有 28 项 + 本任务新增 6 项，含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建）。时间：2026-11-14 21:02 CST（Asia/Shanghai）。完整输出：`docs/search/pnpm-desktop-test-output.txt`

## 关键 API

- `searchLibrary({ db, query, mode?, limit?, extraRecords? })` → `SearchResult`
- `searchRecords(records, query)`：对已收集记录打分排序
- `collectSearchableRecords(db)`：只读收集业务库记录
- 桌面：`searchDesktopLibrary({ db, dataDir, query, mode?, limit? })`；IPC `search:query`；桥接方法 `BookskillDesktopBridge.searchLibrary`

`SearchHit` 含 `contentType`、`source.bookId` / `bookTitle` / `locator` / `paragraphId` / `chunkId`。

## 交付物路径

- `packages/core/src/search/**` — 核心搜索实现
- `packages/core/src/index.ts` — 仅追加导出
- `packages/core/test/search-001.test.ts`
- `packages/desktop/src/renderer/search/**` — 桌面收集、执行与搜索面板
- `packages/desktop/test/search-001.test.ts`
- `packages/desktop/src/main/main.ts`、`preload.cjs` — 仅追加搜索 IPC
- `packages/desktop/src/shared/shell-info.ts` — 仅追加桥接方法
- `packages/desktop/src/renderer/main.ts` — 仅追加搜索条与跳转接线
- `docs/search/SEARCH-001-REPORT.md`
- `docs/search/pnpm-core-test-output.txt`
- `docs/search/pnpm-desktop-test-output.txt`

## 未解决风险

- **没有嵌入索引，语义检索是词面扩展而不是向量相似度。** 同义词表未覆盖的改写可能漏检；这是刻意的 V1 边界，不是静默降级到云端。若后续需要真正的语义检索，应由 Orchestrator 记入待决事项，并由人决定是否新增 FTS / 向量表（本任务按工单要求停手，未加表）。
- **文件型摘录与业务库 `annotations` 表并存。** 阅读器当前把摘录写到数据目录里的 JSON，核心搜索同时扫描尚未被产品写入的 `annotations` 表，以免漏掉将来的表内批注。两套存储尚未统一。
- **实机跳转依赖主进程 IPC。** 自动化测试覆盖 API、只读快照与 HTML 渲染，没有跑完整 Electron 窗口点击。预加载与主进程已接线，交互回归需独立 QA 在实机中确认。
- **搜索条出现在所有一级入口上方**，但默认路由仍是「问题对话」，也没有新增顶级导航。若产品希望搜索只出现在书库 / 知识库，可在后续任务收窄，而不必改路由契约。
- 开 PR 时 `origin/integration` 可能已比本工作树的起始点 `71f8390` 多了 GOV-001 / BOT-001 / D-026 文档提交。这些变更与本任务文件无直接重叠，但合入前仍需独立 QA 看一眼是否冲突。
- 这不是正式发布，不是 G1，也不是可安装发运包。未进入 Phase E/F。未将工单标为 Done。

## 风险等级说明

**中（medium）。** 只追加只读搜索 API、壳层搜索条和 IPC，未改 schema、导入、知识卡合并 / 删除或默认路由。主要风险是把本机关键词扩展误认为真正的语义检索；报告、API 字段与 UI 均已标明该边界。
