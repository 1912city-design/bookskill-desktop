import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openSliceWorkspace, type SliceWorkspace } from "../src/index.ts";

export const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures",
);

export const PDF_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.pdf");
export const EPUB_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.epub");

export type TempWorkspace = {
  dataDir: string;
  env: NodeJS.ProcessEnv;
  open(): SliceWorkspace;
  cleanup(): void;
};

export function createTempWorkspace(): TempWorkspace {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-vert-"));
  const env = { BOOKSKILL_DATA_DIR: dataDir };
  return {
    dataDir,
    env,
    open() {
      return openSliceWorkspace({ env, platform: "linux" });
    },
    cleanup() {
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}
