import os from "node:os";
import path from "node:path";

/** Product data folder name on Windows and macOS. */
export const PRODUCT_DATA_DIR_NAME = "BookSkill Desktop";

/** Product data folder name on Linux / XDG. */
export const PRODUCT_DATA_DIR_NAME_UNIX = "bookskill-desktop";

const FORBIDDEN_PATH_MARKERS = ["anythingllm", "anything-llm", "mintplex"];

export type ResolveDataDirOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
};

/**
 * Resolve the BookSkill Desktop local data directory.
 *
 * The path is product-specific. It must not point at AnythingLLM official
 * desktop data directories or at the previously running official container.
 * An explicit BOOKSKILL_DATA_DIR override is also rejected if it contains
 * those names.
 */
export function resolveDataDir(options: ResolveDataDirOptions = {}): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homedir = options.homedir ?? os.homedir();
  const pathApi = platform === "win32" ? path.win32 : path.posix;

  const override = env.BOOKSKILL_DATA_DIR?.trim();
  if (override) {
    const resolved =
      platform === "win32" ? path.win32.resolve(override) : path.resolve(override);
    assertBookSkillDataPath(resolved);
    return resolved;
  }

  let dir: string;
  if (platform === "win32") {
    const appData = env.APPDATA?.trim() || pathApi.join(homedir, "AppData", "Roaming");
    dir = pathApi.join(appData, PRODUCT_DATA_DIR_NAME);
  } else if (platform === "darwin") {
    dir = pathApi.join(homedir, "Library", "Application Support", PRODUCT_DATA_DIR_NAME);
  } else {
    const xdg = env.XDG_DATA_HOME?.trim() || pathApi.join(homedir, ".local", "share");
    dir = pathApi.join(xdg, PRODUCT_DATA_DIR_NAME_UNIX);
  }

  assertBookSkillDataPath(dir);
  return dir;
}

function assertBookSkillDataPath(dir: string): void {
  const normalized = dir.replace(/\\/g, "/").toLowerCase();
  for (const marker of FORBIDDEN_PATH_MARKERS) {
    if (normalized.includes(marker)) {
      throw new Error(
        `BookSkill data directory must not use AnythingLLM or related paths: ${dir}`,
      );
    }
  }
}
