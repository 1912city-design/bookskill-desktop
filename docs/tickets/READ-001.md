# READ-001：章节、摘录、批注、来源定位

- ID：READ-001
- 阶段：D
- 目标：在已导入材料上提供章节浏览、摘录、批注和来源定位（对应 AT-02 的阅读侧）。
- 负责人 Agent：frontend_engineer（BookSkill Frontend Engineer）
- 依赖：VERT-001。从已含 IMPORT-001 的 `origin/feat/VERT-001`（`f109cd2`）拉出独立分支。
- 状态：Landed on `feat/VERT-001`（[PR #5](https://github.com/1912city-design/bookskill-desktop/pull/5)，merge `a83e0a0`，2026-11-14 01:39 Asia/Shanghai）。未进 `integration` / `main`，不得标 Done。
- 启动时间：2026-11-14 00:52 Asia/Shanghai（工作树）
- 实现启动时间：2026-11-14 01:25 Asia/Shanghai
- 合入时间：2026-11-14 01:39 Asia/Shanghai（独立 QA PASS 后仅合入 `feat/VERT-001`）
- 分支 / 工作树：`feat/READ-001`，`/workspace/bookskill-worktrees/READ-001`
- 视觉参考（只读，禁止改）：`/workspace/bookskill-desktop/prototypes/desktop-shell/`，证据 `/workspace/bookskill-desktop/prototypes/desktop-shell/EVIDENCE.md`
- 风险等级（预估）：低/中
- 测试样本：只使用 FIXT-001 或同等许可/合成样本。

## 允许写入

- 新建 `packages/desktop/src/renderer/read/**` 及对应测试
- `docs/read/**`
- `packages/desktop/src/renderer/main.ts`、`index.html`、`styles.css` 仅允许追加阅读入口接线，禁止重写主导航或其他页面
- 如需只读调用导入结果，通过 `@bookskill/core` 已有 API；不得改导入实现

## 禁止写入

- `packages/core/src/import-book.ts`、`parse-epub.ts`、`parse-pdf.ts`、`chunks.ts`、`zip.ts`、`packages/core/src/import/**`
- `packages/core/src/knowledge.ts` 与 `packages/desktop/src/renderer/knowledge/**`（归 KNOW-001）
- `packages/data/**`、FIXT-001 样本正文、治理文件
- `/workspace/bookskill-ui-taste/**`（taste-skill 原型树，现有 UI 任务）
- 不得合入 `main`，不得发布，不得进入 Phase E/F

## 验收条件（可测试）

1. 已导入的许可 EPUB 与文本 PDF 能展示章节或页码/段落定位。
2. 用户可从选区生成摘录，并能从摘录跳回原书位置。
3. 无法精确定位的来源显示未确认状态，不得伪称为已精确定位。
4. 批注在退出并重新打开应用后仍在（使用 BookSkill 数据目录）。
5. 自动化测试覆盖上述路径；失败时非零退出。

## 测试命令

```bash
# 在 /workspace/bookskill-worktrees/READ-001
pnpm --filter @bookskill/desktop test
pnpm --filter @bookskill/core test
```

## 交付物路径

- `docs/read/READ-001-REPORT.md`
- 实现与测试（见允许写入）
- 远端 PR 四件套：摘要、验收逐条结果、测试命令及结果、未解决风险

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 IMPORT-001 / KNOW-001 的文件。
