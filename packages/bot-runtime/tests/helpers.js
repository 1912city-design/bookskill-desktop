import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRuntime } from "../src/index.js";

export async function withRuntime(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "bot-runtime-"));
  const runtime = await createRuntime({
    runtimeDir: path.join(dir, "runtime"),
    logsDir: path.join(dir, "logs"),
    ...options,
  });
  try {
    return await fn(runtime, dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function readAudit(runtime) {
  const raw = await readFile(runtime.audit.filePath, "utf8");
  return raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

export async function readAuditText(runtime) {
  return readFile(runtime.audit.filePath, "utf8");
}

export function lowRiskTask(overrides = {}) {
  return {
    id: overrides.id ?? "TASK-LOW",
    acceptanceCriteria: ["unit tests pass"],
    risk: "medium",
    riskCategories: [],
    assigneeRole: "backend_engineer",
    ...overrides,
  };
}

export function highRiskTask(overrides = {}) {
  return {
    id: overrides.id ?? "TASK-HIGH",
    acceptanceCriteria: ["human approval recorded"],
    risk: "high",
    riskCategories: overrides.riskCategories ?? ["release"],
    assigneeRole: "release_engineer",
    ...overrides,
  };
}

export async function walkTo(runtime, taskId, target, context = {}) {
  const sequence = [
    ["Backlog", "Ready", {}],
    ["Ready", "In Progress", {}],
    ["In Progress", "Pull Request", {}],
    ["Pull Request", "CI", {}],
    ["CI", "Independent QA", { ciPassed: true }],
  ];

  const task = runtime.getTask(taskId);
  for (const [from, to, extra] of sequence) {
    if (task.state === target) return task;
    if (task.state === from) {
      await runtime.transition(taskId, to, { ...extra, ...context });
    }
  }
  return runtime.getTask(taskId);
}
