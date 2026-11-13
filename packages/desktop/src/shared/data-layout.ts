import fs from "node:fs";
import path from "node:path";
import {
  resolveDataDir,
  type ResolveDataDirOptions,
} from "@bookskill/repo-baseline";
import { PRODUCT_NAME, PRODUCT_VERSION } from "./product.ts";

export const DATA_LAYOUT_SCHEMA = "bookskill-desktop-app-001";

export const DATA_SUBDIRECTORIES = [
  "conversations",
  "library",
  "knowledge",
  "skills",
  "settings",
  "logs",
] as const;

export const LAYOUT_MANIFEST_NAME = "layout.json";

export type DataLayoutManifest = {
  product: typeof PRODUCT_NAME;
  schema: typeof DATA_LAYOUT_SCHEMA;
  version: string;
  createdAt: string;
};

export type InitializeDataDirOptions = ResolveDataDirOptions & {
  now?: Date;
};

export type InitializeDataDirResult = {
  dataDir: string;
  created: boolean;
  directories: string[];
  manifestPath: string;
};

/**
 * Resolve the BookSkill data directory and create the first-launch layout.
 * Uses the same path rules as `@bookskill/repo-baseline` `resolveDataDir()`,
 * including rejection of AnythingLLM / Mintplex user-data paths.
 */
export function initializeDataDir(
  options: InitializeDataDirOptions = {},
): InitializeDataDirResult {
  const dataDir = resolveDataDir(options);
  const existed = fs.existsSync(dataDir);
  fs.mkdirSync(dataDir, { recursive: true });

  const directories: string[] = [];
  for (const name of DATA_SUBDIRECTORIES) {
    const dir = path.join(dataDir, name);
    fs.mkdirSync(dir, { recursive: true });
    directories.push(dir);
  }

  const manifestPath = path.join(dataDir, LAYOUT_MANIFEST_NAME);
  let created = !existed;
  if (!fs.existsSync(manifestPath)) {
    const manifest: DataLayoutManifest = {
      product: PRODUCT_NAME,
      schema: DATA_LAYOUT_SCHEMA,
      version: PRODUCT_VERSION,
      createdAt: (options.now ?? new Date()).toISOString(),
    };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    created = true;
  }

  return { dataDir, created, directories, manifestPath };
}
