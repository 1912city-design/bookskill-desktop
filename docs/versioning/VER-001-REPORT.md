# VER-001 交接报告

- 任务：为 Skill 与知识卡提供本机可列出、可回滚、可追溯、可测试的追加式版本历史（不是 BACKUP-001 的整库备份）
- 负责人：backend_engineer（BookSkill Backend Engineer）
- 分支：`feat/VER-001`
- 基础：`origin/integration` @ `b3a240c6edea9c1d5988837ffa1bfd2ba479247d`（2026-11-17 变基后；原基础为 `5ec4540`）
- 工作区：`/workspace/bookskill-worktrees/VER-001`
- 完成时间：2026-11-16 22:17 Asia/Shanghai
- 实现提交（变基后重写）：`639dbd72212896d592c05b4d890c7724b7c16dcc`（原 `9c83e0ff07ba631ca0076d23af8e07d38a3ef76a`）
- 原报告提交（变基后重写）：`cc86fdd6427d1d48a6fb4f16a215a1a029ad4d68`（原 tip `74459e73aa97434d40556237d492ee00cdb78654`）
- 本轮 follow-up：变基到当前 `integration` tip，修正 desktop schema 断言并完成本机 data/core/desktop 测试。**自测不是独立 QA。未合入，未发布，不得宣布本票 Done / G1 / G2。**
- 状态：本地实现与测试已完成，并准备基于 `integration` 的远端 PR。**未合入 `main` / `integration`，未发布，不得宣布本票 Done。** 风险为 **高（high）**。PR 必须保持 OPEN，待独立 QA 后由 Orchestrator 按 D-025 征求人工确认再合入 `integration`。
- 风险等级：**高（high）**。新增 schema V3 迁移（`knowledge_card_revisions` 表 + 已有卡的 revision=1 基线回填）。Skill 回滚 API 未新增表，与本票一并交付。


## 2026-11-17 follow-up：变基到当前 integration 并修复 desktop 测试

- 执行人：backend_engineer（BookSkill Backend Engineer）
- 时间：2026-11-17 21:11–21:12 Asia/Shanghai（CST，UTC+8）
- 工作区：`/workspace/bookskill-worktrees/VER-001`
- 分支：`feat/VER-001`（PR #15，保持 OPEN，base 仍为 `integration`；不合入，不改 base，不触 `main`）
- 决策约束：P-013 — 本票修好后只合入 `integration`，不合入 `main`，不发布，不标 Done / G1 / G2。本轮只做变基 + 修复 + 推送。

### 变基链

| 角色 | 完整 SHA | 说明 |
|---|---|---|
| 变基前 tip | `74459e73aa97434d40556237d492ee00cdb78654` | 原文档提交 |
| 变基前实现 | `9c83e0ff07ba631ca0076d23af8e07d38a3ef76a` | 原实现提交 |
| 变基基础 | `b3a240c6edea9c1d5988837ffa1bfd2ba479247d` | 当前 `origin/integration`（Merge PR #22 DISTILL-002；已含 SEARCH-002 / SKILL-001 / REL-002 / SKILL-004 / COUNCIL-001 / DISTILL-001 / DISTILL-002） |
| 重写后票务文档 | `60cf1f81c378b26b2822d454e07d209238608251` | `docs: add VER-001 ticket and acceptance criteria`，parent 为 `b3a240c` |
| 重写后实现 | `639dbd72212896d592c05b4d890c7724b7c16dcc` | `feat(versioning): add skill rollback APIs and knowledge card revision history (VER-001)` |
| 重写后原报告 | `cc86fdd6427d1d48a6fb4f16a215a1a029ad4d68` | `docs(versioning): record VER-001 implementation commit hash and test results` |
| 本轮 follow-up | 本文件与测试修复同一次提交；完整 tip SHA 以提交后的 `git rev-parse feat/VER-001` 为准 | 见下方改动文件 |

变基过程：`git fetch` 后确认 `origin/integration` 恰好为 `b3a240c6edea9c1d5988837ffa1bfd2ba479247d`，再 `git rebase origin/integration`。3 个提交全部应用成功，**无冲突文件**。未丢弃 integration 上的新功能。

### 本轮改动文件

- `packages/desktop/test/slice-wiring.test.ts`：不再把 `snapshot.schemaVersion` 写死为 `2`，改为断言 `SCHEMA_VERSION_CURRENT`（自 `@bookskill/data` 导入，与 core 测试一致）。
- `docs/versioning/VER-001-REPORT.md`、`docs/versioning/pull-request.md`、`docs/versioning/pnpm-test-output.txt`：记录变基、本轮测试与残差。

未改业务行为。未新增产品 API。`BookskillDesktopBridge` 在 integration tip 上已含 DISTILL-002 必填方法；变基后 `packages/desktop/test/rel-001.test.ts` 与 `rel-002.test.ts` 中的测试桩已具备 `startDistill` / `importDistillationMarkdown` / `loadDistillation` / `listDistillations` / `attachDistillationToChat` / `loadDistillationChatContext` 等字段，`tsc --noEmit` 已通过，因此本轮不必再改这些桩。

### 本轮测试（Asia/Shanghai，三者均为 exit 0）

在 `/workspace/bookskill-worktrees/VER-001` 执行。完整输出追加于 `docs/versioning/pnpm-test-output.txt`。

| 命令 | 时间（Asia/Shanghai） | 退出码 | 结果 |
|---|---|---|---|
| `pnpm --filter @bookskill/data test` | 2026-11-17 21:11:26 CST 开始，21:11:27 CST 结束 | **0** | **13 passed，0 failed**（4 suites） |
| `pnpm --filter @bookskill/core test` | 2026-11-17 21:11:27 CST 开始，21:11:28 CST 结束 | **0** | **100 passed，0 failed**（23 suites；数量多于变基前的 44，是因为当前 integration 已含 COUNCIL / DISTILL / REL-002 / SEARCH-002 / SKILL-004 等测试，本票原有 7 项 VER-001 测试仍通过） |
| `pnpm --filter @bookskill/desktop test` | 2026-11-17 21:11:31 CST 开始，21:11:35 CST 结束 | **0** | **66 passed，0 failed**（13 suites）。该脚本先执行 `pnpm --filter @bookskill/repo-baseline build` 与 `tsc -p tsconfig.json --noEmit`，二者均成功后才跑 `node --test`。 |

**自测不是独立 QA。** 本报告不宣布工单完成，不宣布 G1 / G2。

## 变更摘要与迁移范围

### Schema V3（`packages/data`）

- `SCHEMA_VERSION_V3 = 3`，`SCHEMA_VERSION_CURRENT` 改为 V3。`knowledge_card_revisions` 加入 `CORE_TABLES`。
- V1 / V2 迁移体保持不变。追加 `migrationV3`（`create_knowledge_card_revisions`）：建表（UUID 主键、`UNIQUE (card_id, revision)`、FK 到 `knowledge_cards(id)`），并建立 `card_id` 与 `(card_id, revision)` 索引。
- 升级时为每张已有知识卡补写 `revision=1` 基线快照（字段等于当时的 title / type / content / conditions / limitations / status；`created_at` 使用卡片的 `created_at`；新 UUID 由 `createBusinessId` 生成）。无知识卡的 V2 库也可干净升级。
- 未改动 `migrate.ts` 的 `VACUUM INTO` 预迁移备份与失败还原路径；失败迁移行为不弱于 DATA-001。`backup.test.ts` 继续通过。

### Skill API（无新表）

在已有 `skill_versions` 上补齐并导出：

- `listSkills`、`listSkillVersions`（按 `created_at`、`version`、`id` 稳定排序）
- `rollbackSkillToVersion`：把目标历史版本的 inputs / steps / rules / outputSchema / permissions / knowledgeCardIds 复制为**新行**（新 UUID，version 为 `${target.version}+rollback-<shortid>`，shortid 取新 UUID 去横线后的前 8 位）。`current_version_id` 指向新行；旧行全部保留，不改写内容字段。
- D-018：回滚后状态一律为 `draft`。若回滚前是 `published`，回滚后也是 `draft`，不会自动发布。
- 可选辅助：`summarizeSkillVersionDiff`、`updateSkillMetadata`（不改 status）、`transitionSkillStatus`（只有调用方**显式传入** `status` 时才能写成 `published`；create / 新版本 / 回滚路径仍拒绝自动发布）。

### 知识卡修订

- 新建 `packages/core/src/knowledge-revisions.ts`。`draftKnowledgeCardFromLocator` / `updateKnowledgeCard` / `confirmKnowledgeCard` / `mergeKnowledgeCards` 都在**同一事务**中追加一条修订（每张卡从 1 递增），快照包含写下时的 status。
- `rollbackKnowledgeCardToRevision`（D-017）只恢复正文字段：title / type / content / conditions / limitations。**不改变 status**（draft 仍是 draft；已确认的仍是 `verified_by_user`）。然后追加一条新修订，记录的是**未改变的当前 status**。旧修订行不改写。
- `deleteKnowledgeCard` 在删除卡片前先 `DELETE FROM knowledge_card_revisions WHERE card_id = ?`。其余删除契约不变（P-012）：清理 relations / sources / skill_sources，evidence_refs 置空，书与 source_chunks 保留。
- `mergeKnowledgeCards` 不改 P-012（不写 `knowledge_relations` 合并行；被吸收的 skill_sources 删除而非改指向）。幸存卡追加一条合并后内容的修订，status 不变；被吸收卡的修订随删除清理。
- `KNOWLEDGE_CARD_STATUS_VERIFIED` 仍只在 `confirmKnowledgeCard` 内赋值；回滚代码放在 `knowledge-revisions.ts`，不使用该常量。既有 KNOW-001 源码扫描测试继续通过。

未改桌面 UI（归 VER-002 / SKILL-001）、搜索、关系、导入管道、FIXT 样本、治理文件。未做 BACKUP-001。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | Skill：创建后改一版，`listSkillVersions` 至少 2 条；回滚到第一版后，当前指针内容等于第一版快照，历史至少 3 行（v1、v2、回滚新行）。回滚不自动 `published`。 | **通过。** `packages/core/test/ver-001.test.ts`：创建 `1.0.0`，再写 `1.1.0`，列表为 2；回滚后当前 inputs/steps/rules/output/permissions/sources 等于第一版，历史 3 行且原 v1/v2 内容未改，状态为 `draft`。另测：将 Skill 显式 `transitionSkillStatus(..., published)` 后回滚，状态变为 `draft` 而非 `published`。create 传入 `published` 仍被拒绝。 |
| 2 | 知识卡：草稿、编辑、确认后修订列表递增；回滚到编辑前正文恢复，status 不自动变为 `verified_by_user`（若回滚前已确认，也不得悄改变成另一种状态）。再确认仍走 `confirmKnowledgeCard`。 | **通过。** 草稿→编辑→确认，修订长度 1→2→3。回滚到编辑前：正文恢复；若回滚前已确认，status 仍为 `verified_by_user`。另测：未确认的草稿回滚后仍为 `draft`，不会被自动确认。随后再次 `confirmKnowledgeCard` 会再追加一条修订。 |
| 3 | 迁移：V2 库（含已有知识卡）应用 V3 后可读取，且每张卡至少有 1 条基线修订。迁移失败路径不弱于既有 DATA-001 备份行为。无卡库也可升级。 | **通过。** `packages/data/test/migration.test.ts`：V2 插入知识卡（及书/切片）后升到 V3，卡可读且恰好 1 条 `revision=1` 基线，字段与当前行一致；无卡 V2 库升级后修订表为空。既有 v1→v2 路径保留（不再把 V2 等同于 CURRENT），再升到 V3 后旧书/切片仍可读。`backup.test.ts` 用 `CURRENT+1` 的失败迁移仍能还原到升级前状态。 |
| 4 | 删除知识卡后，其修订行不再残留；原书与 source_chunks 仍在。 | **通过。** 删除后 `knowledge_card_revisions` 计数为 0，原书标题与切片（含 `[P1.3]`）仍在。合并路径同样清理被吸收卡修订，幸存卡追加一条修订，status 不变，书仍在，不写合并关系行。 |
| 5 | 自动化测试覆盖上述路径及“回滚不改写旧行”；失败时非零退出。独立 QA 通过后交 Orchestrator，等待人工确认再合入。不得宣布完成。 | **通过（测试）。** 回滚前后逐字段比对既有 Skill 版本行与知识卡修订行（id、revision、内容、created_at）保持不变。`pnpm --filter @bookskill/data test` 与 `pnpm --filter @bookskill/core test` 均退出码 0。**合入与 Done 另计**：本报告不宣布工单完成。 |

## 测试命令及本机结果（Asia/Shanghai）

在 `/workspace/bookskill-worktrees/VER-001` 执行。环境：Node 与 pnpm 工作区，Linux x86_64。完整输出：`docs/versioning/pnpm-test-output.txt`。

```bash
pnpm --filter @bookskill/data test
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test   # includes tsc --noEmit
```

变基前（2026-11-16）只跑了 data / core。变基后（2026-11-17）三者都跑过，见上方 follow-up 表。历史记录保留如下。

| 命令 | 时间（Asia/Shanghai） | 退出码 | 结果 |
|---|---|---|---|
| `pnpm --filter @bookskill/data test` | 2026-11-16 22:17:25 CST | **0** | **13 passed，0 failed** |
| `pnpm --filter @bookskill/core test` | 2026-11-16 22:17:26 CST | **0** | **44 passed，0 failed**（含本票新增 7 项；既有 know-001 / knowledge / import / search / rel / slice / paths 全部继续通过） |

初次跑测时间约为 2026-11-16 22:17:10–22:17:13 CST，结果相同（data 13/0，core 44/0，退出码 0）。上方表格以写入本报告前的复跑为准。

## 交付物路径

- `packages/data/src/constants.ts`、`migrations.ts`、`index.ts` — V3 常量、迁移、导出
- `packages/data/test/migration.test.ts`、`schema.test.ts` — V2→V3、基线回填、修订表列与 FK
- `packages/core/src/skills.ts` — list / rollback / diff / metadata / status
- `packages/core/src/knowledge.ts` — 写入路径追加修订；删除/合并清理修订
- `packages/core/src/knowledge-revisions.ts` — 修订记录类型、list / load / rollback / diff
- `packages/core/src/index.ts` — 仅追加导出
- `packages/core/test/ver-001.test.ts` — 验收测试
- `packages/core/test/paths.test.ts`、`slice.test.ts` — schema 断言改为 CURRENT / 3
- `docs/versioning/VER-001-REPORT.md`
- `docs/versioning/pull-request.md`
- `docs/versioning/pnpm-test-output.txt`

最初实现未改 `packages/desktop/**`。2026-11-17 follow-up 仅修改 `packages/desktop/test/slice-wiring.test.ts`（schema 断言）以及 `docs/versioning/**`。仍未修改治理文件（`docs/DECISIONS.md`、`PROJECT_STATE.md`、`BLOCKERS.md`、`TASKS.md`、`PENDING_DECISIONS.md`、`docs/policies/**`、`docs/tickets/**`）、FIXT 样本正文、导入/搜索/关系/阅读 UI 业务行为。

**给 VER-002 的说明：** `packages/desktop/test/slice-wiring.test.ts` 已改为断言 `SCHEMA_VERSION_CURRENT`，不再写死为 2。桌面历史 UI 仍不在本票范围。

## 冻结 API 签名（供 Frontend VER-002）

下列签名已在本实现中导出，请按此对接，不要依赖未导出的内部辅助函数（如 `appendKnowledgeCardRevision`）。

```ts
import type { DatabaseSync } from "node:sqlite";
import type {
  KnowledgeCardRecord,
  SkillRecord,
  SkillVersionRecord,
} from "@bookskill/core";

// --- Skills（无新表，基于 skill_versions）---

function listSkills(db: DatabaseSync): SkillRecord[];
// 排序：updated_at DESC, created_at DESC, id

function listSkillVersions(db: DatabaseSync, skillId: string): SkillVersionRecord[];
// 排序：created_at ASC, version ASC, id ASC

type RollbackSkillToVersionOptions = {
  db: DatabaseSync;
  skillId: string;
  versionId: string;
  now?: Date;
};

function rollbackSkillToVersion(options: RollbackSkillToVersionOptions): {
  skill: SkillRecord;
  version: SkillVersionRecord;
  rolledBackFrom: SkillVersionRecord;
};
// 新 version 字符串：`${target.version}+rollback-<shortid>`
// 回滚后 skill.status 为 "draft"（含回滚前为 published 的情况）
// 旧 skill_versions 行不被删除或改写

type SkillVersionDiffField =
  | "inputs"
  | "steps"
  | "rules"
  | "outputSchema"
  | "permissions"
  | "knowledgeCardIds";

function summarizeSkillVersionDiff(
  a: SkillVersionRecord,
  b: SkillVersionRecord,
): SkillVersionDiffField[];

type UpdateSkillMetadataOptions = {
  db: DatabaseSync;
  skillId: string;
  name?: string;
  domain?: string;
  purpose?: string;
  now?: Date;
};

function updateSkillMetadata(options: UpdateSkillMetadataOptions): SkillRecord;
// 不改变 status

type TransitionSkillStatusOptions = {
  db: DatabaseSync;
  skillId: string;
  status: string;
  now?: Date;
};

function transitionSkillStatus(options: TransitionSkillStatusOptions): SkillRecord;
// published 仅在调用方显式传入 status: "published" 时写入

// --- 知识卡修订 ---

type KnowledgeCardRevisionRecord = {
  id: string;
  cardId: string;
  revision: number;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string; // 写下时的状态，只记录；回滚不会自动套用为确认
  createdAt: string;
};

function listKnowledgeCardRevisions(
  db: DatabaseSync,
  cardId: string,
): KnowledgeCardRevisionRecord[];
// 排序：revision ASC, id ASC

function loadKnowledgeCardRevision(
  db: DatabaseSync,
  revisionId: string,
): KnowledgeCardRevisionRecord;

type RollbackKnowledgeCardToRevisionOptions = {
  db: DatabaseSync;
  cardId: string;
  revisionId: string;
  now?: Date;
};

function rollbackKnowledgeCardToRevision(
  options: RollbackKnowledgeCardToRevisionOptions,
): KnowledgeCardRecord;
// 只恢复 title / type / content / conditions / limitations
// 不改变 status；然后追加一条新修订，status 记当前未变状态

type KnowledgeCardRevisionDiffField =
  | "title"
  | "type"
  | "content"
  | "conditions"
  | "limitations";

function summarizeKnowledgeCardRevisionDiff(
  a: KnowledgeCardRevisionRecord,
  b: KnowledgeCardRevisionRecord,
): KnowledgeCardRevisionDiffField[];
```

既有 `SkillRecord` / `SkillVersionRecord` / `KnowledgeCardRecord` 形状未改。回滚后请用 `loadSkill` + `loadSkillVersion(skill.currentVersionId)` 或返回值中的 `version` 读取当前快照；知识卡回滚后用返回的 `KnowledgeCardRecord` 或 `loadKnowledgeCard`。

## 未解决风险

- **高风险 schema 迁移。** V3 会改用户业务库结构。合入 `integration` 必须按 D-020 / D-025 等待独立 QA 与人工确认。本 PR 保持 OPEN，不得自动合入，不得宣布 Done。
- **桌面 schema 断言（已在 2026-11-17 follow-up 修复）。** `packages/desktop/test/slice-wiring.test.ts` 现断言 `SCHEMA_VERSION_CURRENT`。`pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）已通过。桌面历史 UI 仍留给 VER-002。
- **并发写入同一张卡。** 修订号用 `MAX(revision)+1`，写路径包在事务中，但两个连接同时更新同一张卡时仍可能撞上 `UNIQUE (card_id, revision)`。与现有卡片更新相同，本票未加额外锁协议。
- **Skill 回滚 version 字符串。** 使用 `${target.version}+rollback-<8 hex>`。极端情况下短 id 碰撞会触发 `UNIQUE (skill_id, version)` 并失败，而不会改写旧行。调用方可重试。
- **知识卡 `type` 视为正文字段。** 回滚会恢复 `type`。当前写入 API 并不编辑 type，因此通常与回滚目标一致。
- 本票不包含整库备份（BACKUP-001）、桌面历史 UI（VER-002）或 Skill Studio UI（SKILL-001）。

## 风险等级说明

**高（high）。** 本票包含数据迁移。实现与测试可在本分支完整交付并开向 `integration` 的 PR，但 **PR 必须保持 OPEN**。Orchestrator 在独立 QA 通过后征求人工确认，再按 D-025 合入。不得自行合入 `integration` 或 `main`，不得发布，不得宣布工单完成。
