export class BotRuntimeError extends Error {
  constructor(message, code, extra = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    Object.assign(this, extra);
  }
}

export class UnknownRoleError extends BotRuntimeError {
  constructor(role) {
    super(`Unknown role rejected: ${role}`, "UNKNOWN_ROLE", { role });
  }
}

export class DeniedToolError extends BotRuntimeError {
  constructor(tool, reason = "Tool is denied by policy") {
    super(`Denied tool invocation failed: ${tool}. ${reason}`, "DENIED_TOOL", {
      tool,
      reason,
    });
  }
}

export class UnauthorizedToolError extends BotRuntimeError {
  constructor(role, tool) {
    super(`Role ${role} is not allowed to invoke ${tool}`, "UNAUTHORIZED_TOOL", {
      role,
      tool,
    });
  }
}

export class IllegalTransitionError extends BotRuntimeError {
  constructor(from, to, reason = "Illegal state transition") {
    super(`Illegal transition rejected: ${from} -> ${to}. ${reason}`, "ILLEGAL_TRANSITION", {
      from,
      to,
      reason,
    });
  }
}

export class BudgetExceededError extends BotRuntimeError {
  constructor(reason) {
    super(`Budget exceeded: ${reason}`, "BUDGET_EXCEEDED");
  }
}

export class TimeoutError extends BotRuntimeError {
  constructor(reason) {
    super(`Timeout: ${reason}`, "TIMEOUT");
  }
}

export class RetryExhaustedError extends BotRuntimeError {
  constructor(taskId, retries) {
    super(
      `Automatic retries exhausted for ${taskId} after ${retries} retries`,
      "RETRIES_EXHAUSTED",
      { taskId, retries },
    );
  }
}

export class RemoteBlockedError extends BotRuntimeError {
  constructor(detail) {
    super(
      `Remote PR/CI is BLOCKED (B-001 / B-007): ${detail}`,
      "REMOTE_BLOCKED",
    );
  }
}

export class ValidationError extends BotRuntimeError {
  constructor(message) {
    super(message, "VALIDATION");
  }
}
