# SEARCH-001：全文/语义搜索、结果类型与来源显示

- ID：SEARCH-001
- 阶段：D
- 目标：在已导入书籍、摘录与知识卡上提供可测试的全文搜索；结果标明内容类型（原文 / AI 归纳 / 用户判断）并回链到来源定位。语义检索若无嵌入索引，可用确定性的本机相似度/关键词扩展作为 V1 薄实现，但必须在报告中写明边界，不得假装已接上云端向量服务。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）
- 依赖：KNOW-001（已在 `origin/integration` @ `71f8390`）
- 状态：Ready
- 启动时间：2026-11-14 20:51 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration` 拉 `feat/SEARCH-001`，独立 worktree
- 视觉参考（只读，禁止改）：`/workspace/bookskill-desktop/prototypes/desktop-shell/`
- 风险等级（预估）：中（不改 schema；不接外部托管搜索；不读取生产密钥）
- 测试样本：只使用 FIXT-001 或同等许可/合成样本。

## 允许写入

- 新建 `packages/core/src/search/**`（或等价模块）及对应测试；经 `packages/core/src/index.ts` 追加导出
- 新建 `packages/desktop/src/renderer/search/**` 及对应测试
- `docs/search/**`
- `packages/desktop` 的 main / preload / shell-info / navigation / renderer 入口仅允许**追加**搜索相关 IPC 与入口接线；不得改默认路由离开 `chat`
- 不得修改 `packages/data` 既有迁移。若确需 FTS/向量表，PR 标明高风险并记入 `docs/PENDING_DECISIONS.md`，先停手等确认

## 禁止写入

- `packages/desktop/src/renderer/knowledge/**`、`read/**`、导入管道、FIXT-001 样本、taste-skill 原型树、治理文件
- 不得合入 `main`，不得发布，不得进入 Phase E/F
- 不得把 AnythingLLM 内部库当业务搜索 API，不得再分发官方桌面二进制
- 不得在聊天或仓库中写入真实 API 密钥

## 验收条件（可测试）

1. 对已导入的许可测试书，至少一种全文查询能返回非空结果；每条结果含内容类型标签（原文 / AI 归纳 / 用户判断之一）以及可回跳的来源定位（书 + locator）。
2. 对不存在的查询返回空列表，而不是抛错或伪造成功。
3. 语义路径若未落地嵌入索引：必须有明确的降级行为（例如扩展关键词全文检索）并在报告写明；不得静默调用外部托管向量服务。
4. 搜索不得修改书籍、知识卡状态或批注文件。
5. 自动化测试覆盖上述路径；失败时非零退出。

## 测试命令

```bash
# 在 feat/SEARCH-001 worktree
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test
```

## 交付物路径

- `docs/search/SEARCH-001-REPORT.md`
- 实现与测试（见允许写入）
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决风险

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 KNOW-001 / READ-001 / IMPORT-001 的文件。
