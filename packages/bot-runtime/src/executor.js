import { assertKnownRole } from "./roles.js";
import { assertToolAllowed, canonicalizeTool, isDeniedTool } from "./tools.js";
import {
  assertCostWithinBudget,
  assertTaskNotTimedOut,
  assertToolNotTimedOut,
} from "./budget.js";
import { DeniedToolError } from "./errors.js";

const REMOTE_TOOLS = new Set(["create_pull_request", "read_ci_results"]);

function simulateAllowedTool(tool, args) {
  return {
    ok: true,
    simulated: true,
    tool,
    args: args ?? {},
  };
}

export function createExecutor({
  roles,
  tools,
  budget,
  audit,
  remote,
}) {
  async function invoke({
    taskId,
    role,
    tool,
    args,
    task,
    costUsd = 0,
    tokens = 0,
    now = Date.now(),
    toolStartedAt,
  } = {}) {
    const started = toolStartedAt ?? now;
    let canonical = tool;

    const fail = async (error) => {
      await audit.record({
        taskId,
        role,
        action: `invoke:${canonical}`,
        result: error.code ?? "error",
        detail: { tool: canonical, args, error: error.message },
        at: new Date(now),
      });
      throw error;
    };

    try {
      assertKnownRole(roles, role);
      canonical = canonicalizeTool(tools, tool);

      if (isDeniedTool(tools, canonical)) {
        throw new DeniedToolError(canonical, tools.reasons.get(canonical));
      }

      canonical = assertToolAllowed(tools, roles, role, tool);

      if (task) {
        assertTaskNotTimedOut(budget, task, now);
        assertCostWithinBudget(budget, task, costUsd, tokens);
      }
      assertToolNotTimedOut(budget, started, now);
    } catch (error) {
      return fail(error);
    }

    try {
      let outcome;
      if (REMOTE_TOOLS.has(canonical)) {
        if (canonical === "create_pull_request") {
          outcome = await remote.createPullRequest(args);
        } else {
          outcome = await remote.readCiResults(args);
        }
      } else {
        outcome = simulateAllowedTool(canonical, args);
      }

      await audit.record({
        taskId,
        role,
        action: `invoke:${canonical}`,
        result: "ok",
        detail: { tool: canonical, args, outcome },
        at: new Date(now),
      });
      return outcome;
    } catch (error) {
      return fail(error);
    }
  }

  return { invoke };
}
