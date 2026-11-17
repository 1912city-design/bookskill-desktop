/**
 * Windows 11 x64 pack entry for BookSkill Desktop (PKG-001).
 *
 * Windows installers must be produced on Windows (or a windows-2022+
 * GitHub Actions runner). This script exits immediately on non-win32
 * hosts and does not attempt a Wine or Linux substitute.
 *
 * Signing certificates are not configured (B-003). This is not an
 * official signed release and does not claim G1.
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

if (process.platform !== "win32") {
  fail(
    [
      `Cannot produce a Windows 11 x64 installer on this host (${process.platform} ${process.arch}).`,
      "",
      "Windows NSIS / zip packaging must run on Windows 11 x64, or on a GitHub-hosted windows-2022+ runner.",
      "Do not use Wine or a Linux substitute for a V1 Windows sample.",
      "",
      "Exact missing items on this environment:",
      "- Windows 11 x64 machine, or a GitHub-hosted windows-2022+ runner",
      "- Windows code-signing certificate (currently absent; B-003 / P-005). Official signed installers are blocked until this exists and a human approves publish.",
      "",
      "On a Windows 11 x64 machine, from the repository root:",
      "  pnpm install --frozen-lockfile",
      "  pnpm --filter @bookskill/desktop pack:win",
      "",
      "This command is an unsigned packaging path. It is not an official release and does not claim G1.",
    ].join("\n"),
  );
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    cwd: options.cwd ?? workspaceRoot,
    env: options.env ?? process.env,
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

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
    "--win",
    "--config",
    "electron-builder.yml",
    "--publish",
    "never",
  ],
  { cwd: desktopRoot, env },
);

console.log("Unsigned Windows 11 x64 development artifacts written under:");
console.log(path.join(desktopRoot, "out"));
console.log("This is not a signed installer, not an official release, and not G1.");
