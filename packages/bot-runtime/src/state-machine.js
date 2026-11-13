import { IllegalTransitionError, ValidationError } from "./errors.js";
import { isRetriesExhausted } from "./budget.js";

export const HIGH_RISK_CATEGORIES = Object.freeze([
  "data_migration",
  "authorization",
  "sync_encryption",
  "external_operations",
  "release",
]);

export function buildStateMachine(config) {
  const states = new Set(config.states);
  const required = [
    "Backlog",
    "Ready",
    "In Progress",
    "Pull Request",
    "CI",
    "Independent QA",
    "Auto-merge to integration",
    "Human Approval",
    "Done",
    "BLOCKED",
  ];
  for (const state of required) {
    if (!states.has(state)) {
      throw new ValidationError(`state-machine.json missing required state ${state}`);
    }
  }

  const transitions = new Map();
  for (const edge of config.transitions ?? []) {
    const key = `${edge.from}=>${edge.to}`;
    transitions.set(key, Object.freeze({ ...edge, requires: Object.freeze([...(edge.requires ?? [])]) }));
  }

  return Object.freeze({
    states: Object.freeze(states),
    inFlightStates: Object.freeze(new Set(config.inFlightStates ?? [])),
    highRiskCategories: Object.freeze(
      new Set(config.highRiskCategories ?? HIGH_RISK_CATEGORIES),
    ),
    transitions: Object.freeze(transitions),
  });
}

export function isHighRisk(machine, task) {
  if (task.risk === "high") return true;
  const categories = task.riskCategories ?? [];
  return categories.some((item) => machine.highRiskCategories.has(item));
}

function requirementMet(machine, budget, task, context, requirement) {
  switch (requirement) {
    case "acceptanceCriteria":
      return Array.isArray(task.acceptanceCriteria) && task.acceptanceCriteria.length > 0;
    case "retriesExhausted":
      return isRetriesExhausted(budget, task);
    case "retriesRemaining":
      return !isRetriesExhausted(budget, task);
    case "rework":
      return context.rework === true;
    case "ciPassed":
      return context.ciPassed === true;
    case "ciFailed":
      return context.ciFailed === true;
    case "qaPassed":
      return context.qaPassed === true;
    case "qaFailed":
      return context.qaFailed === true;
    case "lowOrMediumRisk":
      return !isHighRisk(machine, task);
    case "highRisk":
      return isHighRisk(machine, task);
    case "humanApproved":
      return context.humanApproved === true;
    case "humanRejected":
      return context.humanRejected === true;
    default:
      return false;
  }
}

export function assertTransition(machine, budget, task, nextState, context = {}) {
  const from = task.state;
  if (!machine.states.has(nextState)) {
    throw new IllegalTransitionError(from, nextState, "Unknown target state");
  }

  if (context.actorRole === "orchestrator" && nextState === "Auto-merge to integration") {
    throw new IllegalTransitionError(
      from,
      nextState,
      "orchestrator must not merge code, including auto-merge to integration",
    );
  }

  const edge = machine.transitions.get(`${from}=>${nextState}`);
  if (!edge) {
    throw new IllegalTransitionError(from, nextState, "Transition is not in the legal table");
  }

  for (const requirement of edge.requires) {
    if (!requirementMet(machine, budget, task, context, requirement)) {
      throw new IllegalTransitionError(
        from,
        nextState,
        `Requirement not met: ${requirement}`,
      );
    }
  }

  if (nextState === "Auto-merge to integration" && isHighRisk(machine, task)) {
    throw new IllegalTransitionError(
      from,
      nextState,
      "High-risk tasks (data migration, authorization, sync encryption, external operations, release) must not auto-merge",
    );
  }

  return edge;
}
