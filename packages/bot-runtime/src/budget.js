import {
  BudgetExceededError,
  RetryExhaustedError,
  TimeoutError,
  ValidationError,
} from "./errors.js";

export const DEFAULT_BUDGET = Object.freeze({
  retries: { maxAutoRetries: 2, onExhaustion: "BLOCKED" },
  timeouts: {
    taskTimeoutMs: 86_400_000,
    toolTimeoutMs: 300_000,
    heartbeatIntervalMs: 3_600_000,
  },
  budget: {
    maxConcurrentDevelopmentTasks: 6,
    maxCostUsdPerTask: 50,
    maxTokensPerTask: 2_000_000,
    currency: "USD",
  },
});

export function buildBudget(budgetConfig) {
  const retries = budgetConfig?.retries ?? {};
  const timeouts = budgetConfig?.timeouts ?? {};
  const budget = budgetConfig?.budget ?? {};

  const maxAutoRetries = retries.maxAutoRetries;
  if (maxAutoRetries !== 2) {
    throw new ValidationError(
      `maxAutoRetries must be 2 per contract, got ${maxAutoRetries}`,
    );
  }

  return Object.freeze({
    maxAutoRetries,
    onExhaustion: retries.onExhaustion ?? "BLOCKED",
    taskTimeoutMs: timeouts.taskTimeoutMs ?? DEFAULT_BUDGET.timeouts.taskTimeoutMs,
    toolTimeoutMs: timeouts.toolTimeoutMs ?? DEFAULT_BUDGET.timeouts.toolTimeoutMs,
    heartbeatIntervalMs:
      timeouts.heartbeatIntervalMs ?? DEFAULT_BUDGET.timeouts.heartbeatIntervalMs,
    maxConcurrentDevelopmentTasks:
      budget.maxConcurrentDevelopmentTasks ??
      DEFAULT_BUDGET.budget.maxConcurrentDevelopmentTasks,
    maxCostUsdPerTask:
      budget.maxCostUsdPerTask ?? DEFAULT_BUDGET.budget.maxCostUsdPerTask,
    maxTokensPerTask:
      budget.maxTokensPerTask ?? DEFAULT_BUDGET.budget.maxTokensPerTask,
    currency: budget.currency ?? DEFAULT_BUDGET.budget.currency,
  });
}

export function assertRetriesRemaining(budget, task) {
  const used = task.retriesUsed ?? 0;
  if (used >= budget.maxAutoRetries) {
    throw new RetryExhaustedError(task.id, used);
  }
}

export function nextRetryCount(budget, task) {
  const used = task.retriesUsed ?? 0;
  if (used >= budget.maxAutoRetries) {
    throw new RetryExhaustedError(task.id, used);
  }
  return used + 1;
}

export function isRetriesExhausted(budget, task) {
  return (task.retriesUsed ?? 0) >= budget.maxAutoRetries;
}

export function assertTaskNotTimedOut(budget, task, now = Date.now()) {
  if (!task.startedAt) return;
  const started = Date.parse(task.startedAt);
  if (Number.isNaN(started)) return;
  if (now - started > budget.taskTimeoutMs) {
    throw new TimeoutError(
      `Task ${task.id} exceeded taskTimeoutMs=${budget.taskTimeoutMs}`,
    );
  }
}

export function assertToolNotTimedOut(budget, startedAt, now = Date.now()) {
  if (now - startedAt > budget.toolTimeoutMs) {
    throw new TimeoutError(`Tool call exceeded toolTimeoutMs=${budget.toolTimeoutMs}`);
  }
}

export function assertCostWithinBudget(budget, task, additionalCostUsd = 0, additionalTokens = 0) {
  const cost = (task.costUsd ?? 0) + additionalCostUsd;
  const tokens = (task.tokens ?? 0) + additionalTokens;
  if (cost > budget.maxCostUsdPerTask) {
    throw new BudgetExceededError(
      `task ${task.id} cost ${cost} ${budget.currency} exceeds maxCostUsdPerTask=${budget.maxCostUsdPerTask}`,
    );
  }
  if (tokens > budget.maxTokensPerTask) {
    throw new BudgetExceededError(
      `task ${task.id} tokens ${tokens} exceed maxTokensPerTask=${budget.maxTokensPerTask}`,
    );
  }
}

export function assertConcurrencyAvailable(budget, inFlightCount) {
  if (inFlightCount >= budget.maxConcurrentDevelopmentTasks) {
    throw new BudgetExceededError(
      `in-flight development tasks ${inFlightCount} meet or exceed maxConcurrentDevelopmentTasks=${budget.maxConcurrentDevelopmentTasks}`,
    );
  }
}
