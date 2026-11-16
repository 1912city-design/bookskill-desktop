import { DISTILL_TEMPLATE_ID, LOCKED_SECTION_TITLES, type Distillation, type DistillationValidationResult, type LockedSectionId, DistillationValidationError } from "./types.ts";
import { parseDistillationMarkdown } from "./parse.ts";

export function validateDistillation(input: Distillation | string): DistillationValidationResult {
  const distillation = typeof input === "string" ? parseDistillationMarkdown(input) : input;
  const issues = collectIssues(distillation);
  if (issues.length > 0) {
    return { ok: false, error: new DistillationValidationError(issues) };
  }
  return { ok: true, distillation };
}

export function assertValidDistillation(input: Distillation | string): Distillation {
  const result = validateDistillation(input);
  if (!result.ok) {
    throw result.error;
  }
  return result.distillation;
}

function collectIssues(distillation: Distillation): string[] {
  const issues: string[] = [];
  if (distillation.template_id !== DISTILL_TEMPLATE_ID) {
    issues.push(`template_id must be ${DISTILL_TEMPLATE_ID}`);
  }
  if (!distillation.title.trim()) {
    issues.push("title is required");
  }

  const sections = distillation.sections ?? [];
  if (sections.length !== LOCKED_SECTION_TITLES.length) {
    issues.push(`expected ${LOCKED_SECTION_TITLES.length} locked sections, found ${sections.length}`);
  }

  const seenIds = new Set<number>();
  for (const [offset, expectedTitle] of LOCKED_SECTION_TITLES.entries()) {
    const expectedId = (offset + 1) as LockedSectionId;
    const section = sections.find((item) => Number(item.id) === expectedId);
    if (!section) {
      issues.push(`missing locked section ${expectedId}. ${expectedTitle}`);
      continue;
    }
    if (section.title !== expectedTitle) {
      issues.push(`section ${expectedId} title must be “${expectedTitle}”, found “${section.title}”`);
    }
    if (seenIds.has(section.id)) {
      issues.push(`duplicate section id ${section.id}`);
    }
    seenIds.add(section.id);
  }

  for (const section of sections) {
    const expected = LOCKED_SECTION_TITLES[section.id - 1];
    if (expected && section.title !== expected && !issues.some((issue) => issue.includes(`section ${section.id} title`))) {
      issues.push(`section ${section.id} title must be “${expected}”, found “${section.title}”`);
    }
  }

  const skillSection = sections.find((item) => Number(item.id) === 5);
  if (skillSection) {
    const skills = skillSection.skills ?? [];
    const usable = skills.filter((skill) => skill.name.trim() && (skill.steps.length > 0 || skill.output.trim() || skill.triggers.length > 0));
    if (usable.length === 0 || skills.length === 0) {
      issues.push("section 5 可调用Skill is empty; at least one Skill is required");
    }
  }

  return issues;
}
