# SEARCH-002 交接报告

- 任务：在已合入的 SEARCH-001 上增强模糊匹配、本机查询响应与结果呈现（分组、高亮、键盘选择）。不另起一套搜索系统，不新增 FTS / 向量表，不接外部托管搜索。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/SEARCH-002`
- 基础：`origin/integration` @ `5ec45405b2487c1f5e2fa9f35acd0d9ba882f92a`（含已合入的 SEARCH-001 / REL-001 / PATH-001）。开 PR 前 integration 未前移，无需再变基。
- 工作区：`/workspace/bookskill-worktrees/SEARCH-002`
- 实现提交：`5d1aa1c7dc75c6c1885fdb2aceb720fb25a38eae`
- 完成时间：2026-11-16 22:18 CST（Asia/Shanghai）
- 状态：本地实现与测试已完成。已推送 `feat/SEARCH-002` 并打开目标为 `integration` 的 PR。**未合入 `main` / `integration`，未发布，未标 Done，未进入 Phase E/F。** 这不是正式发布，也不是 G1 / 可安装发运包。本票须经独立 QA 通过后才能合入。
- 风险等级：**中（medium）**。未改 `packages/data` 既有迁移，未新增 FTS / 向量表，未调用外部托管向量或搜索服务，未写入真实 API 密钥。索引为进程内可丢弃缓存，业务库仍是 source of truth（D-012）。

## 做了什么

在现有 `@bookskill/core` / `@bookskill/desktop` 搜索模块上增强 SEARCH-001，而不是引入第二套索引或面板。

- `packages/core/src/search/**`：新增可重建的内存倒排 / 前缀索引（`memory-index.ts`）。全文路径不再要求 AND 全中：英文 1 处编辑距离、词前缀、中文连续子串、部分词均可命中；完整短语与全部显著词命中仍排序更前。不存在的查询与空查询仍返回空列表。`searchLibrary` 按业务库廉价指纹缓存索引；`searchRecords` 按记录数组身份缓存。重启或指纹变化后从业务库重建，缓存不是 source of truth。
- 经 `packages/core/src/index.ts` **追加**导出 `buildSearchIndex` / `getOrBuildSearchIndex` / `searchIndexedRecords` / `libraryIndexFingerprint` 及 `SearchMemoryIndex`。未改知识卡合并 / 删除或关系契约。
- `packages/desktop/src/renderer/search/**`：结果按内容类型分组（原文 → AI 归纳 → 用户判断），摘要用 `<mark>` 高亮匹配片段；新增可测的键盘选择（上 / 下移动，回车在键盘激活后跳转到来源）。
- 渲染入口仅**追加**搜索面板的键盘接线；`searchDesktopLibrary` 改走 `searchLibrary` 以复用进程内索引。`DEFAULT_ROUTE_ID` 仍为 `"chat"`；未改 `NAV_ITEMS` / 默认路由，未新增顶级导航入口。
- 测试只使用 FIXT-001 许可样本（`fixtures/bookskill-test-primer.epub`）及同等规模的合成记录 / 批注。搜索前后对比业务库快照与批注文件哈希，证明搜索只读。

未修改：`packages/data` 迁移、`packages/desktop/src/renderer/knowledge/**`、`relations/**`、`read/**`、导入管道、FIXT-001 样本、taste-skill 原型树、治理文件。未启动 REL-002 / SKILL-004。未把 AnythingLLM 内部库当业务搜索 API。保留 `docs/search/SEARCH-001-REPORT.md`。

## 模糊匹配与排序

全文查询对每个显著词在索引中查找三类命中，并取该记录上最好的一种：

1. **精确**：词面或轻量词干与倒排项相同。
2. **前缀**：查询词长度 ≥ 2，且是某索引词的严格前缀（例如 `identif` → `identifier`；中文 `段落定` 可命中完整词 `段落定位符`，二字子串也会打到已有 bigram）。
3. **1 处编辑距离**：查询词长度 ≥ 4，允许一次插入、删除、替换或相邻换位（例如把 primer 中的 `identifier` 拼成 `identifer`）。

不再要求查询中的每个显著词都命中。只要至少一词命中，记录即可进入结果。排序规则保证更完整的匹配排在前面：

- 标题或正文出现**完整查询短语**得最高分（标题更高）。
- **全部显著词都精确命中**有额外加分。
- 精确 > 前缀 > 1 编辑距离；覆盖率（命中词数 / 查询词数）再加权。
- 因此 `paragraph identifier` 会把含该短语的 `P1.3` 排在只含部分词的记录之前；`lantern identifier` 仍能分别命中只含其中一词的段落。

无显著词的查询（例如纯停用词）仍只靠短语命中；完全无匹配或空白查询返回 `results: []`，不抛错、不伪造成功。

## 可重建内存索引与耗时

`buildSearchIndex(records)` 为标题与正文的显著词建立倒排表，并按前两个字符分桶以加速前缀查找。这是进程内、可丢弃的缓存（D-012）：

- `searchRecords` 用 `WeakMap` 按记录数组身份缓存；同一数组的第二次查询不再建索引。
- `searchLibrary` / `searchDesktopLibrary` 用业务库句柄 + 廉价指纹（书籍 / 切片 / 知识卡 / 批注的计数与时间戳，外加 extraRecords 规模）缓存。指纹变化则从业务库只读重建。
- 缓存从不是 source of truth；重启后必须从业务库重建。

本机测试（Node v24.22.1，Linux x86_64，2026-11-16 22:17–22:18 CST / Asia/Shanghai）：

| 场景 | 记录数 | 首次查询（含建索引） | 已预热的典型查询（第 2 次及之后） |
|---|---|---|---|
| core `searchRecords`（FIXT-001 收集记录 + 合成记录） | 200 | **4.09 ms** | 0.26 / 0.25 / 0.11 / 0.12 ms（`paragraph identifier`、`lantern index`、`identifer`、`段落定位符`） |
| desktop `searchDesktopLibrary`（FIXT-001 + 200 条库内合成批注） | ≥ 200 | **4.42 ms** | 0.71 / 1.62 / 0.87 ms（`paragraph identifier`、`lantern index`、`identifer`） |

所有已预热查询都远低于 50ms 验收线。命中仍带内容类型与可跳转来源（书 + locator），未为赶时限丢弃定位或标签。

## 结果呈现

- 每条结果仍有内容类型（原文 / AI 归纳 / 用户判断）和可回跳来源（`bookId` / `bookTitle` / `locator` / `chunkId`）。内容类型映射与 SEARCH-001 相同。
- 面板按类型分组展示，组内保持分数序；组顺序为 原文 → AI 归纳 → 用户判断。
- 摘要按 `matchedFragments`（实际命中的原文片段，而不是用户的错拼）高亮，HTML 已转义。
- 点击「跳转到来源」仍跳到阅读器定位或知识卡。键盘：↑ / ↓ 在分组后的可见列表中移动选择（`data-selected` / `.is-selected`）；仅在方向键激活选择后，Enter 才触发跳转，以免打断输入框提交搜索。自动化测试覆盖 `applySearchKeyboard` 与选中态渲染。

## 边界确认

- `DEFAULT_ROUTE_ID` 仍为 `"chat"`；未新增顶级导航入口。
- 搜索只读：多次模糊 / 前缀 / 中文 / 语义 / 空查询后，书籍 `content_hash`、知识卡状态、批注行与 `annotations.json` 均不变。
- 未新增 FTS / 向量表，未改 `packages/data` 迁移。
- 语义路径仍是 V1 本机降级，声明不变：
  - `fallback: "local_keyword_expansion"`
  - `backend: "local_deterministic"`
  没有嵌入索引，也不会静默调用外部托管向量服务。源码扫描禁止 `fetch`、`node:http(s)`、FTS 建表以及 openai / pinecone / weaviate 等客户端。未读取、未写入真实 API 密钥。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 英文 1 处编辑距离、英文或中文前缀 / 部分查询、部分词仍能命中且可跳转；全词短语排序更前；不存在的查询返回空列表 | **通过。** `identifer` 命中 FIXT-001 的 `P1.3`；`identif` 与中文 `段落定位` 命中相应原文 / 批注；`lantern identifier` 同时命中只含部分词的段落；`paragraph identifier` 仍把 `P1.3` 排在更前；`xyzzyplughqqq999` 与空白查询返回 `[]`。 |
| 2 | 至少 200 条记录时，同一进程内第 2 次及之后的典型查询 ≤ 50ms；首次可含建索引时间并在报告写明；不得丢掉来源或类型标签 | **通过。** 见上表。已预热查询均 < 2ms。每条命中仍断言内容类型与 book + locator。 |
| 3 | 结果按类型分组，摘要高亮，可跳转，键盘选择可测 | **通过。** 桌面渲染含 `search-group` 分组标题、`<mark>` 高亮与 `search-jump`。`applySearchKeyboard` 覆盖 ArrowUp / ArrowDown / Enter 跳转，以及未激活键盘时 Enter 不拦截表单提交。 |
| 4 | 搜索不得修改书籍、知识卡状态、关系或批注文件 | **通过。** 查询前后业务库快照与批注文件哈希一致；草稿卡仍为 `draft`。 |
| 5 | SEARCH-001 空查询、不存在查询、语义本机降级声明仍然成立 | **通过。** 既有 SEARCH-001 测试全部继续通过；语义查询仍返回 `local_keyword_expansion` / `local_deterministic`，UI 保留本机降级说明。 |
| 6 | 自动化测试失败时非零退出 | **通过。** `node:test` + `assert`；失败非零退出。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/SEARCH-002` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**43 passed，0 failed**（既有 37 项，含 SEARCH-001 与 REL 等已合入用例，加上本票新增 6 项）。时间：2026-11-16 22:17:58 CST（Asia/Shanghai）。完整输出：`docs/search/pnpm-core-test-output-search-002.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**47 passed，0 failed**（既有 43 项 + 本票新增 4 项，含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建）。时间：2026-11-16 22:18:04 CST（Asia/Shanghai）。完整输出：`docs/search/pnpm-desktop-test-output-search-002.txt`

既有 SEARCH-001 测试继续通过。样本仅为 FIXT-001 许可夹具及测试内合成记录。

## 关键 API

- `searchLibrary` / `searchRecords`：行为兼容 SEARCH-001，全文路径改为模糊 / 部分词检索并走内存索引。
- `buildSearchIndex` / `getOrBuildSearchIndex` / `searchIndexedRecords`：显式构建或查询进程内索引。
- `SearchHit.matchedFragments`：用于摘要高亮的实际命中片段。
- 桌面：`searchDesktopLibrary`；`groupSearchHits` / `highlightSnippet` / `applySearchKeyboard`；IPC 仍为 `search:query`。

## 交付物路径

- 实现与测试：`packages/core/src/search/**`、`packages/core/test/search-002.test.ts`、`packages/desktop/src/renderer/search/**`、`packages/desktop/test/search-002.test.ts`；`packages/core/src/index.ts` 与桌面 `main.ts` 仅追加导出 / 键盘接线。
- 本报告：`docs/search/SEARCH-002-REPORT.md`
- 既有报告保留：`docs/search/SEARCH-001-REPORT.md`

## 残留风险与后续

- 语义路径仍**不是**嵌入检索。同义词表未覆盖或改写较大的查询可能漏检。若将来需要 FTS / 向量表，必须按工单停手并写入 `docs/PENDING_DECISIONS.md`，不得自行改 schema。本票未新增此类表。
- 进程内索引用廉价指纹判断过期（计数 / `updated_at` / 切片文本总长）。同一计数下原地改写切片文本且总长度不变时，可能短暂用到旧索引；重启或任意增删都会重建。缓存不是 source of truth。
- 短前缀（2 个字符）可能带来较多候选，靠排序抑制；极端短查询的噪音需在实际书库上观察。
- 键盘与跳转有单元 / 渲染测试，但不是完整 Electron 点击穿越。独立 QA 应在运行中的壳层确认分组、高亮、方向键选择与跳转到阅读器 / 知识卡。
- 搜索条仍显示在每个一级路由上方；默认路由仍是问题对话 / `chat`。

请运行独立 QA。不要仅凭本 PR 将工单标为 Done。不要合入 `main`。
