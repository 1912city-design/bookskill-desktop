import type { DatabaseSync } from "node:sqlite";
import { SKILL_STATUS_DRAFT, SKILL_STATUS_PUBLISHED } from "../constants.ts";
import { createSkill, loadSkill, loadSkillVersion } from "../skills.ts";
import type { SkillRecord, SkillVersionRecord } from "../types.ts";
import type { Distillation, DistillationSkill } from "./types.ts";
import { DistillationValidationError } from "./types.ts";

export const MAX_IMPORTED_SKILLS = 3;

export type CreatedDraftSkill = {
  skill: SkillRecord;
  version: SkillVersionRecord;
  extracted: DistillationSkill;
};

export function extractDistillationSkills(distillation: Distillation): DistillationSkill[] {
  const section = distillation.sections.find((item) => Number(item.id) === 5);
  return (section?.skills ?? []).filter((skill) => skill.name.trim());
}

export function createDraftSkillsFromDistillation(options: {
  db: DatabaseSync;
  distillation: Distillation;
  now?: Date;
  limit?: number;
}): CreatedDraftSkill[] {
  const extracted = extractDistillationSkills(options.distillation).slice(0, options.limit ?? MAX_IMPORTED_SKILLS);
  if (extracted.length === 0) {
    throw new DistillationValidationError(["section 5 可调用Skill is empty; at least one Skill is required"]);
  }

  const created: CreatedDraftSkill[] = [];
  for (const skill of extracted) {
    const result = createSkill({
      db: options.db,
      name: skill.name,
      domain: options.distillation.title || "蒸馏",
      purpose: skill.triggers[0] || `从《${options.distillation.title}》第 5 段提取的可调用 Skill`,
      status: SKILL_STATUS_DRAFT,
      inputs: [],
      steps: skill.steps.map((text, index) => ({ id: `step-${index + 1}`, text })),
      rules: [
        "不得自动把草稿发布为正式 Skill。",
        "没有确认的出处必须标注为来源定位未确认，不得伪造精确段落定位。",
      ],
      outputSchema: {
        type: "object",
        properties: {
          content: { type: "string" },
          output: { type: "string" },
        },
        description: skill.output,
      },
      permissions: {
        network: false,
        writeFiles: false,
        modelProvider: "none",
        whenToUse: skill.triggers[0] ?? "",
      },
      now: options.now,
    });
    if (result.skill.status === SKILL_STATUS_PUBLISHED) {
      throw new Error(`Refusing to keep auto-published Skill: ${result.skill.id}`);
    }
    created.push({ skill: result.skill, version: result.version, extracted: skill });
  }
  return created;
}

export function exportStandaloneSkillMarkdown(skill: DistillationSkill, status = SKILL_STATUS_DRAFT): string {
  const lines = [
    `# ${skill.name}`,
    "",
    `- 状态：${status}`,
    "",
    "## 触发条件",
    "",
    ...skill.triggers.map((item) => `- ${item}`),
    "",
    "## 执行步骤",
    "",
    ...skill.steps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "## 输出要求",
    "",
    skill.output,
    "",
  ];
  return lines.join("\n").trim() + "\n";
}

export function exportStandaloneSkillJson(skill: DistillationSkill, status = SKILL_STATUS_DRAFT): string {
  return `${JSON.stringify({ name: skill.name, triggers: skill.triggers, steps: skill.steps, output: skill.output, status }, null, 2)}\n`;
}

export function loadCreatedSkill(db: DatabaseSync, skillId: string): { skill: SkillRecord; version: SkillVersionRecord | null } {
  const skill = loadSkill(db, skillId);
  const version = skill.currentVersionId ? loadSkillVersion(db, skill.currentVersionId) : null;
  return { skill, version };
}
