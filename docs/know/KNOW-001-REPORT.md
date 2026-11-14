# KNOW-001 交接报告

- 任务：知识卡以 `draft` 创建，用户确认后才变为 `verified_by_user`；支持编辑、合并、删除；删除卡片不得删除原书（对应 AT-03），并把知识库接到现有 Electron 壳的「知识库」入口
- 负责人：frontend_engineer（BookSkill Frontend Engineer）
- 分支：`feat/KNOW-001`
- 基础：`feat/VERT-001` / `origin/feat/VERT-001` @ `a83e0a0`（含已合入的 IMPORT-001 与 READ-001）
- 工作区：`/workspace/bookskill-worktrees/KNOW-001`
- 完成时间：2026-11-14 01:46 Asia/Shanghai
- 实现提交：`222a018f23bf0f4b1f330aa855ab177656190442`
- 状态：本地实现与测试已完成。**本执行器未打开远端 PR，未合入 `main` / `integration`，未发布，未标 Done。** PR 草案见 `docs/know/pull-request.md`，目标只能是 `feat/VERT-001`。由 Orchestrator 安排独立 QA。
- 风险等级：**低/中（low/medium）**。未改 schema 迁移，未新增表；合并时把来源迁到保留卡并去重，再删除被吸收卡，不写入会在删除后悬空的 `knowledge_relations` 合并关系。不是正式 G1，也不是发运包。未进入 Phase E/F。

## 做了什么

在 `@bookskill/core` 与 `@bookskill/desktop` 上实现 KNOW-001 知识卡草稿 / 确认 / 编辑 / 合并 / 删除，只追加知识库入口接线，不重写主导航、默认路由或其他页面，也未改 `packages/desktop/src/renderer/read/**`。

- 在 `packages/core/src/knowledge.ts` 追加 `updateKnowledgeCard`（只改标题 / 正文 / 条件 / 局限，不改状态）、`listKnowledgeCards`、`mergeKnowledgeCards`。`confirmKnowledgeCard` 签名保持兼容，现有 `workspace.confirmKnowledgeCard` 与 `knowledge.test.ts` / `slice.test.ts` 继续通过。
- 合并策略：把被吸收卡的来源按 `source_chunk_id` 去重后迁到保留卡，再删除被吸收卡；原书与 `source_chunks` 仍在。因为 `knowledge_relations` 对 `knowledge_cards` 有外键，且 `deleteKnowledgeCard` 会删掉涉及该卡的关系，合并**不**写入指向被吸收卡的关系，避免悬空外键。合并不会把草稿自动变为 `verified_by_user`。
- 新增 `packages/desktop/src/renderer/knowledge/**`：知识卡列表、状态与来源定位、从段落生成草稿、编辑、显式「确认」、合并两张卡、删除，以及删除 / 合并后原书与定位仍在的核验展示。没有自动确认或自动发布 Skill 的控件，也没有不经 `confirmKnowledgeCard` 就把卡片升为正式卡的辅助函数。
- 通过追加 IPC（`knowledge:listCards` / `listBooks` / `draftCard` / `updateCard` / `confirmCard` / `mergeCards` / `deleteCard`）把知识库接到现有 Electron 壳；预加载桥接同步追加。渲染进程保持 `contextIsolation: true`、`nodeIntegration: false`。
- 知识库表面使用已锁定的工作台风貌：近黑底 `#000000` / `#0d0d0d`、文字 `#ffffff`、次要 `#999999`、强调 `#93f1f7`，字体栈 Instrument Sans + DM Mono，圆角 soft。样式限定在 `knowledge` 路由与 `.knowledge-surface`，未把聊天、书库 / 阅读器、Skills、设置改成营销落地页。
- 仅轻改「知识库」导航描述（不再写「完整知识库仍待后续任务」）。未改 `ROUTE_IDS`、未新增顶级导航、未改默认路由（问题对话）及其他入口文案，包括 READ-001 的书库描述。
- 测试只使用 FIXT-001 许可样本（`fixtures/bookskill-test-primer.epub`），在临时 BookSkill 数据目录中导入。知识流程调用既有 `createRetrospectiveSkill` 时断言 Skill 状态不是 `published`（D-018）。草稿 / 编辑 / 合并路径都不会把状态写成 `verified_by_user`，只有显式的 `confirmKnowledgeCard` 会（D-017）。

未修改：导入管道（`import-book.ts`、解析器、`packages/core/src/import/**`）、`packages/desktop/src/renderer/read/**`、`packages/data/**` 既有迁移、`workspace.ts` / `skills.ts` / `conversation.ts` / `constants.ts` / `types.ts`、FIXT-001 样本正文、治理文件、`/workspace/bookskill-ui-taste/**`、原型树 `/workspace/bookskill-desktop/prototypes/desktop-shell/**`。未把 READ-001 或 KNOW-001 标为 Done，未进入 Phase E/F。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 从来源生成的知识卡初始状态为 `draft` | **通过。** 从 FIXT-001 EPUB 的 `P1.3` 生成知识卡，状态为 `draft`，并带来源切片与段落定位。 |
| 2 | 用户编辑并确认后，状态变为 `verified_by_user`，且来源关系保持不变 | **通过。** `updateKnowledgeCard` 可改标题 / 正文且保持 `draft`；随后 `confirmKnowledgeCard` 将状态变为 `verified_by_user`，`sourceChunkId` / `paragraphId` / `relationType` 与确认前一致，没有丢弃或替换来源。 |
| 3 | 支持合并与删除；删除卡片后原书仍在，书中定位仍可用；合并不得删除原书或定位，也不得把草稿默认为已确认 | **通过。** 合并会把不同定位的来源并到保留卡并按 `source_chunk_id` 去重，被吸收卡删除；保留卡若是草稿则仍为 `draft`。删除卡片后 `loadBook` 仍能找到原书与对应段落 / 切片。`knowledge_relations` 中不留下会悬空的合并关系。 |
| 4 | AI 不能自行把草稿确认为正式卡；知识流程不得自动发布 Skill | **通过。** 编辑不确认、合并都不会把状态写成 `verified_by_user`。源码检查确认只有 `confirmKnowledgeCard` 会赋 `KNOWLEDGE_CARD_STATUS_VERIFIED`。调用既有 `createRetrospectiveSkill` 后 Skill 状态不是 `published`。UI 没有自动确认或自动发布控件。 |
| 5 | 自动化测试覆盖上述路径；失败时非零退出 | **通过。** `packages/core/test/know-001.test.ts` 与 `packages/desktop/test/know-001.test.ts` 使用 `node:test` + `assert`（失败断言会以非零退出）。`pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test` 退出码均为 0。既有 `knowledge.test.ts`、`slice.test.ts`、导入测试与 `read-001.test.ts` 继续通过。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/KNOW-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**24 passed，0 failed**（既有 15 项 + 本任务新增 9 项）。时间：2026-11-14 01:46:12 CST（Asia/Shanghai）。完整输出：`docs/know/pnpm-core-test-output.txt`
- `pnpm --filter @bookskill/desktop test`：退出码 **0**；**28 passed，0 failed**（既有 22 项 + 本任务新增 6 项，含 `tsc --noEmit` 与 `@bookskill/repo-baseline` 构建）。时间：2026-11-14 01:46:14 CST（Asia/Shanghai）。完整输出：`docs/know/pnpm-desktop-test-output.txt`

## 交付物路径

- `packages/core/src/knowledge.ts` — 追加编辑、列表、合并 API（确认 / 删除契约保持不变）
- `packages/core/src/index.ts` — 仅追加导出
- `packages/core/test/know-001.test.ts` — 验收 1–5 的核心自动化测试
- `packages/desktop/src/renderer/knowledge/**` — 知识库类型、列表 enrichment、删除后定位核验、HTML 视图
- `packages/desktop/test/know-001.test.ts` — 知识库路由与验收路径的桌面测试
- `packages/desktop/src/renderer/main.ts`、`styles.css` — 仅追加知识库接线与限定样式
- `packages/desktop/src/main/main.ts`、`preload.cjs` — 仅追加知识库 IPC
- `packages/desktop/src/shared/navigation.ts` — 仅更新知识库描述
- `packages/desktop/src/shared/shell-info.ts` — 追加桥接类型
- `docs/know/KNOW-001-REPORT.md`
- `docs/know/pull-request.md`
- `docs/know/pnpm-core-test-output.txt`
- `docs/know/pnpm-desktop-test-output.txt`

## 未解决风险

- **合并不记录 `knowledge_relations` 行。** 该表对卡片有外键，删除被吸收卡后任何指向它的关系都会悬空或被一并删掉，因此未写入合并关系。合并历史只能从保留卡上来源集合看出，不能按关系表回放「谁被谁吸收」。若后续需要可审计的合并记录，应由 Orchestrator 记入待决事项，并评估是否要新表或改变删除契约（本任务未改 `packages/data/**`）。
- **被吸收卡上的 Skill 来源链接会随删除一并去掉**（与既有 `deleteKnowledgeCard` 契约一致），不会自动改挂到保留卡。若某张 Skill 只引用了被吸收卡，合并后可能失去该知识卡来源。
- **实机操作依赖主进程 IPC。** 自动化测试覆盖 core API、删除后原书核验和 HTML 渲染，没有跑完整 Electron 窗口点击。预加载与主进程已接线，但交互回归需独立 QA 在实机中确认。
- **字体未内置。** 知识库声明 Instrument Sans 与 DM Mono，但 `index.html` 的 CSP 不允许拉取外部字体；未安装时会回退到系统字体，调色板与结构仍在。
- 本分支含 VERT-001 / IMPORT-001 / READ-001 历史，因为工单要求从 `origin/feat/VERT-001` @ `a83e0a0` 起做。向 `integration` 晋升须等 P-002，本任务不合并，也不以 `integration` 或 `main` 为 PR 目标。
- 这不是 G1，也不是可安装发运包。未进入 Phase E/F。

## 风险等级说明

**低/中（low/medium）。** 只追加知识卡 API、知识库 UI、限定样式和 IPC，未改导入实现、阅读器或数据 schema，也未新增表。若后续必须为合并历史加新表或改迁移，应由 Orchestrator 记入待决事项并由 DATA 线处理，届时风险应升为中/高。
