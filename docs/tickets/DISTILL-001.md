# DISTILL-001：5 段蒸馏流水线（解析、校验、草稿 Skill）

- ID：DISTILL-001
- 阶段：E
- 目标：任意已导入的 PDF/EPUB/TXT/Markdown 书籍，按**已锁定的 5 段模板**稳定产出 Markdown + JSON，通过结构校验后，从第 5 段写入可复制的 **draft** Skill，并可把结果交给对话上下文。本票做核心流水线与测试，不做桌面 UI（UI 归 DISTILL-002）。
- 负责人 Agent：ai_skill_engineer（BookSkill AI Skill Engineer）
- 依赖：IMPORT-001 / VERT-001 / SKILL-001 已在 `origin/integration`（`26ada833`）。本票不依赖 VER-001。
- 状态：Ready
- 启动时间：2026-11-16 22:31 Asia/Shanghai
- 分支 / 工作树：从 `origin/integration`（`26ada833`）拉 `feat/DISTILL-001`，独立 worktree `/workspace/bookskill-worktrees/DISTILL-001`
- 风险等级（预估）：中（只创建 draft Skill / 蒸馏产物文件；不改 schema；D-018 / D-017）
- 测试样本：只使用本票夹带的只读副本（见下），以及 FIXT-001 或同等许可/合成样本。不得改动原始交付资产。

## 锁定的 5 段结构（不得改名）

必须使用已有模板，而不是其它 5 段标题方案。锁定标题为：

1. 核心定位
2. 原则与应用
3. 金句
4. 应用框架
5. 可调用Skill

模板原文只读副本：`packages/core/test/fixtures/distill/蒸馏提示词模板.md`  
SHA-256：`7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2`  
原件：`/workspace/书籍蒸馏工作台/依据/蒸馏提示词模板.md`（禁止修改）。

已验收的 3 本定稿只读副本（哈希见 `packages/core/test/fixtures/distill/SHA256SUMS`）：

- `孙子兵法_蒸馏结果.md` `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- `论语_蒸馏结果.md` `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- `道德经_蒸馏结果.md` `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`

原件在 `/workspace/书籍蒸馏工作台/交付/`，禁止修改、覆盖或“整理”。

## 允许写入

- 新建 `packages/core/src/distill/**` 及 `packages/core/test/distill-001.test.ts`（或同等路径）
- 经 `packages/core/src/index.ts` **追加**导出
- `packages/core/test/fixtures/distill/**`（只读副本与校验；不得改哈希）
- `docs/distill/**`（本票报告；不覆盖其它报告）
- 可调用现有 `createSkill`；创建时必须显式传入 `status: draft`

## 禁止写入

- `packages/data` 迁移（产物存 BookSkill 数据目录下的蒸馏文件，或现有 books/skills 行，不新增高风险表）
- 桌面 UI（归 DISTILL-002）、搜索/关系实现、`packages/core/src/skills.ts` 版本写入核心
- 治理文件、FIXT-001 原样本、`/workspace/书籍蒸馏工作台/依据` 与 `交付` 原件
- 不得把 AnythingLLM 工作区、Pin、或其内部数据库当作业务写入路径
- 不得自动 `published`，不得执行来自书或 Skill 的任意代码，不得合入 `main`，不得发布

## 数据模型（JSON，与锁定 5 段对齐）

```json
{
  "book_id": "string",
  "title": "string",
  "source_filename": "string",
  "template_id": "bookskill.distill.5-segment.v1",
  "sections": [
    {"id": 1, "title": "核心定位", "content": "...", "quotes": [], "source": []},
    {"id": 2, "title": "原则与应用", "content": "...", "quotes": [], "source": []},
    {"id": 3, "title": "金句", "content": "...", "quotes": [], "source": []},
    {"id": 4, "title": "应用框架", "content": "...", "quotes": [], "source": []},
    {"id": 5, "title": "可调用Skill", "content": "...", "skills": [
      {"name": "...", "triggers": ["..."], "steps": ["..."], "output": "..."}
    ]}
  ]
}
```

同时产出与 JSON 等价的 Markdown。缺任一锁定标题、或只有 4 段，校验必须失败并非零退出（或返回结构化错误，测试可断言）。

## 实现要点

1. 对已导入书籍做章节切分，复用现有导入/定位，不另起一套库。
2. 按锁定模板逐段生成；测试可用 3 本定稿做解析/校验（不调用外部模型）。模型生成路径必须走 BookSkill 的模型适配层，可注入假适配器；未配置模型时不得假装已蒸馏成功。
3. 从第 5 段提取 1–3 个 Skill，调用 `createSkill(..., status: draft)` 写入第一版本；提供可单独复制的 Markdown/JSON。不得写 `published`（D-018）。
4. 引用必须能带到源文件名与段落定位（有则用现有 locator，无则标未确认，不得伪造精确出处）。
5. 为 DISTILL-002 冻结 API，至少包括：`parseDistillationMarkdown`、`validateDistillation`、`importDistillation`（把校验通过的结果写入本机数据目录并创建 draft Skill）、`listDistillations`、`loadDistillation`。生成接口若在本票落地，须可注入适配器。

## 验收条件（可测试）

1. 3 本定稿副本全部解析为完整 5 段，标题与锁定模板一致，JSON 与 Markdown 可互转；SHA-256 与 `SHA256SUMS` 一致（证明未改原件副本）。
2. 缺段、改标题、或 Skill 段为空的输入校验失败；不得写入 Skill。
3. 从《孙子兵法》第 5 段至少导入 1 个 draft Skill，`status !== published`，可导出独立 Skill 文本；触发条件/步骤/输出要求可读取。
4. 导入后的蒸馏结果带 `source_filename`；对话附件或引用结构中能看到源文件名（可用核心 API/测试断言，不必打开 Electron 窗口）。
5. 自动化测试失败时非零退出。独立 QA 通过后才能合入 `integration`。不得宣布完成，除非独立 QA 验证通过。“连续 3 本新书结构完整率 ≥90%”是后续带模型适配器的 QA 门，本票先用 3 本定稿 + 结构校验/注入适配器打底，不得用假成功冒充模型生成。

## 测试命令

```bash
# 在 feat/DISTILL-001 worktree
pnpm --filter @bookskill/core test
```

## 交付物路径

- `docs/distill/DISTILL-001-REPORT.md`
- 实现与测试
- 远端 PR：目标 `integration`，风险 medium；附变更摘要、验收对照、测试命令与结果、未决风险

## 失败升级条件

最多自动重试 2 次；其后 BLOCKED，不改 schema，不改桌面 UI，不改锁定模板与三本定稿原件或副本哈希。
