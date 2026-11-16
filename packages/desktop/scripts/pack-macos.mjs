/**
 * Unsigned macOS 13+ development pack for BookSkill Desktop (PKG-001).
 *
 * Official electron-builder rule: macOS .dmg / .app packaging must run
 * on macOS. This script exits immediately on non-darwin hosts and does
 * not attempt a Linux cross-compiled or fake .dmg.
 *
 * This is not a signed/notarized official release and does not claim G1.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(desktopRoot, "../..");

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.platform !== "darwin") {
  fail(
    [
      `Cannot produce a macOS .dmg / .app on this host (${process.platform} ${process.arch}).`,
      "",
      "Official electron-builder rule: macOS DMG/.app packaging must run on macOS.",
      "Do not attempt a Linux cross-compiled or fake .dmg.",
      "",
      "Exact missing items on this environment:",
      "- macOS 13+ machine, or a GitHub-hosted macos-14+ runner",
      "- Xcode Command Line Tools (xcodebuild)",
      "- hdiutil (required to create a .dmg)",
      "- iconutil (required to convert resources/icon.png to .icns)",
      "- sw_vers / the macOS SDK",
      "- codesign and notarytool (only required for signed/notarized official builds; not used for this unsigned development sample)",
      "- Apple Developer ID Application certificate and notarization credentials (currently absent; B-003 / P-005). Official signed installers are blocked until these exist and a human approves publish.",
      "- osxcross, darling, and other Linux-side macOS toolchains (not present, and not an accepted substitute)",
      "",
      "Shortest path to an unsigned macOS 13+ development sample:",
      "",
      "  # On a macOS 13+ machine, from the repository root:",
      "  pnpm install --frozen-lockfile",
      "  CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @bookskill/desktop pack:mac",
      "",
      "  # Or dispatch GitHub Actions workflow .github/workflows/macos-dev-build.yml",
      "  # (runs-on: macos-14). Remote success is a development sample only;",
      "  # it is not G1 and not a production publish.",
      "",
      "This command is the unsigned development sample path. It is not an official release.",
    ].join("\n"),
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

// @bookskill/core and @bookskill/data have no separate compile step;
// esbuild bundles their TypeScript from the workspace packages.
run("pnpm", ["--filter", "@bookskill/repo-baseline", "build"]);
run("pnpm", ["--filter", "@bookskill/desktop", "build"]);
run(process.execPath, [path.join(desktopRoot, "scripts/ensure-electron.mjs")], {
  cwd: desktopRoot,
});

const env = {
  ...process.env,
  CSC_IDENTITY_AUTO_DISCOVERY: "false",
};

run(
  "pnpm",
  [
    "exec",
    "electron-builder",
    "--mac",
    "--config",
    "electron-builder.yml",
    "--publish",
    "never",
  ],
  { cwd: desktopRoot, env },
);

console.log("Unsigned macOS 13+ development artifacts written under:");
console.log(path.join(desktopRoot, "out"));
console.log("This is not a signed installer, not a notarized build, not an official release, and not G1.");
