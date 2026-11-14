import { spawnSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

/**
 * pnpm 10 may skip electron's install script until build scripts are approved
 * at the workspace root. This helper downloads the official Electron binary
 * when path.txt / dist/electron is missing, without changing the root package.json.
 */
const require = createRequire(import.meta.url);
const electronPkgDir = path.dirname(require.resolve("electron/package.json"));

try {
  require("electron");
} catch {
  const install = path.join(electronPkgDir, "install.js");
  const result = spawnSync(process.execPath, [install], { stdio: "inherit" });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  require("electron");
}
