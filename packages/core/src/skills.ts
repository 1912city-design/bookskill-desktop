import type { DatabaseSync } from "node:sqlite";
import {
  DEFAULT_SKILL_DOMAIN,
  DEFAULT_SKILL_NAME,
  DEFAULT_SKILL_VERSION,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SKILL_STATUS_TESTED,
} from "./constants.ts";
import type { SkillInputSpec, SkillRecord, SkillVersionRecord } from "./types.ts";
import { newId, nowIso, withTransaction } from "./util.ts";

export type CreateSkillOptions = {
  db: DatabaseSync;
  name: string;
  domain: string;
  purpose: string;
  status?: string;
  version?: string;
  inputs: SkillInputSpec[];
  steps: unknown;
  rules: unknown;
  outputSchema: unknown;
  permissions: unknown;
  knowledgeCardIds?: string[];
  now?: Date;
};

export type CreateSkillVersionOptions = {
  db: DatabaseSync;
  skillId: string;
  version: string;
  status?: string;
  inputs: SkillInputSpec[];
  steps: unknown;
  rules: unknown;
  outputSchema: unknown;
  permissions: unknown;
  knowledgeCardIds?: string[];
  now?: Date;
  setAsCurrent?: boolean;
};

export function createSkill(options: CreateSkillOptions): { skill: SkillRecord; version: SkillVersionRecord } {
  if (options.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("Skills must not be auto-published; omit published status in this slice");
  }
  const stamp = nowIso(options.now);
  const skillId = newId();
  const versionId = newId();
  const version = options.version ?? DEFAULT_SKILL_VERSION;
  const status = options.status ?? SKILL_STATUS_TESTED;
  withTransaction(options.db, () => {
    options.db
      .prepare(
        `INSERT INTO skills(id, name, domain, purpose, status, current_version_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(skillId, options.name, options.domain, options.purpose, status, null, stamp, stamp);
    insertVersion(options.db, {
      id: versionId,
      skillId,
      version,
      inputs: options.inputs,
      steps: options.steps,
      rules: options.rules,
      outputSchema: options.outputSchema,
      permissions: options.permissions,
      knowledgeCardIds: options.knowledgeCardIds ?? [],
      createdAt: stamp,
    });
    options.db.prepare(`UPDATE skills SET current_version_id = ?, updated_at = ? WHERE id = ?`).run(versionId, stamp, skillId);
  });
  return { skill: loadSkill(options.db, skillId), version: loadSkillVersion(options.db, versionId) };
}

export function createSkillVersion(options: CreateSkillVersionOptions): {
  skill: SkillRecord;
  version: SkillVersionRecord;
  previousVersion: SkillVersionRecord;
} {
  const skill = loadSkill(options.db, options.skillId);
  if (!skill.currentVersionId) {
    throw new Error(`Skill ${options.skillId} has no current version to keep`);
  }
  const previousVersion = loadSkillVersion(options.db, skill.currentVersionId);
  if (options.status === SKILL_STATUS_PUBLISHED) {
    throw new Error("This slice does not auto-publish a new Skill version");
  }
  const stamp = nowIso(options.now);
  const versionId = newId();
  withTransaction(options.db, () => {
    insertVersion(options.db, {
      id: versionId,
      skillId: options.skillId,
      version: options.version,
      inputs: options.inputs,
      steps: options.steps,
      rules: options.rules,
      outputSchema: options.outputSchema,
      permissions: options.permissions,
      knowledgeCardIds: options.knowledgeCardIds ?? previousVersion.knowledgeCardIds,
      createdAt: stamp,
    });
    if (options.setAsCurrent !== false) {
      options.db
        .prepare(`UPDATE skills SET current_version_id = ?, status = ?, updated_at = ? WHERE id = ?`)
        .run(versionId, options.status ?? SKILL_STATUS_DRAFT, stamp, options.skillId);
    }
  });
  return {
    skill: loadSkill(options.db, options.skillId),
    version: loadSkillVersion(options.db, versionId),
    previousVersion: loadSkillVersion(options.db, previousVersion.id),
  };
}

export function createRetrospectiveSkill(
  db: DatabaseSync,
  knowledgeCardId: string,
  now?: Date,
): { skill: SkillRecord; version: SkillVersionRecord } {
  return createSkill({
    db,
    name: DEFAULT_SKILL_NAME,
    domain: DEFAULT_SKILL_DOMAIN,
    purpose: "根据可追溯的知识卡原则，帮助准备一次项目复盘，并明确区分书中来源与无来源推断。",
    status: SKILL_STATUS_TESTED,
    version: DEFAULT_SKILL_VERSION,
    inputs: [
      {
        name: "project_name",
        required: true,
        description: "要复盘的项目名称",
      },
    ],
    steps: [
      { id: "collect", text: "确认项目名称与复盘范围。" },
      { id: "cite", text: "用已确认知识卡和原书段落组织复盘问题。" },
      { id: "flag", text: "把没有来源的内容明确标注出来。" },
    ],
    rules: [
      "每次给出书中结论时必须引用段落定位符。",
      "没有来源的内容必须标注为模型建议/一般推断。",
      "空洞回声句子不得伪装成书中结论。",
      "对话期间不得切换 Skill 版本。",
      "不得自动把草稿发布为正式 Skill。",
    ],
    outputSchema: {
      type: "object",
      properties: {
        content: { type: "string" },
        claims: { type: "array" },
      },
    },
    permissions: {
      network: false,
      writeFiles: false,
      modelProvider: "local-stub",
    },
    knowledgeCardIds: [knowledgeCardId],
    now,
  });
}

export function loadSkill(db: DatabaseSync, skillId: string): SkillRecord {
  const row = db
    .prepare(
      `SELECT id, name, domain, purpose, status, current_version_id, created_at, updated_at
       FROM skills WHERE id = ?`,
    )
    .get(skillId) as
    | {
        id: string;
        name: string;
        domain: string;
        purpose: string;
        status: string;
        current_version_id: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`Skill not found: ${skillId}`);
  }
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    purpose: row.purpose,
    status: row.status,
    currentVersionId: row.current_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function loadSkillVersion(db: DatabaseSync, versionId: string): SkillVersionRecord {
  const row = db
    .prepare(
      `SELECT id, skill_id, version, inputs_json, steps_json, rules_json, output_schema_json, permissions_json, created_at
       FROM skill_versions WHERE id = ?`,
    )
    .get(versionId) as
    | {
        id: string;
        skill_id: string;
        version: string;
        inputs_json: string;
        steps_json: string;
        rules_json: string;
        output_schema_json: string;
        permissions_json: string;
        created_at: string;
      }
    | undefined;
  if (!row) {
    throw new Error(`Skill version not found: ${versionId}`);
  }
  const sources = db
    .prepare(`SELECT knowledge_card_id FROM skill_sources WHERE skill_version_id = ? ORDER BY rowid`)
    .all(versionId) as Array<{ knowledge_card_id: string }>;
  return {
    id: row.id,
    skillId: row.skill_id,
    version: row.version,
    inputs: JSON.parse(row.inputs_json) as SkillInputSpec[],
    steps: JSON.parse(row.steps_json),
    rules: JSON.parse(row.rules_json),
    outputSchema: JSON.parse(row.output_schema_json),
    permissions: JSON.parse(row.permissions_json),
    createdAt: row.created_at,
    knowledgeCardIds: sources.map((row) => row.knowledge_card_id),
  };
}

export function listSkills(db: DatabaseSync): SkillRecord[] {
  const rows = db
    .prepare(
      `SELECT id FROM skills
       ORDER BY updated_at DESC, created_at DESC, id`,
    )
    .all() as Array<{ id: string }>;
  return rows.map((row) => loadSkill(db, row.id));
}

export function listSkillVersions(db: DatabaseSync, skillId: string): SkillVersionRecord[] {
  loadSkill(db, skillId);
  const rows = db
    .prepare(
      `SELECT id FROM skill_versions
       WHERE skill_id = ?
       ORDER BY created_at ASC, version ASC, id ASC`,
    )
    .all(skillId) as Array<{ id: string }>;
  return rows.map((row) => loadSkillVersion(db, row.id));
}

export type RollbackSkillToVersionOptions = {
  db: DatabaseSync;
  skillId: string;
  versionId: string;
  now?: Date;
};

export function rollbackSkillToVersion(options: RollbackSkillToVersionOptions): {
  skill: SkillRecord;
  version: SkillVersionRecord;
  rolledBackFrom: SkillVersionRecord;
} {
  const skill = loadSkill(options.db, options.skillId);
  if (!skill.currentVersionId) {
    throw new Error(`Skill ${options.skillId} has no current version to roll back from`);
  }
  const rolledBackFrom = loadSkillVersion(options.db, skill.currentVersionId);
  const target = loadSkillVersion(options.db, options.versionId);
  if (target.skillId !== options.skillId) {
    throw new Error(`Skill version ${options.versionId} does not belong to skill ${options.skillId}`);
  }
  const stamp = nowIso(options.now);
  const versionId = newId();
  const shortId = versionId.replaceAll("-", "").slice(0, 8);
  const version = `${target.version}+rollback-${shortId}`;
  withTransaction(options.db, () => {
    insertVersion(options.db, {
      id: versionId,
      skillId: options.skillId,
      version,
      inputs: target.inputs,
      steps: target.steps,
      rules: target.rules,
      outputSchema: target.outputSchema,
      permissions: target.permissions,
      knowledgeCardIds: target.knowledgeCardIds,
      createdAt: stamp,
    });
    options.db
      .prepare(`UPDATE skills SET current_version_id = ?, status = ?, updated_at = ? WHERE id = ?`)
      .run(versionId, SKILL_STATUS_DRAFT, stamp, options.skillId);
  });
  return {
    skill: loadSkill(options.db, options.skillId),
    version: loadSkillVersion(options.db, versionId),
    rolledBackFrom: loadSkillVersion(options.db, rolledBackFrom.id),
  };
}

export type SkillVersionDiffField =
  | "inputs"
  | "steps"
  | "rules"
  | "outputSchema"
  | "permissions"
  | "knowledgeCardIds";

const SKILL_VERSION_DIFF_FIELDS: readonly SkillVersionDiffField[] = [
  "inputs",
  "steps",
  "rules",
  "outputSchema",
  "permissions",
  "knowledgeCardIds",
];

export function summarizeSkillVersionDiff(
  a: SkillVersionRecord,
  b: SkillVersionRecord,
): SkillVersionDiffField[] {
  return SKILL_VERSION_DIFF_FIELDS.filter((field) => JSON.stringify(a[field]) !== JSON.stringify(b[field]));
}

export type UpdateSkillMetadataOptions = {
  db: DatabaseSync;
  skillId: string;
  name?: string;
  domain?: string;
  purpose?: string;
  now?: Date;
};

export function updateSkillMetadata(options: UpdateSkillMetadataOptions): SkillRecord {
  const existing = loadSkill(options.db, options.skillId);
  const stamp = nowIso(options.now);
  options.db
    .prepare(`UPDATE skills SET name = ?, domain = ?, purpose = ?, updated_at = ? WHERE id = ?`)
    .run(
      options.name ?? existing.name,
      options.domain ?? existing.domain,
      options.purpose ?? existing.purpose,
      stamp,
      options.skillId,
    );
  const updated = loadSkill(options.db, options.skillId);
  if (updated.status !== existing.status) {
    throw new Error("Updating skill metadata must not change its status");
  }
  return updated;
}

export type TransitionSkillStatusOptions = {
  db: DatabaseSync;
  skillId: string;
  status: string;
  now?: Date;
};

/**
 * Explicitly set a skill status. `published` is allowed only because the caller
 * passed `status` directly; create / new-version / rollback paths never do this.
 */
export function transitionSkillStatus(options: TransitionSkillStatusOptions): SkillRecord {
  loadSkill(options.db, options.skillId);
  const stamp = nowIso(options.now);
  options.db
    .prepare(`UPDATE skills SET status = ?, updated_at = ? WHERE id = ?`)
    .run(options.status, stamp, options.skillId);
  return loadSkill(options.db, options.skillId);
}

function insertVersion(
  db: DatabaseSync,
  input: {
    id: string;
    skillId: string;
    version: string;
    inputs: SkillInputSpec[];
    steps: unknown;
    rules: unknown;
    outputSchema: unknown;
    permissions: unknown;
    knowledgeCardIds: string[];
    createdAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO skill_versions(id, skill_id, version, inputs_json, steps_json, rules_json, output_schema_json, permissions_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.id,
    input.skillId,
    input.version,
    JSON.stringify(input.inputs),
    JSON.stringify(input.steps),
    JSON.stringify(input.rules),
    JSON.stringify(input.outputSchema),
    JSON.stringify(input.permissions),
    input.createdAt,
  );
  const insertSource = db.prepare(
    `INSERT INTO skill_sources(id, skill_version_id, knowledge_card_id, step_id) VALUES (?, ?, ?, ?)`,
  );
  for (const cardId of input.knowledgeCardIds) {
    insertSource.run(newId(), input.id, cardId, "cite");
  }
}
