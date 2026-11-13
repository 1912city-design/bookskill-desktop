import type { DatabaseSync } from "node:sqlite";
import { DEFAULT_SKILL_NAME } from "./constants.ts";
import { loadSkill, loadSkillVersion } from "./skills.ts";
import type { SkillRecommendation } from "./types.ts";

/**
 * Recommend up to three Skills for a user task. This is a deterministic
 * local matcher, not a network model call.
 */
export function recommendSkills(db: DatabaseSync, task: string): SkillRecommendation[] {
  const rows = db
    .prepare(
      `SELECT id, name, domain, purpose, current_version_id
       FROM skills
       WHERE current_version_id IS NOT NULL
         AND status != 'archived'
       ORDER BY created_at`,
    )
    .all() as Array<{
    id: string;
    name: string;
    domain: string;
    purpose: string;
    current_version_id: string;
  }>;

  const haystack = task.toLowerCase();
  const scored = rows
    .map((row) => {
      let score = 0;
      const reasonParts: string[] = [];
      if (row.name === DEFAULT_SKILL_NAME && /项目复盘|retrospective|复盘/.test(haystack)) {
        score += 5;
        reasonParts.push(`任务提到项目复盘，与 Skill「${row.name}」的用途一致`);
      }
      if (haystack.includes(row.name.toLowerCase())) {
        score += 3;
        reasonParts.push(`任务直接点名了 Skill「${row.name}」`);
      }
      if (haystack.includes(row.domain.toLowerCase())) {
        score += 1;
        reasonParts.push(`任务落在「${row.domain}」领域`);
      }
      if (score === 0) {
        return null;
      }
      return {
        score,
        recommendation: {
          skill: loadSkill(db, row.id),
          version: loadSkillVersion(db, row.current_version_id),
          reason: reasonParts.join("；") + "。",
        } satisfies SkillRecommendation,
      };
    })
    .filter((row): row is { score: number; recommendation: SkillRecommendation } => row !== null);

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((row) => row.recommendation);
}
