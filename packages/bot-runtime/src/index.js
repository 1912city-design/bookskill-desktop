import path from "node:path";
import { loadConfigs } from "./config.js";
import { resolvePaths } from "./paths.js";
import { buildRoleCatalog, assertKnownRole, CONTRACT_ROLES } from "./roles.js";
import { buildToolCatalog, assertToolAllowed } from "./tools.js";
import {
  buildBudget,
  assertConcurrencyAvailable,
  nextRetryCount,
  isRetriesExhausted,
} from "./budget.js";
import { buildStateMachine, assertTransition, isHighRisk } from "./state-machine.js";
import { createStore } from "./store.js";
import { createAuditLog } from "./audit.js";
import { createRemoteAdapter } from "./remote.js";
import { createExecutor } from "./executor.js";
import { IllegalTransitionError, ValidationError } from "./errors.js";

export { CONTRACT_ROLES } from "./roles.js";
export { REDACTED, redact, containsPlaintextSecret } from "./redact.js";
export {
  UnknownRoleError,
  DeniedToolError,
  UnauthorizedToolError,
  IllegalTransitionError,
  BudgetExceededError,
  TimeoutError,
  RetryExhaustedError,
  RemoteBlockedError,
  ValidationError,
} from "./errors.js";

export async function createRuntime(options = {}) {
  const paths = resolvePaths(options);
  const configs = await loadConfigs(paths);
  const roles = buildRoleCatalog(configs.roles);
  const tools = buildToolCatalog(configs.tools);
  const budget = buildBudget(configs.budget);
  const stateMachine = buildStateMachine(configs.stateMachine);
  const store = createStore({
    filePath: options.storeFile ?? path.join(paths.runtimeDir, "tasks.json"),
    inFlightStates: stateMachine.inFlightStates,
  });
  const audit = createAuditLog({
    filePath: options.auditFile ?? path.join(paths.logsDir, "audit.jsonl"),
  });
  const remote = options.remote ?? createRemoteAdapter();
  const executor = createExecutor({ roles, tools, budget, audit, remote });

  await store.load();

  function touch(task, patch = {}, at = new Date()) {
    Object.assign(task, patch, { updatedAt: at.toISOString() });
    store.save(task);
    return task;
  }

  async function createTask(input) {
    if (input.assigneeRole) assertKnownRole(roles, input.assigneeRole);
    const task = store.create(input);
    await audit.record({
      taskId: task.id,
      role: input.actorRole ?? input.assigneeRole ?? null,
      action: "task:create",
      result: "ok",
      detail: { state: task.state, risk: task.risk },
    });
    await store.persist();
    return task;
  }

  async function transition(taskId, nextState, context = {}) {
    const task = store.get(taskId);
    if (context.actorRole) assertKnownRole(roles, context.actorRole);
    assertTransition(stateMachine, budget, task, nextState, context);

    if (task.state === "Ready" && nextState === "In Progress") {
      assertConcurrencyAvailable(budget, store.inFlightCount());
    }

    const at = context.at ? new Date(context.at) : new Date();
    const historyEntry = {
      from: task.state,
      to: nextState,
      at: at.toISOString(),
      actorRole: context.actorRole ?? null,
      reason: context.reason ?? null,
    };
    task.history.push(historyEntry);
    task.state = nextState;
    if (nextState === "In Progress" && !task.startedAt) {
      task.startedAt = at.toISOString();
    }
    task.updatedAt = at.toISOString();
    store.save(task);

    await audit.record({
      taskId,
      role: context.actorRole ?? null,
      action: `transition:${historyEntry.from}->${nextState}`,
      result: "ok",
      detail: historyEntry,
      at,
    });
    await store.persist();
    return task;
  }

  async function recordFailure(taskId, context = {}) {
    const task = store.get(taskId);
    const at = context.at ? new Date(context.at) : new Date();

    if (isRetriesExhausted(budget, task)) {
      if (task.state !== "BLOCKED") {
        try {
          return await transition(taskId, "BLOCKED", {
            ...context,
            retriesExhausted: true,
            at,
            reason: context.reason ?? "retries exhausted",
          });
        } catch (error) {
          if (!(error instanceof IllegalTransitionError)) throw error;
          return touch(task, { state: "BLOCKED" }, at);
        }
      }
      return task;
    }

    const retriesUsed = nextRetryCount(budget, task);
    touch(task, { retriesUsed }, at);
    await audit.record({
      taskId,
      role: context.actorRole ?? null,
      action: "task:retry",
      result: "ok",
      detail: { retriesUsed, maxAutoRetries: budget.maxAutoRetries, reason: context.reason ?? null },
      at,
    });

    if (["CI", "Independent QA", "Pull Request", "Human Approval"].includes(task.state)) {
      return transition(taskId, "In Progress", {
        ...context,
        rework: true,
        ciFailed: task.state === "CI",
        qaFailed: task.state === "Independent QA",
        at,
        reason: context.reason ?? "automatic retry",
      });
    }

    await store.persist();
    return task;
  }

  async function invoke(input) {
    const task = input.taskId ? store.get(input.taskId) : null;
    try {
      const outcome = await executor.invoke({ ...input, task });
      if (task && (input.costUsd || input.tokens)) {
        touch(task, {
          costUsd: (task.costUsd ?? 0) + (input.costUsd ?? 0),
          tokens: (task.tokens ?? 0) + (input.tokens ?? 0),
        });
        await store.persist();
      }
      return outcome;
    } catch (error) {
      throw error;
    }
  }

  return {
    paths,
    configs,
    roles,
    tools,
    budget,
    stateMachine,
    store,
    audit,
    contractRoles: CONTRACT_ROLES,
    assertKnownRole: (role) => assertKnownRole(roles, role),
    assertToolAllowed: (role, tool) => assertToolAllowed(tools, roles, role, tool),
    isHighRisk: (task) => isHighRisk(stateMachine, task),
    createTask,
    getTask: (id) => store.get(id),
    listTasks: () => store.list(),
    transition,
    recordFailure,
    invoke,
    persist: () => store.persist(),
  };
}
