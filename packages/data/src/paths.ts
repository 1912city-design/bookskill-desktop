import path from "node:path";
import {
  resolveDataDir,
  type ResolveDataDirOptions,
} from "../../repo-baseline/src/data-dir.ts";
import {
  BUSINESS_DB_DIRNAME,
  BUSINESS_DB_FILENAME,
} from "./constants.ts";

const FORBIDDEN_PATH_MARKERS = ["anythingllm", "anything-llm", "mintplex"];

export type { ResolveDataDirOptions };

/**
 * Resolve the BookSkill business database path.
 *
 * The file always lives under the BookSkill data directory returned by
 * `resolveDataDir()`, never under an AnythingLLM user-data or container path.
 */
export function resolveBusinessDbPath(options: ResolveDataDirOptions = {}): string {
  const dataDir = resolveDataDir(options);
  const pathApi = (options.platform ?? process.platform) === "win32" ? path.win32 : path.posix;
  return pathApi.join(dataDir, BUSINESS_DB_DIRNAME, BUSINESS_DB_FILENAME);
}

/**
 * Reject paths that are not the BookSkill business database, including any
 * AnythingLLM / mintplex location.
 */
export function assertBusinessDbPath(
  dbPath: string,
  options: ResolveDataDirOptions = {},
): void {
  const platform = options.platform ?? process.platform;
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  const resolved =
    platform === "win32" ? path.win32.resolve(dbPath) : path.resolve(dbPath);

  const normalized = resolved.replace(/\\/g, "/").toLowerCase();
  for (const marker of FORBIDDEN_PATH_MARKERS) {
    if (normalized.includes(marker)) {
      throw new Error(
        `BookSkill business database must not use AnythingLLM or related paths: ${resolved}`,
      );
    }
  }

  const expected = resolveBusinessDbPath(options);
  const expectedNormalized = expected.replace(/\\/g, "/");
  const resolvedNormalized = resolved.replace(/\\/g, "/");
  if (pathApi.normalize(resolvedNormalized) !== pathApi.normalize(expectedNormalized)) {
    throw new Error(
      `BookSkill business database must be located at ${expected}, not ${resolved}`,
    );
  }

  if (pathApi.basename(resolved) !== BUSINESS_DB_FILENAME) {
    throw new Error(
      `BookSkill business database filename must be ${BUSINESS_DB_FILENAME}`,
    );
  }
}
