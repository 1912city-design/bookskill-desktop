import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DeniedToolError,
  UnauthorizedToolError,
  createRuntime,
} from "../src/index.js";
import { resolvePaths } from "../src/paths.js";
import { withRuntime, readAudit, lowRiskTask } from "./helpers.js";

const EXPLICIT_DENY = [
  "merge_main",
  "production_release",
  "read_production_secrets",
  "delete_production_data",
];

const DENY_ALIASES = {
  合并主分支: "merge_main",
  merge_to_main: "merge_main",
  发布生产: "production_release",
  publish_production: "production_release",
  读取生产密钥: "read_production_secrets",
  删除线上数据: "delete_production_data",
  push_to_main: "push_main",
};

test("tools.json explicitly denies merge main, production release, reading production secrets, and deleting production data", async () => {
  const paths = resolvePaths();
  const raw = JSON.parse(await readFile(paths.toolsFile, "utf8"));
  const denied = new Set(raw.denied.map((tool) => tool.id));
  const allowed = new Set(raw.allowed.map((tool) => tool.id));
  for (const id of EXPLICIT_DENY) {
    assert.ok(denied.has(id), `missing denied tool ${id}`);
    assert.ok(!allowed.has(id), `${id} must not be allowlisted`);
  }
});

test("invoking a denied tool fails and is written to the audit log", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "DENY-1" }));
    for (const tool of EXPLICIT_DENY) {
      await assert.rejects(
        () =>
          runtime.invoke({
            taskId: "DENY-1",
            role: "backend_engineer",
            tool,
          }),
        DeniedToolError,
      );
    }
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "DENY-1",
          role: "release_engineer",
          tool: "production_release",
        }),
      DeniedToolError,
    );

    const entries = await readAudit(runtime);
    const denied = entries.filter((entry) => entry.result === "DENIED_TOOL");
    assert.ok(denied.length >= EXPLICIT_DENY.length + 1);
    for (const entry of denied) {
      assert.ok(entry.taskId);
      assert.ok(entry.role);
      assert.ok(entry.action);
      assert.ok(entry.timestamp);
      assert.equal(entry.result, "DENIED_TOOL");
    }
  });
});

test("denied aliases also fail", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "DENY-ALIAS" }));
    for (const [alias, canonical] of Object.entries(DENY_ALIASES)) {
      await assert.rejects(
        () =>
          runtime.invoke({
            taskId: "DENY-ALIAS",
            role: "backend_engineer",
            tool: alias,
          }),
        (error) => error instanceof DeniedToolError && error.tool === canonical,
      );
    }
  });
});

test("orchestrator cannot invoke merge or modify_branch_files tools", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "ORCH-1", assigneeRole: "orchestrator" }));
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "ORCH-1",
          role: "orchestrator",
          tool: "merge_main",
        }),
      DeniedToolError,
    );
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "ORCH-1",
          role: "orchestrator",
          tool: "modify_branch_files",
          args: { path: "packages/bot-runtime/src/index.js" },
        }),
      UnauthorizedToolError,
    );
  });
});

test("product cannot write technical decisions", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "PROD-1", assigneeRole: "product" }));
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "PROD-1",
          role: "product",
          tool: "write_technical_decision",
        }),
      UnauthorizedToolError,
    );
  });
});

test("unknown tools are rejected fail-closed", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "UNK-TOOL" }));
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "UNK-TOOL",
          role: "backend_engineer",
          tool: "shell_as_root",
        }),
      DeniedToolError,
    );
  });
});

test("an allowlisted tool still succeeds for a permitted role", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "OK-1" }));
    const result = await runtime.invoke({
      taskId: "OK-1",
      role: "backend_engineer",
      tool: "run_tests",
      args: { command: "node --test" },
    });
    assert.equal(result.ok, true);
    assert.equal(result.tool, "run_tests");
  });
});
