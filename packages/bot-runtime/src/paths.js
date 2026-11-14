import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const PACKAGE_ROOT = path.resolve(here, "..");
export const DEFAULT_REPO_ROOT = path.resolve(PACKAGE_ROOT, "../..");

export function resolvePaths({
  repoRoot = DEFAULT_REPO_ROOT,
  configDir,
  runtimeDir,
  logsDir,
} = {}) {
  const root = path.resolve(repoRoot);
  const config = configDir ? path.resolve(configDir) : path.join(root, ".bookskill");
  return {
    repoRoot: root,
    configDir: config,
    runtimeDir: runtimeDir
      ? path.resolve(runtimeDir)
      : path.join(config, "runtime"),
    logsDir: logsDir ? path.resolve(logsDir) : path.join(config, "logs"),
    rolesFile: path.join(config, "roles.json"),
    toolsFile: path.join(config, "tools.json"),
    budgetFile: path.join(config, "budget.json"),
    stateMachineFile: path.join(config, "state-machine.json"),
  };
}
