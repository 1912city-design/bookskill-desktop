import { readFile } from "node:fs/promises";

export async function loadJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function loadConfigs(paths) {
  const [roles, tools, budget, stateMachine] = await Promise.all([
    loadJson(paths.rolesFile),
    loadJson(paths.toolsFile),
    loadJson(paths.budgetFile),
    loadJson(paths.stateMachineFile),
  ]);
  return { roles, tools, budget, stateMachine };
}
