import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { CONTRACT_ROLES, UnknownRoleError, createRuntime } from "../src/index.js";
import { resolvePaths } from "../src/paths.js";
import { withRuntime } from "./helpers.js";

const OLD_ROLES = [
  "chief_of_staff",
  "书籍蒸馏产品 Chief of Staff",
  "蒸馏 Manager",
  "工具 Manager",
  "distillation_manager",
  "tool_manager",
  "system",
  "admin",
  "",
];

test("roles.json contains exactly the eight contract roles", async () => {
  const paths = resolvePaths();
  const raw = JSON.parse(await readFile(paths.rolesFile, "utf8"));
  const ids = raw.roles.map((role) => role.id);
  assert.deepEqual(ids, [...CONTRACT_ROLES]);
  for (const role of raw.roles) {
    assert.ok(role.allowedOperations.length > 0, `${role.id} must declare allowed operations`);
    assert.ok(role.forbiddenOperations.length > 0, `${role.id} must declare forbidden operations`);
  }
});

test("runtime accepts each contract role and rejects unknown roles", async () => {
  await withRuntime(async (runtime) => {
    for (const role of CONTRACT_ROLES) {
      assert.equal(runtime.assertKnownRole(role).id, role);
    }
    for (const role of OLD_ROLES) {
      assert.throws(() => runtime.assertKnownRole(role), UnknownRoleError);
    }
  });
});

test("orchestrator is forbidden from merging code and changing implementation files", async () => {
  await withRuntime(async (runtime) => {
    const role = runtime.assertKnownRole("orchestrator");
    for (const op of [
      "merge_main",
      "merge_own_pr",
      "auto_merge_integration",
      "modify_branch_files",
      "production_release",
    ]) {
      assert.ok(role.forbiddenOperations.includes(op), `orchestrator must forbid ${op}`);
    }
  });
});

test("product cannot change technical decisions", async () => {
  await withRuntime(async (runtime) => {
    const role = runtime.assertKnownRole("product");
    assert.ok(role.forbiddenOperations.includes("write_technical_decision"));
    assert.ok(role.allowedOperations.includes("write_acceptance_criteria"));
  });
});

test("release_engineer cannot self-publish a production release", async () => {
  await withRuntime(async (runtime) => {
    const role = runtime.assertKnownRole("release_engineer");
    assert.ok(role.allowedOperations.includes("build_release_candidate"));
    assert.ok(role.forbiddenOperations.includes("production_release"));
  });
});

test("qa_security can veto a pass", async () => {
  await withRuntime(async (runtime) => {
    const role = runtime.assertKnownRole("qa_security");
    assert.ok(role.allowedOperations.includes("veto_pass"));
    assert.ok(role.allowedOperations.includes("security_review"));
  });
});

test("createRuntime refuses a catalog that adds an unknown role", async () => {
  const { buildRoleCatalog } = await import("../src/roles.js");
  assert.throws(
    () =>
      buildRoleCatalog({
        roles: CONTRACT_ROLES.map((id) => ({
          id,
          allowedOperations: ["read_tasks"],
          forbiddenOperations: ["merge_main"],
        })).concat([
          {
            id: "蒸馏 Manager",
            allowedOperations: ["read_tasks"],
            forbiddenOperations: ["merge_main"],
          },
        ]),
      }),
    /exactly the 8 contract roles/,
  );
});
