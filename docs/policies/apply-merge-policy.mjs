#!/usr/bin/env node
/**
 * Apply docs/policies/merge-policy.yml (D-025).
 *
 * Usage:
 *   node docs/policies/apply-merge-policy.mjs --target integration|main|production \
 *     --risk low|medium|high --ci passed|failed|pending --qa passed|failed|pending \
 *     [--branch-protection enabled|disabled] [--ci-workflow-on-default yes|no]
 *
 * Exit codes: 0 auto-merge integration; 1 usage/error; 2 wait for human;
 *             3 QA failed (open defect, return to implementer); 4 follow branch protection.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const POLICY_PATH = join(ROOT, "merge-policy.yml");

function parseArgs(argv) {
  const args = {
    target: null,
    risk: null,
    ci: null,
    qa: null,
    branchProtection: "disabled",
    ciWorkflowOnDefault: "yes",
    selfTest: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === "--self-test") args.selfTest = true;
    else if (a === "--target") args.target = next, i += 1;
    else if (a === "--risk") args.risk = next, i += 1;
    else if (a === "--ci") args.ci = next, i += 1;
    else if (a === "--qa") args.qa = next, i += 1;
    else if (a === "--branch-protection") args.branchProtection = next, i += 1;
    else if (a === "--ci-workflow-on-default") args.ciWorkflowOnDefault = next, i += 1;
    else if (a === "--help" || a === "-h") args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}

function loadPolicy(text) {
  const highRiskCategories = [];
  let inCats = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, "");
    if (line.trim() === "high_risk_categories:") {
      inCats = true;
      continue;
    }
    const item = line.match(/^\s+-\s+([a-z_]+)\s*$/);
    if (inCats && item) {
      highRiskCategories.push(item[1]);
      continue;
    }
    if (inCats && line.length > 0 && !line.startsWith(" ")) inCats = false;
  }
  return { highRiskCategories, path: POLICY_PATH };
}

function decide(input, policy) {
  const { target, risk, ci, qa, branchProtection, ciWorkflowOnDefault } = input;
  const allowedTarget = new Set(["integration", "main", "production"]);
  const allowedRisk = new Set(["low", "medium", "high"]);
  const allowedStatus = new Set(["passed", "failed", "pending"]);
  if (!allowedTarget.has(target)) throw new Error(`invalid target: ${target}`);
  if (!allowedRisk.has(risk)) throw new Error(`invalid risk: ${risk}`);
  if (!allowedStatus.has(ci)) throw new Error(`invalid ci: ${ci}`);
  if (!allowedStatus.has(qa)) throw new Error(`invalid qa: ${qa}`);

  if (qa === "failed") {
    return {
      decision: "qa_failed_open_defect",
      exit: 3,
      reasons: [
        "Independent QA failed.",
        "Open a defect ticket under docs/tickets/.",
        "Return the work to the implementing agent.",
        "Do not idle-wait.",
      ],
      policy: { high_risk_categories: policy.highRiskCategories },
    };
  }

  if (target === "production") {
    return {
      decision: "wait_for_human",
      exit: 2,
      reasons: ["Production release always requires human confirmation."],
    };
  }

  if (target === "main") {
    const protectionOn = branchProtection === "enabled";
    const workflowOnDefault = ["yes", "true", "on"].includes(ciWorkflowOnDefault);
    if (protectionOn && workflowOnDefault) {
      return {
        decision: "follow_branch_protection",
        exit: 4,
        reasons: [
          "CI workflow is on the default branch and branch protection is enabled.",
          "Follow branch-protection rules. Orchestrator must not bypass protection or auto-merge main.",
        ],
      };
    }
    return {
      decision: "wait_for_human",
      exit: 2,
      reasons: [
        "Until the CI workflow is on the default branch and branch protection is enabled, merging main still requires human confirmation.",
      ],
    };
  }

  // integration
  if (risk === "high") {
    return {
      decision: "wait_for_human",
      exit: 2,
      reasons: [
        "High-risk change (data migration, auth, sync encryption, external operations, release, license, security, privacy, or payment) must wait for human confirmation before integration.",
      ],
    };
  }
  if (ci !== "passed" || qa !== "passed") {
    return {
      decision: "wait_for_human",
      exit: 2,
      reasons: [
        `CI is ${ci} and independent QA is ${qa}.`,
        "Auto-merge to integration requires both CI and independent QA to pass, with low or medium risk.",
      ],
    };
  }
  return {
    decision: "auto_merge_integration",
    exit: 0,
    reasons: [
      "CI passed, independent QA passed, and risk is low or medium.",
      "Orchestrator auto-merges to integration without asking the user each time.",
    ],
  };
}

function runSelfTest(policy) {
  const cases = [
    { in: { target: "integration", risk: "medium", ci: "passed", qa: "passed", branchProtection: "disabled", ciWorkflowOnDefault: "yes" }, exit: 0 },
    { in: { target: "integration", risk: "high", ci: "passed", qa: "passed", branchProtection: "disabled", ciWorkflowOnDefault: "yes" }, exit: 2 },
    { in: { target: "integration", risk: "low", ci: "passed", qa: "failed", branchProtection: "disabled", ciWorkflowOnDefault: "yes" }, exit: 3 },
    { in: { target: "main", risk: "low", ci: "passed", qa: "passed", branchProtection: "disabled", ciWorkflowOnDefault: "yes" }, exit: 2 },
    { in: { target: "main", risk: "low", ci: "passed", qa: "passed", branchProtection: "enabled", ciWorkflowOnDefault: "yes" }, exit: 4 },
    { in: { target: "production", risk: "low", ci: "passed", qa: "passed", branchProtection: "enabled", ciWorkflowOnDefault: "yes" }, exit: 2 },
  ];
  for (const c of cases) {
    const got = decide(c.in, policy);
    if (got.exit !== c.exit) {
      throw new Error(`self-test failed: expected ${c.exit} got ${got.exit} for ${JSON.stringify(c.in)}`);
    }
  }
  return { decision: "self_test_passed", exit: 0, reasons: [`${cases.length} cases passed`], cases: cases.length };
}

function usage() {
  process.stderr.write(`Usage: node docs/policies/apply-merge-policy.mjs --target integration|main|production --risk low|medium|high --ci passed|failed|pending --qa passed|failed|pending [--branch-protection enabled|disabled] [--ci-workflow-on-default yes|no]\n`);
}

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  const policy = loadPolicy(readFileSync(POLICY_PATH, "utf8"));
  const result = args.selfTest ? runSelfTest(policy) : decide(args, policy);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exit(result.exit);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  if (String(error.message).startsWith("Unknown") || String(error.message).startsWith("invalid") || String(error.message).includes("argument")) {
    usage();
  }
  process.exit(1);
}
