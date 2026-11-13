import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  DeniedToolError,
  RemoteBlockedError,
  UnknownRoleError,
} from "../src/index.js";
import { PACKAGE_ROOT } from "../src/paths.js";
import { withRuntime, readAudit, lowRiskTask } from "./helpers.js";

const SRC_DIR = path.join(PACKAGE_ROOT, "src");

async function readAllSource() {
  const files = await readdir(SRC_DIR);
  const jsFiles = files.filter((name) => name.endsWith(".js"));
  const chunks = [];
  for (const name of jsFiles) {
    chunks.push(await readFile(path.join(SRC_DIR, name), "utf8"));
  }
  return chunks.join("\n");
}

test("runtime source does not implement a usable merge-main or production-release path", async () => {
  const source = await readAllSource();
  assert.equal(source.includes("child_process"), false);
  assert.equal(/\bspawn(?:Sync)?\s*\(/.test(source), false);
  assert.equal(/\bexec(?:File|Sync)?\s*\(/.test(source), false);
  assert.doesNotMatch(source, /git\s+(merge|push|checkout)\s+main/);
  assert.doesNotMatch(source, /gh\s+pr\s+merge/);
  assert.doesNotMatch(source, /gh\s+release\s+create/);

  const { createExecutor } = await import("../src/executor.js");
  assert.equal(typeof createExecutor({}).mergeMain, "undefined");
  assert.equal(typeof createExecutor({}).publishProduction, "undefined");
  assert.equal(typeof createExecutor({}).productionRelease, "undefined");
});

test("create_pull_request and read_ci_results are permission-allowed but BLOCKED when the remote is disconnected", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "REMOTE-1" }));
    runtime.assertToolAllowed("backend_engineer", "create_pull_request");
    runtime.assertToolAllowed("backend_engineer", "read_ci_results");

    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "REMOTE-1",
          role: "backend_engineer",
          tool: "create_pull_request",
          args: { title: "BOT-001" },
        }),
      (error) =>
        error instanceof RemoteBlockedError &&
        error.code === "REMOTE_BLOCKED" &&
        /B-001/.test(error.message) &&
        /B-007/.test(error.message),
    );
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "REMOTE-1",
          role: "backend_engineer",
          tool: "read_ci_results",
        }),
      RemoteBlockedError,
    );

    const entries = await readAudit(runtime);
    const blocked = entries.filter((entry) => entry.result === "REMOTE_BLOCKED");
    assert.equal(blocked.length, 2);
    assert.ok(blocked.every((entry) => entry.taskId === "REMOTE-1"));
  });
});

test("unknown roles cannot invoke tools", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "ROLE-X" }));
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "ROLE-X",
          role: "蒸馏 Manager",
          tool: "run_tests",
        }),
      UnknownRoleError,
    );
    const entries = await readAudit(runtime);
    assert.ok(entries.some((entry) => entry.result === "UNKNOWN_ROLE"));
  });
});

test("denied production tools never return a successful result", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "NO-PATH" }));
    const tools = [
      "merge_main",
      "push_main",
      "merge_own_pr",
      "production_release",
      "read_production_secrets",
      "delete_production_data",
    ];
    for (const role of runtime.contractRoles) {
      for (const tool of tools) {
        const result = await runtime
          .invoke({ taskId: "NO-PATH", role, tool })
          .then((value) => ({ ok: true, value }))
          .catch((error) => ({ ok: false, error }));
        assert.equal(result.ok, false, `${role} must not succeed at ${tool}`);
        assert.equal(result.error instanceof DeniedToolError, true);
      }
    }
  });
});
