# COUNCIL-001 交接报告

- 任务：用已验收的《孙子兵法》《论语》《道德经》蒸馏结果，建立可召唤的专家席位；支持单席问答，以及至少两席依次发言再给出总结的圆桌。每轮回答必须带来源文件名。本票交付核心 API 与可测试编排，不做桌面席位卡片或新的一级导航。
- 负责人：ai_skill_engineer（BookSkill AI Skill Engineer）
- 分支：`feat/COUNCIL-001`
- 基础：变基后的 `origin/integration` @ `7c8d9a292d5990ce7e7328c8808e82b6375c0e0f`（含已合入的 SEARCH-002 / SKILL-001 / REL-002 / SKILL-004）。工单提交时的 integration tip 为 `26ada833`，本分支在实现前已变基到最新 tip。
- 工作区：`/workspace/bookskill-worktrees/COUNCIL-001`
- 完成时间：2026-11-16 22:38 Asia/Shanghai
- 实现提交：`0771ac4c2804253597f544d37f7c91e002b82d89`
- 状态：本地实现与测试已完成。准备推送 `feat/COUNCIL-001` 并打开目标为 `integration` 的 PR。**未合入 `main` / `integration`，未发布，未标 Done。** 这不是正式发运，也不是 G1。
- 风险等级：**中（medium）**。席位配置与对话编排；未改 schema / 迁移；席位 Skill 显式创建为 `draft`，不会自动发布（D-018）；未写入 `verified_by_user`（D-017）。

## 稳定席位 id

三个固定席位，id 一经选定不再改名：

| seat_id | 名称 | 书名 | 来源文件 | 绑定 Skill（section 5） |
|---|---|---|---|---|
| `sunzi-decision` | 决策席 | 孙子兵法 | `孙子兵法_蒸馏结果.md` | 孙子庙算决策评估 |
| `lunyu-conduct` | 处事席 | 论语 | `论语_蒸馏结果.md` | 论语君子七问处事顾问 |
| `laozi-wuwei` | 无为席 | 道德经 | `道德经_蒸馏结果.md` | 老子无为减法诊断 |

`sunzi-decision` 与工单示例一致。夹具哈希与 `packages/core/test/fixtures/distill/SHA256SUMS` 一致，实现过程未改字节：

- `孙子兵法_蒸馏结果.md` `87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290`
- `论语_蒸馏结果.md` `ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a`
- `道德经_蒸馏结果.md` `ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d`

## 如何在不拥有 `distill/**` 的情况下加载夹具

DISTILL-001 并行占用 `packages/core/src/distill/**`，本票没有创建或写入该路径。夹具 Markdown 由 `packages/core/src/council/parse-fixture.ts` 中的本地辅助函数解析：按锁定的 5 段结构切分（核心定位、原则与应用、金句、应用框架、可调用Skill），提取金句与 section 5 的 Skill 草案。这只是 council 内部的只读解析，不是另一套长期蒸馏模块。

## Draft-only Skills（D-018）

`establishCouncilSeats` 在 BookSkill 业务库中为每个席位调用既有 `createSkill`，并**显式传入 `status: draft`**。`createSkill` 在省略 status 时默认是 `tested`，因此不得省略。席位 Skill 域名为「智囊团」。若同名同域的 draft Skill 已存在，则复用，不重复插入。运行时拒绝把 `published` 的 Skill 绑到席位上。本票未改 `packages/core/src/skills.ts`。

## 适配器注入

模型调用走 BookSkill 适配层，不调用外部托管模型，也不走 AnythingLLM / Pin。测试与默认编排注入 `createFixtureCouncilAdapter()`：根据该席位被允许的夹具正文选择一条已存在的金句（决策席默认引用「知彼知己，百戰不殆；不知彼而知己，一勝一負；不知彼不知己，每戰必殆。」），生成可断言回复。调用方可替换为任何 `CouncilAdapter`。

编排在适配器返回后校验引用：`quote` 必须是允许范围内夹具 Markdown 的子串，`source_filename` 不得越出本席位（单席）或本轮参与席位（圆桌总结）的检索范围。编造原文或引用另一本书的来源会被拒绝。

单席检索范围只传入该书夹具。即使问题里出现《论语》金句，决策席也不会引用 `论语_蒸馏结果.md`。

## 圆桌行为

`runCouncilRoundtable` 按给定（或默认的三个）席位 id 依次发言，再由同一适配器以 `role: "summary"` 生成一条「圆桌总结」。至少需要 2 个席位。每条发言（含总结）都有非空的 `source_filename`；席位发言使用该书夹具文件名，总结汇参与席位的来源文件名。内容中也会带「来源：…」行。总结只复述各席已经给出的夹具原文，不另编造出处。

## 桌面与默认路由

本票为 **core-only**。未新增 `packages/desktop/src/renderer/council/**`，未改 main / preload / 导航，以避免与未合入的 DISTILL-002 抢同一新文件。验收均可通过 core 测试完成。`DEFAULT_ROUTE_ID` 仍为 `"chat"`，一级导航仍是 chat / library / knowledge / skills / settings 五项。智囊团作为问题对话下的可调用编排，不增加第六个一级入口。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 三个固定席位可列出，id 稳定，均绑定 draft Skill 或等价草稿上下文，无一为 `published` | **通过。** `listCouncilSeats` 返回 `sunzi-decision` / `lunyu-conduct` / `laozi-wuwei`。每个席位绑定 section 5 对应 Skill，`loadSkill` 状态为 `draft`，库中无 `published` Skill。 |
| 2 | 决策席单问（注入适配器）返回内容能指向《孙子兵法》夹具，并带来源文件名 | **通过。** 决策席引用夹具金句「知彼知己，百戰不殆；…」，结构化字段与正文均含 `孙子兵法_蒸馏结果.md`。注入适配器断言检索范围只有该书夹具。 |
| 3 | 圆桌至少 2 席连续发言 + 1 条总结，每条都有 `source_filename` | **通过。** 三席按序发言后一条总结；每条都有 `source_filename` 与「来源：」行。少于两席会抛错。 |
| 4 | 不改 schema，不加第六个一级导航；`DEFAULT_ROUTE_ID` 仍为 chat | **通过。** 未改 `packages/data` 迁移。core 测试读取桌面 `navigation.ts`，确认默认路由为 `chat` 且 `ROUTE_IDS` 仍为 5 项。未写 desktop 代码。 |
| 5 | `pnpm --filter @bookskill/core test` 通过；独立 QA 通过后才能合入 | **本地测试通过**（见下）。未合入，未标 Done，须独立 QA 验证后才能合入 `integration`。 |

另有防护用例：编造原文或越出检索范围的引用被拒绝；夹具 SHA-256 与 SHA256SUMS 一致；不存在 `packages/core/src/distill/**`；council 源码不 import distill 模块、不写 `verified_by_user`、不以 `published` 创建 Skill。

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/COUNCIL-001` 执行。环境：Node v24.22.1，pnpm 10.34.6，Linux x86_64。

```bash
pnpm --filter @bookskill/core test
```

- `pnpm --filter @bookskill/core test`：退出码 **0**；**86 passed，0 failed**（含已在 integration 上的既有用例，以及本票新增 11 项）。时间：2026-11-16 22:38:22–22:38:23 CST（Asia/Shanghai）。
- 未改 desktop，因此未跑 `pnpm --filter @bookskill/desktop test`。

## 交付物路径

- `packages/core/src/council/**` — 席位定义、本地夹具解析、draft Skill 建立、可注入适配器、单席与圆桌编排
- `packages/core/src/index.ts` — 仅追加导出（保留已合入的 SKILL-004 导出）
- `packages/core/test/council-001.test.ts` — 验收与隔离测试
- `docs/council/COUNCIL-001-REPORT.md`

未修改：`packages/core/src/distill/**`（未创建）、`packages/core/src/skills.ts`、`packages/data/**` 迁移、搜索 / 关系实现、治理文件、桌面导航与 UI、锁定夹具字节、`/workspace/书籍蒸馏工作台/依据` 与 `交付` 原件。未把 REL-002 / SKILL-004 的工作混入本分支（二者已在当前 integration 上，本分支只是变基其上）。未合入 `main` / `integration`，未发布，未标 Done。

## 未解决风险与后续

- **Core-only，无桌面席位卡片。** 工单允许最小接线，但为避免与未合入的 DISTILL-002 冲突，本票把 UI 留待后续工单。产品里还不能从一级导航或对话面板点选席位；编排 API 已可测。
- **夹具解析是 council 本地副本，不是正式蒸馏管线。** DISTILL-001 合入后，若其公共解析 API 稳定，后续票可以把本地解析替换为对 distill 模块的调用，但不要在本票抢路径。
- **席位注册在进程内。** draft Skill 写入既有 `skills` 表，但席位本身（system prompt、source 绑定）不落新表。每次使用需用同一夹具目录调用 `establishCouncilSeats`（对已有 draft Skill 幂等）。若后续要把席位持久化，需评估 schema 变更，风险应升高。
- **假适配器是确定性的夹具引用，不是真实模型。** 它能证明编排、来源范围与「不得编造原文」的校验；接入真实模型适配器后，仍需保证只引用夹具已有文本。
- **圆桌总结的 `source_filename` 是多文件用顿号拼接。** 字段仍是单数，测试按「包含各参与夹具文件名」断言。若 UI 需要结构化多来源，后续可加数组字段，而不改 schema。
- **道德经书名做了用字归一。** 夹具标题是「道德經」，席位 `book_title` 按工单与文件名写作「道德经」。引用正文仍逐字取自夹具，不改繁体原句。
- 这不是正式发布，也不是可安装发运包。须独立 QA 通过后才能合入 `integration`。未将 COUNCIL-001 标为 Done。

## 风险等级说明

**中（medium）。** 只在 core 中新增 council 编排与 draft Skill 绑定，复用既有 `createSkill` 与业务库，未改迁移，未改 Skill 写入核心，未改默认路由，未接入外部模型。若后续必须为席位持久化加新表 / 新列，或把真实模型接入而不再校验引用，风险应升高，并由独立 QA 重新验收。
