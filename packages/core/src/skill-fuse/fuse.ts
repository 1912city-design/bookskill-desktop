import { DEFAULT_SKILL_VERSION, SKILL_STATUS_DRAFT, SKILL_STATUS_PUBLISHED, SKILL_STATUS_TESTED } from "../constants.ts";
import { createSkill, loadSkill, loadSkillVersion } from "../skills.ts";
import type { SkillInputSpec, SkillRecord, SkillVersionRecord } from "../types.ts";
import type { FuseSkillsOptions, FuseSkillsResult } from "./types.ts";

const FUSION_RULE = "本 Skill 由两个已有 Skill 融合而成，当前为草稿，不得自动发布。";

export function fuseSkills(options: FuseSkillsOptions): FuseSkillsResult {
  if (options.leftSkillId === options.rightSkillId) {
    throw new Error("Cannot fuse a Skill with itself");
  }

  const leftSkill = loadSkill(options.db, options.leftSkillId);
  const rightSkill = loadSkill(options.db, options.rightSkillId);
  const leftVersion = resolveVersion(options.db, leftSkill, options.leftVersionId, "left");
  const rightVersion = resolveVersion(options.db, rightSkill, options.rightVersionId, "right");

  const created = createSkill({
    db: options.db,
    name: resolveName(options.name, leftSkill, rightSkill),
    domain: mergeDomain(leftSkill.domain, rightSkill.domain),
    purpose: mergePurpose(leftSkill, rightSkill),
    status: SKILL_STATUS_DRAFT,
    version: DEFAULT_SKILL_VERSION,
    inputs: mergeInputs(leftVersion.inputs, rightVersion.inputs),
    steps: mergeSteps(leftVersion.steps, rightVersion.steps),
    rules: mergeRules(leftVersion.rules, rightVersion.rules),
    outputSchema: mergeOutputSchema(leftVersion.outputSchema, rightVersion.outputSchema),
    permissions: mergePermissions(leftVersion.permissions, rightVersion.permissions),
    knowledgeCardIds: mergeKnowledgeCardIds(leftVersion.knowledgeCardIds, rightVersion.knowledgeCardIds),
    now: options.now,
  });

  if (created.skill.status !== SKILL_STATUS_DRAFT) {
    throw new Error("Fusion must produce a draft Skill and must not write published or tested status");
  }
  if (created.skill.id === leftSkill.id || created.skill.id === rightSkill.id) {
    throw new Error("Fusion must append a new Skill, not rewrite an existing one");
  }

  return {
    skill: created.skill,
    version: created.version,
    leftSkill: loadSkill(options.db, leftSkill.id),
    rightSkill: loadSkill(options.db, rightSkill.id),
    leftVersion: loadSkillVersion(options.db, leftVersion.id),
    rightVersion: loadSkillVersion(options.db, rightVersion.id),
  };
}

function resolveVersion(
  db: FuseSkillsOptions["db"],
  skill: SkillRecord,
  requestedVersionId: string | undefined,
  side: "left" | "right",
): SkillVersionRecord {
  const versionId = requestedVersionId ?? skill.currentVersionId;
  if (!versionId) {
    throw new Error(`Skill ${skill.id} has no current version to fuse`);
  }
  const version = loadSkillVersion(db, versionId);
  if (version.skillId !== skill.id) {
    throw new Error(`Skill version ${versionId} does not belong to the ${side} Skill ${skill.id}`);
  }
  return version;
}

function resolveName(name: string | undefined, left: SkillRecord, right: SkillRecord): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : `融合：${left.name} + ${right.name}`;
}

function mergeDomain(left: string, right: string): string {
  return left === right ? left : `${left} / ${right}`;
}

function mergePurpose(left: SkillRecord, right: SkillRecord): string {
  return `融合自「${left.name}」与「${right.name}」。\n${left.purpose}\n${right.purpose}`;
}

function mergeInputs(left: SkillInputSpec[], right: SkillInputSpec[]): SkillInputSpec[] {
  const byName = new Map<string, SkillInputSpec>();
  for (const input of [...left, ...right]) {
    const existing = byName.get(input.name);
    if (!existing) {
      byName.set(input.name, {
        name: input.name,
        required: input.required,
        description: input.description,
      });
      continue;
    }
    byName.set(input.name, {
      name: input.name,
      required: existing.required || input.required,
      description:
        existing.description === input.description
          ? existing.description
          : `${existing.description} / ${input.description}`,
    });
  }
  return [...byName.values()];
}

function mergeSteps(left: unknown, right: unknown): unknown[] {
  const usedIds = new Set<string>();
  const merged: unknown[] = [];
  for (const step of asList(left)) {
    merged.push(withUniqueStepId(step, usedIds, "left"));
  }
  for (const step of asList(right)) {
    merged.push(withUniqueStepId(step, usedIds, "right"));
  }
  return merged;
}

function withUniqueStepId(step: unknown, usedIds: Set<string>, side: "left" | "right"): unknown {
  if (!step || typeof step !== "object" || Array.isArray(step)) {
    return step;
  }
  const record = step as Record<string, unknown>;
  const rawId = record.id;
  if (typeof rawId !== "string" || rawId.length === 0) {
    return step;
  }
  let id = rawId;
  if (usedIds.has(id)) {
    id = `${side}-${rawId}`;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${side}-${rawId}-${suffix}`;
      suffix += 1;
    }
  }
  usedIds.add(id);
  return id === rawId ? step : { ...record, id };
}

function mergeRules(left: unknown, right: unknown): unknown[] {
  const merged: unknown[] = [];
  const seen = new Set<string>();
  for (const rule of [...asList(left), ...asList(right), FUSION_RULE]) {
    const key = JSON.stringify(rule);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(rule);
  }
  return merged;
}

function mergeOutputSchema(left: unknown, right: unknown): unknown {
  const leftObject = asSchemaObject(left);
  const rightObject = asSchemaObject(right);
  if (leftObject && rightObject) {
    const properties = {
      ...(isPlainObject(leftObject.properties) ? leftObject.properties : {}),
      ...(isPlainObject(rightObject.properties) ? rightObject.properties : {}),
    };
    const required = uniqueStrings([...asStringList(leftObject.required), ...asStringList(rightObject.required)]);
    return {
      type: "object",
      ...leftObject,
      ...rightObject,
      properties,
      ...(required.length > 0 ? { required } : {}),
    };
  }
  if (leftObject) {
    return left;
  }
  if (rightObject) {
    return right;
  }
  if (JSON.stringify(left) === JSON.stringify(right)) {
    return left ?? { type: "object" };
  }
  return {
    type: "object",
    properties: {
      left,
      right,
    },
  };
}

function mergePermissions(left: unknown, right: unknown): Record<string, unknown> {
  const leftObject = isPlainObject(left) ? left : {};
  const rightObject = isPlainObject(right) ? right : {};
  const merged: Record<string, unknown> = { ...leftObject, ...rightObject };
  merged.network = leftObject.network === true && rightObject.network === true;
  merged.writeFiles = leftObject.writeFiles === true && rightObject.writeFiles === true;
  return merged;
}

function mergeKnowledgeCardIds(left: string[], right: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const id of [...left, ...right]) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function asList(value: unknown): unknown[] {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function asStringList(value: unknown): string[] {
  return asList(value).filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    result.push(value);
  }
  return result;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asSchemaObject(value: unknown): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    return null;
  }
  if (value.type !== "object" && value.type !== undefined) {
    return null;
  }
  return value;
}
