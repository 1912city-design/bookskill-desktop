import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  BudgetExceededError,
  RetryExhaustedError,
  TimeoutError,
} from "../src/index.js";
import { resolvePaths } from "../src/paths.js";
import { withRuntime, lowRiskTask } from "./helpers.js";

test("budget.json caps automatic retries at 2 and declares timeouts", async () => {
  const paths = resolvePaths();
  const raw = JSON.parse(await readFile(paths.budgetFile, "utf8"));
  assert.equal(raw.retries.maxAutoRetries, 2);
  assert.ok(raw.timeouts.taskTimeoutMs > 0);
  assert.ok(raw.timeouts.toolTimeoutMs > 0);
  assert.equal(raw.timeouts.heartbeatIntervalMs, 3_600_000);
  assert.equal(raw.budget.maxConcurrentDevelopmentTasks, 6);
});

test("a task may retry at most twice and is BLOCKED on the third failure", async () => {
  await withRuntime(async (runtime) => {
    assert.equal(runtime.budget.maxAutoRetries, 2);
    const task = await runtime.createTask(lowRiskTask({ id: "RETRY-1" }));
    await runtime.transition("RETRY-1", "Ready");
    await runtime.transition("RETRY-1", "In Progress");

    await runtime.recordFailure("RETRY-1", { reason: "first failure" });
    assert.equal(runtime.getTask("RETRY-1").retriesUsed, 1);
    assert.equal(runtime.getTask("RETRY-1").state, "In Progress");

    await runtime.recordFailure("RETRY-1", { reason: "second failure" });
    assert.equal(runtime.getTask("RETRY-1").retriesUsed, 2);
    assert.equal(runtime.getTask("RETRY-1").state, "In Progress");

    await runtime.recordFailure("RETRY-1", { reason: "third failure" });
    assert.equal(runtime.getTask("RETRY-1").retriesUsed, 2);
    assert.equal(runtime.getTask("RETRY-1").state, "BLOCKED");
  });
});

test("a tool call that exceeds toolTimeoutMs is rejected", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "TIME-1" }));
    const started = Date.now() - (runtime.budget.toolTimeoutMs + 1);
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "TIME-1",
          role: "backend_engineer",
          tool: "run_tests",
          toolStartedAt: started,
          now: Date.now(),
        }),
      TimeoutError,
    );
  });
});

test("a task that exceeds taskTimeoutMs is rejected", async () => {
  await withRuntime(async (runtime) => {
    const startedAt = new Date(Date.now() - runtime.budget.taskTimeoutMs - 10).toISOString();
    await runtime.createTask(lowRiskTask({ id: "TIME-2", startedAt, state: "In Progress" }));
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "TIME-2",
          role: "backend_engineer",
          tool: "run_tests",
          now: Date.now(),
        }),
      TimeoutError,
    );
  });
});

test("cost and token budgets are enforced", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(
      lowRiskTask({
        id: "COST-1",
        costUsd: runtime.budget.maxCostUsdPerTask,
        tokens: runtime.budget.maxTokensPerTask,
      }),
    );
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "COST-1",
          role: "backend_engineer",
          tool: "run_tests",
          costUsd: 0.01,
        }),
      BudgetExceededError,
    );
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "COST-1",
          role: "backend_engineer",
          tool: "run_tests",
          tokens: 1,
        }),
      BudgetExceededError,
    );
  });
});

test("starting more than six in-flight development tasks is rejected", async () => {
  await withRuntime(async (runtime) => {
    for (let i = 1; i <= 6; i += 1) {
      await runtime.createTask(lowRiskTask({ id: `CONCUR-${i}` }));
      await runtime.transition(`CONCUR-${i}`, "Ready");
      await runtime.transition(`CONCUR-${i}`, "In Progress");
    }
    await runtime.createTask(lowRiskTask({ id: "CONCUR-7" }));
    await runtime.transition("CONCUR-7", "Ready");
    await assert.rejects(
      () => runtime.transition("CONCUR-7", "In Progress"),
      BudgetExceededError,
    );
  });
});
