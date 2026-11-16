# SEARCH-002：强化搜索（模糊匹配、响应、结果呈现）

- ID：SEARCH-002
- 阶段：D 增强（基于已合入的 SEARCH-001，不另起搜索系统）
- 目标：在现有 `packages/core/src/search/**` 与 `packages/desktop/src/renderer/search/**` 上增强实用性：对拼写误差、词序不全和中文部分匹配仍能命中；查询在本机书库上更快；结果按类型分组、高亮摘要，并可键盘/点击跳到来源（参考 Omnisearch 的呈现与节奏，但必须复用现有搜索 API 与面板，不得引入第二套索引产品或外部托管搜索）。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）
- 依赖：SEARCH-001 已在 `origin/integration` @ `5ec4540`
- 状态：Ready / In Progress
- 启动时间：2026-11-16 22:10 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration`（`5ec4540`）拉 `feat/SEARCH-002`，独立 worktree `/workspace/bookskill-worktrees/SEARCH-002`
- 视觉参考（只读，禁止改）：`/workspace/bookskill-desktop/prototypes/desktop-shell/`
- 风险等级（预估）：中（不改 `packages/data` 迁移；不用 FTS 新表；不接外部向量/搜索服务；不读取生产密钥）
- 测试样本：只使用 FIXT-001 或同等许可/合成样本。

## 背景（当前实现的缺口）

现行全文路径要求查询中的每个有效词都命中，几乎没有编辑距离或前缀容错；每次查询都会全量扫描已收集记录，没有可重建的内存倒排索引；结果列表没有按类型分组，摘要也没有高亮。这些是本票要修的实用性缺口，不是新系统。

## 允许写入

- `packages/core/src/search/**` 及对应测试；经 `packages/core/src/index.ts` **追加**导出
- `packages/desktop/src/renderer/search/**` 及对应测试
- `docs/search/**`（本票报告；不得删除 SEARCH-001 报告）
- `packages/desktop` 的 main / preload / shell-info / navigation / renderer 入口仅允许**追加**搜索相关 IPC 与呈现接线；不得改默认路由离开 `chat`
- 允许在进程内建立可重建的倒排/前缀索引，或把可丢弃的缓存写到数据目录（D-012：索引与缓存可重建）。重启后必须能从业务库重建，不得把缓存当 source of truth

## 禁止写入

- `packages/data` 既有迁移与新的 FTS/向量表（若确需 FTS 表，标高风险并停手，记入 `docs/PENDING_DECISIONS.md`，不得自行合入）
- `packages/desktop/src/renderer/knowledge/**`、`relations/**`、`read/**`、导入管道、FIXT-001 样本、taste-skill 原型树、治理文件
- 不得合入 `main`，不得发布，不得推进网盘分发
- 不得把 AnythingLLM 内部库当业务搜索 API，不得静默调用外部托管向量/搜索服务
- 不得在聊天或仓库中写入真实 API 密钥

## 验收条件（可测试）

1. **模糊匹配**：对已导入的 FIXT-001 测试书，至少覆盖下列情况并返回非空、可跳转的相关结果：
   - 英文单词 1 处编辑距离误差（例如把 primer 中的词拼错一个字母）；
   - 英文或中文前缀 / 部分查询（只输入词的前半或中文连续子串）；
   - 词序部分缺失（查询只含原文中的部分有效词，不再要求 AND 全中才有结果，但全词短语仍应排在更前）。
   不存在的查询仍返回空列表，不得抛错或伪造成功。
2. **响应**：在只含 FIXT-001 样本（及测试里同等规模的合成记录，至少 200 条）时，同一进程内第 2 次及之后的典型查询（已预热索引）必须在自动化测试中于 50ms 内返回；首次查询允许包含建索引时间，但须在报告中写明。不得为赶时限丢掉来源定位或内容类型标签。
3. **结果呈现**：每条结果仍含内容类型（原文 / AI 归纳 / 用户判断）和可回跳来源（书 + locator）。结果按类型分组展示；摘要高亮匹配片段；支持从结果跳转到阅读器或知识卡。键盘选择（上/下/回车）至少有自动化或 UI 测试覆盖。
4. **只读**：搜索不得修改书籍、知识卡状态、关系或批注文件。
5. **边界**：现行 SEARCH-001 的空查询、不存在查询、语义路径本机降级声明仍然成立；不得假装已接上云端向量服务。
6. 自动化测试覆盖上述路径；失败时非零退出。独立 QA 通过后才能合入 `integration`。不得宣布完成，除非独立 QA 验证通过。

## 测试命令

```bash
# 在 feat/SEARCH-002 worktree
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

## 交付物路径

- `docs/search/SEARCH-002-REPORT.md`
- 实现与测试（见允许写入）
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决风险

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 REL / KNOW / IMPORT / READ 的文件。
