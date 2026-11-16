# VER-001 交接报告

- 任务：为 Skill 与知识卡提供本机可列出、可回滚、可追溯、可测试的追加式版本历史（不是 BACKUP-001 的整库备份）
- 负责人：backend_engineer（BookSkill Backend Engineer）
- 分支：`feat/VER-001`
- 基础：`origin/integration` @ `5ec4540`
- 工作区：`/workspace/bookskill-worktrees/VER-001`
- 完成时间：2026-11-16 22:17 Asia/Shanghai
- 实现提交：`9c83e0ff07ba631ca0076d23af8e07d38a3ef76a`
- 状态：本地实现与测试已完成，并准备基于 `integration` 的远端 PR。**未合入 `main` / `integration`，未发布，不得宣布本票 Done。** 风险为 **高（high）**。PR 必须保持 OPEN，待独立 QA 后由 Orchestrator 按 D-025 征求人工确认再合入 `integration`。
- 风险等级：**高（high）**。新增 schema V3 迁移（`knowledge_card_revisions` 表 + 已有卡的 revision=1 基线回填）。Skill 回滚 API 未新增表，与本票一并交付。

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
```

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

未修改：`packages/desktop/**`、治理文件（`docs/DECISIONS.md`、`PROJECT_STATE.md`、`BLOCKERS.md`、`TASKS.md`、`PENDING_DECISIONS.md`、`docs/policies/**`、`docs/tickets/**`）、FIXT 样本正文、导入/搜索/关系/阅读 UI。

**给 VER-002 的说明：** `packages/desktop/test/slice-wiring.test.ts` 仍断言 `schemaVersion === 2`。该测试不在根 `pnpm test` 范围内（当前 CI 跑 lint + repo-baseline test + build）。本票按允许写入范围未改 `packages/desktop/**`。VER-002 可把这一行改为 3 / `SCHEMA_VERSION_CURRENT`。

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
- **桌面测试仍断言 schema v2。** `packages/desktop/test/slice-wiring.test.ts` 未改（禁止写入 desktop）。若有人单独跑桌面测试会失败，留给 VER-002。
- **并发写入同一张卡。** 修订号用 `MAX(revision)+1`，写路径包在事务中，但两个连接同时更新同一张卡时仍可能撞上 `UNIQUE (card_id, revision)`。与现有卡片更新相同，本票未加额外锁协议。
- **Skill 回滚 version 字符串。** 使用 `${target.version}+rollback-<8 hex>`。极端情况下短 id 碰撞会触发 `UNIQUE (skill_id, version)` 并失败，而不会改写旧行。调用方可重试。
- **知识卡 `type` 视为正文字段。** 回滚会恢复 `type`。当前写入 API 并不编辑 type，因此通常与回滚目标一致。
- 本票不包含整库备份（BACKUP-001）、桌面历史 UI（VER-002）或 Skill Studio UI（SKILL-001）。

## 风险等级说明

**高（high）。** 本票包含数据迁移。实现与测试可在本分支完整交付并开向 `integration` 的 PR，但 **PR 必须保持 OPEN**。Orchestrator 在独立 QA 通过后征求人工确认，再按 D-025 合入。不得自行合入 `integration` 或 `main`，不得发布，不得宣布工单完成。
