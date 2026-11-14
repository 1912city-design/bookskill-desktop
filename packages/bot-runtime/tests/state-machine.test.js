import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { IllegalTransitionError, UnknownRoleError } from "../src/index.js";
import { resolvePaths } from "../src/paths.js";
import {
  withRuntime,
  lowRiskTask,
  highRiskTask,
  walkTo,
} from "./helpers.js";

test("state-machine.json covers the contract states", async () => {
  const paths = resolvePaths();
  const raw = JSON.parse(await readFile(paths.stateMachineFile, "utf8"));
  for (const state of [
    "Backlog",
    "Ready",
    "In Progress",
    "Pull Request",
    "CI",
    "Independent QA",
    "Auto-merge to integration",
    "Human Approval",
    "Done",
  ]) {
    assert.ok(raw.states.includes(state), `missing state ${state}`);
  }
  for (const category of [
    "data_migration",
    "authorization",
    "sync_encryption",
    "external_operations",
    "release",
  ]) {
    assert.ok(raw.highRiskCategories.includes(category), `missing high-risk category ${category}`);
  }
});

test("a low or medium risk ticket can follow the legal happy path through auto-merge to Done", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "SM-LOW", risk: "low" }));
    await walkTo(runtime, "SM-LOW", "Independent QA");
    const afterQa = runtime.getTask("SM-LOW");
    assert.equal(afterQa.state, "Independent QA");
    await runtime.transition("SM-LOW", "Auto-merge to integration", {
      qaPassed: true,
      actorRole: "qa_security",
    });
    await runtime.transition("SM-LOW", "Done");
    assert.equal(runtime.getTask("SM-LOW").state, "Done");
  });
});

test("a high-risk ticket cannot auto-merge and must go through Human Approval", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(
      highRiskTask({
        id: "SM-HIGH",
        riskCategories: ["data_migration"],
      }),
    );
    await walkTo(runtime, "SM-HIGH", "Independent QA");
    await assert.rejects(
      () =>
        runtime.transition("SM-HIGH", "Auto-merge to integration", {
          qaPassed: true,
          actorRole: "qa_security",
        }),
      (error) =>
        error instanceof IllegalTransitionError &&
        /High-risk|lowOrMediumRisk/.test(error.message),
    );
    await runtime.transition("SM-HIGH", "Human Approval", {
      qaPassed: true,
      actorRole: "qa_security",
    });
    await runtime.transition("SM-HIGH", "Done", { humanApproved: true });
    assert.equal(runtime.getTask("SM-HIGH").state, "Done");
  });
});

test("each high-risk category is treated as high risk even if the risk field says medium", async () => {
  await withRuntime(async (runtime) => {
    for (const category of runtime.stateMachine.highRiskCategories) {
      const id = `RISK-${category}`;
      await runtime.createTask(
        lowRiskTask({
          id,
          risk: "medium",
          riskCategories: [category],
        }),
      );
      assert.equal(runtime.isHighRisk(runtime.getTask(id)), true);
    }
  });
});

test("Backlog cannot become Ready without acceptance criteria", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask({ id: "SM-NO-AC", acceptanceCriteria: [] });
    await assert.rejects(
      () => runtime.transition("SM-NO-AC", "Ready"),
      (error) =>
        error instanceof IllegalTransitionError &&
        /acceptanceCriteria/.test(error.message),
    );
  });
});

test("illegal transitions are rejected", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "SM-ILLEGAL" }));
    await assert.rejects(
      () => runtime.transition("SM-ILLEGAL", "Done"),
      IllegalTransitionError,
    );
    await runtime.transition("SM-ILLEGAL", "Ready");
    await assert.rejects(
      () => runtime.transition("SM-ILLEGAL", "CI"),
      IllegalTransitionError,
    );
    await runtime.transition("SM-ILLEGAL", "In Progress");
    await assert.rejects(
      () => runtime.transition("SM-ILLEGAL", "Independent QA"),
      IllegalTransitionError,
    );
  });
});

test("orchestrator cannot transition a ticket into Auto-merge to integration", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "SM-ORCH" }));
    await walkTo(runtime, "SM-ORCH", "Independent QA");
    await assert.rejects(
      () =>
        runtime.transition("SM-ORCH", "Auto-merge to integration", {
          qaPassed: true,
          actorRole: "orchestrator",
        }),
      (error) =>
        error instanceof IllegalTransitionError &&
        /orchestrator must not merge code/.test(error.message),
    );
  });
});

test("task state is persisted and reloaded", async () => {
  await withRuntime(async (runtime, dir) => {
    await runtime.createTask(lowRiskTask({ id: "SM-PERSIST" }));
    await runtime.transition("SM-PERSIST", "Ready");
    await runtime.transition("SM-PERSIST", "In Progress");
    const storeFile = runtime.store.filePath;

    const { createRuntime } = await import("../src/index.js");
    const reloaded = await createRuntime({
      runtimeDir: path.join(dir, "runtime"),
      logsDir: path.join(dir, "logs-reload"),
      storeFile,
    });
    assert.equal(reloaded.getTask("SM-PERSIST").state, "In Progress");
    assert.ok(reloaded.getTask("SM-PERSIST").startedAt);
  });
});
