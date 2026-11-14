import assert from "node:assert/strict";
import test from "node:test";
import { DeniedToolError, REDACTED, containsPlaintextSecret } from "../src/index.js";
import { withRuntime, readAudit, readAuditText, lowRiskTask } from "./helpers.js";

const PLAINTEXT_SECRETS = [
  "sk-live-EXAMPLE_NOT_A_REAL_KEY_1234567890abcd",
  "ghp_exampleNotARealGitHubToken1234567890",
  "super-secret-password-value",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example",
];

test("audit log records task id, role, action, time, and result", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "AUD-1" }));
    await runtime.invoke({
      taskId: "AUD-1",
      role: "backend_engineer",
      tool: "run_tests",
    });
    const entries = await readAudit(runtime);
    assert.ok(entries.length >= 2);
    for (const entry of entries) {
      assert.equal(typeof entry.timestamp, "string");
      assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T/);
      assert.ok(Object.hasOwn(entry, "taskId"));
      assert.ok(Object.hasOwn(entry, "role"));
      assert.ok(Object.hasOwn(entry, "action"));
      assert.ok(Object.hasOwn(entry, "result"));
    }
    const invoke = entries.find((entry) => entry.action === "invoke:run_tests");
    assert.equal(invoke.taskId, "AUD-1");
    assert.equal(invoke.role, "backend_engineer");
    assert.equal(invoke.result, "ok");
  });
});

test("plaintext secrets are redacted from the audit log", async () => {
  await withRuntime(async (runtime) => {
    await runtime.createTask(lowRiskTask({ id: "AUD-SECRET" }));
    await assert.rejects(
      () =>
        runtime.invoke({
          taskId: "AUD-SECRET",
          role: "backend_engineer",
          tool: "read_production_secrets",
          args: {
            apiKey: PLAINTEXT_SECRETS[0],
            token: PLAINTEXT_SECRETS[1],
            password: PLAINTEXT_SECRETS[2],
            authorization: `Bearer ${PLAINTEXT_SECRETS[3]}`,
            note: `backup key=${PLAINTEXT_SECRETS[0]} password=${PLAINTEXT_SECRETS[2]}`,
          },
        }),
      DeniedToolError,
    );

    const text = await readAuditText(runtime);
    assert.equal(
      containsPlaintextSecret(text, PLAINTEXT_SECRETS),
      false,
      "audit log must not contain plaintext secrets",
    );
    assert.match(text, new RegExp(REDACTED));

    const entries = await readAudit(runtime);
    const denied = entries.find((entry) => entry.action === "invoke:read_production_secrets");
    assert.equal(denied.result, "DENIED_TOOL");
    assert.equal(denied.detail.args.apiKey, REDACTED);
    assert.equal(denied.detail.args.token, REDACTED);
    assert.equal(denied.detail.args.password, REDACTED);
    assert.equal(denied.detail.args.authorization, REDACTED);
  });
});
