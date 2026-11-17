# VER-001: Skill rollback APIs and knowledge card revision history

**Risk: high** (schema V3 data migration).

**Keep this PR OPEN.** Do not auto-merge. After independent QA, the Orchestrator will seek human confirmation under D-025 before merging into `integration`. This change must not be merged to `main` and must not be published as part of this ticket. Do not mark VER-001 Done.

- Branch: `feat/VER-001`
- Base: `integration` (`b3a240c6edea9c1d5988837ffa1bfd2ba479247d`; originally `5ec4540`)
- Implementation commit (rewritten by rebase): `639dbd72212896d592c05b4d890c7724b7c16dcc` (was `9c83e0ff07ba631ca0076d23af8e07d38a3ef76a`)
- Pre-follow-up rebased docs commit: `cc86fdd6427d1d48a6fb4f16a215a1a029ad4d68` (was tip `74459e73aa97434d40556237d492ee00cdb78654`)
- 2026-11-17 follow-up: rebase onto current `integration`, fix desktop `slice-wiring` schema assertion, re-run data/core/desktop tests. The follow-up commit is the branch tip after this update.
- Report: `docs/versioning/VER-001-REPORT.md`
- Keep this PR OPEN against `integration`. Do not merge, do not retarget, do not touch `main`, do not mark Done / G1 / G2.

## Change summary

Skills and knowledge cards now have local, append-only, testable history. History rows are never rewritten; rollback writes a new row and updates the current pointer (Git-like). This is not whole-library backup (BACKUP-001) and does not change desktop UI (VER-002 / SKILL-001).

### Migration (V3)

- `SCHEMA_VERSION_CURRENT` is now 3.
- New table `knowledge_card_revisions` (UUID PK, `UNIQUE (card_id, revision)`, FK to `knowledge_cards`, indexes on `card_id` and `(card_id, revision)`).
- Existing V2 libraries are upgraded with a `revision=1` baseline snapshot for every current knowledge card (fields equal the current row). Empty libraries upgrade cleanly.
- V1 and V2 migration bodies are unchanged. Pre-migration `VACUUM INTO` backup and failed-migration restore are unchanged and remain at least as strong as DATA-001.

Skill rollback needs no new table; it uses existing `skill_versions`.

### Skill APIs

- `listSkills`, `listSkillVersions`, `rollbackSkillToVersion`
- Rollback copies inputs/steps/rules/outputSchema/permissions/knowledgeCardIds into a **new** `skill_versions` row (`${target.version}+rollback-<shortid>`), points `current_version_id` at it, and keeps all old rows.
- D-018: rollback always sets status to `draft` and never auto-publishes (including when the skill was `published`).
- Also exported for VER-002: `summarizeSkillVersionDiff`, `updateSkillMetadata`, `transitionSkillStatus` (`published` only when the caller passes it explicitly).

### Knowledge card revisions

- `draft` / `update` / `confirm` / `merge` append a revision in the same transaction as the card write.
- `rollbackKnowledgeCardToRevision` restores body fields only (`title`, `type`, `content`, `conditions`, `limitations`) and **does not change `status`** (D-017). A new revision is then appended with the unchanged status.
- Delete cleans revision rows before deleting the card. Merge keeps the P-012 contract (no merge relation row; absorbed `skill_sources` are dropped), appends a survivor revision, and deletes absorbed revisions.
- `verified_by_user` is still assigned only inside `confirmKnowledgeCard`.

## Acceptance results

1. **Skill — passed.** Create, edit, `listSkillVersions` has 2 rows; rollback to v1 restores the first snapshot; history has 3 rows (v1, v2, new rollback row); original rows unchanged; status is not `published`. A skill explicitly set to `published` becomes `draft` after rollback.
2. **Knowledge cards — passed.** Draft / edit / confirm grow the revision list (1 → 2 → 3). Rollback to the pre-edit revision restores the body. A confirmed card stays `verified_by_user`; a draft stays `draft` (no auto-confirm). Further confirm still goes through `confirmKnowledgeCard`.
3. **Migration — passed.** V2 libraries with cards upgrade to V3; each card has exactly one `revision=1` baseline matching current fields; books/chunks remain readable. Empty V2 libraries upgrade cleanly. Failed-migration restore still matches DATA-001 behavior.
4. **Delete — passed.** Deleting a card removes its revision rows; the book and `source_chunks` remain. Merge still satisfies KNOW-001 and appends a survivor revision.
5. **Tests — passed, non-zero on failure.** Rollback does not rewrite old rows. See commands below. Independent QA and human confirmation are still required; this PR does not complete the ticket.

## Test commands and results (Asia/Shanghai)

From `/workspace/bookskill-worktrees/VER-001`:

```bash
pnpm --filter @bookskill/data test
pnpm --filter @bookskill/core test
pnpm --filter @bookskill/desktop test   # includes tsc --noEmit
```

Original implementation run (2026-11-16, before rebase):

- `pnpm --filter @bookskill/data test` — 2026-11-16 22:17:25 CST — exit **0** — **13 passed, 0 failed**
- `pnpm --filter @bookskill/core test` — 2026-11-16 22:17:26 CST — exit **0** — **44 passed, 0 failed** (including 7 new VER-001 tests)

Follow-up run after rebase onto `b3a240c` (2026-11-17, Asia/Shanghai):

- `pnpm --filter @bookskill/data test` — 2026-11-17 21:11:26–21:11:27 CST — exit **0** — **13 passed, 0 failed**
- `pnpm --filter @bookskill/core test` — 2026-11-17 21:11:27–21:11:28 CST — exit **0** — **100 passed, 0 failed** (count rose because current `integration` includes later tickets' tests; the original 7 VER-001 tests still pass)
- `pnpm --filter @bookskill/desktop test` — 2026-11-17 21:11:31–21:11:35 CST — exit **0** — **66 passed, 0 failed**. The package test script ran `tsc -p tsconfig.json --noEmit` successfully before the node tests.

Full captured output: `docs/versioning/pnpm-test-output.txt`.

These self-tests are not independent QA. This PR does not complete the ticket.

The desktop `slice-wiring` test now asserts `SCHEMA_VERSION_CURRENT` instead of a hardcoded `2`. DISTILL-002 required bridge methods were already present on the REL-001 / REL-002 test stubs after the clean rebase; no further stub edits were required for `tsc`.

## Frozen API signatures (for Frontend VER-002)

```ts
import type { DatabaseSync } from "node:sqlite";
import type {
  KnowledgeCardRecord,
  SkillRecord,
  SkillVersionRecord,
} from "@bookskill/core";

function listSkills(db: DatabaseSync): SkillRecord[];
// sort: updated_at DESC, created_at DESC, id

function listSkillVersions(db: DatabaseSync, skillId: string): SkillVersionRecord[];
// sort: created_at ASC, version ASC, id ASC

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
// new version string: `${target.version}+rollback-<shortid>`
// post-rollback skill.status is always "draft"

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

type TransitionSkillStatusOptions = {
  db: DatabaseSync;
  skillId: string;
  status: string;
  now?: Date;
};

function transitionSkillStatus(options: TransitionSkillStatusOptions): SkillRecord;
// "published" only when the caller passes status explicitly

type KnowledgeCardRevisionRecord = {
  id: string;
  cardId: string;
  revision: number;
  title: string;
  type: string;
  content: string;
  conditions: string | null;
  limitations: string | null;
  status: string;
  createdAt: string;
};

function listKnowledgeCardRevisions(
  db: DatabaseSync,
  cardId: string,
): KnowledgeCardRevisionRecord[];
// sort: revision ASC, id ASC

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
// restores title, type, content, conditions, limitations; does not change status

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

## Unresolved risks

- High-risk schema migration: must stay OPEN pending independent QA and human confirmation (D-025).
- Desktop `slice-wiring` schema assertion has been updated to `SCHEMA_VERSION_CURRENT` in the 2026-11-17 follow-up. Desktop history UI remains out of scope (VER-002).
- Concurrent writers on the same card could theoretically collide on `UNIQUE (card_id, revision)`.
- Rollback version short ids are 8 hex characters; a collision would fail the insert rather than rewrite history.
- Knowledge card `type` is treated as a body field and is restored on rollback.

Do not merge this PR. Do not announce VER-001 complete.
