#!/usr/bin/env node
/**
 * Static check that the CI workflow fails the job when unit tests fail.
 * This is a local/static stand-in for `act` / GitHub Actions
 * (the publish repo is not connected, so remote CI is not claimed green).
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(root, ".github", "workflows", "ci.yml");

function fail(message) {
  console.error(`validate-ci-workflow: ${message}`);
  process.exit(1);
}

if (!fs.existsSync(workflowPath)) {
  fail(`missing workflow file: ${workflowPath}`);
}

const source = fs.readFileSync(workflowPath, "utf8");
const lines = source.split(/\r?\n/);

const runIndexes = [];
for (let i = 0; i < lines.length; i += 1) {
  if (/^\s+run:\s+pnpm test\s*$/.test(lines[i])) {
    runIndexes.push(i);
  }
}
if (runIndexes.length === 0) {
  fail("CI workflow has no step that runs `pnpm test`");
}

function stepBlockFor(runIndex) {
  let start = runIndex;
  while (start > 0 && !/^\s+-\s+name:/.test(lines[start])) {
    start -= 1;
  }
  const block = [];
  for (let i = start; i < lines.length; i += 1) {
    if (i > start && /^\s+-\s+name:/.test(lines[i])) break;
    block.push(lines[i]);
  }
  return block.join("\n");
}

for (const runIndex of runIndexes) {
  const block = stepBlockFor(runIndex);
  if (/continue-on-error:\s*true/.test(block)) {
    fail("A `pnpm test` step sets continue-on-error: true, so a test failure would not fail the job");
  }
}

console.log(
  "validate-ci-workflow: OK: a Test step runs `pnpm test` and will fail the job on a non-zero exit.",
);
