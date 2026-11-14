import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const electronBinary = require("electron");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-smoke-"));
const outPath = path.join(dataDir, "smoke-result.json");

function runElectron(args, env) {
  return new Promise((resolve) => {
    const child = spawn(electronBinary, args, {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 25_000);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr });
    });
  });
}

async function main() {
  const env = {
    ...process.env,
    BOOKSKILL_DATA_DIR: dataDir,
    BOOKSKILL_ELECTRON_NO_SANDBOX: "1",
    ELECTRON_DISABLE_SECURITY_WARNINGS: "1",
  };

  let result = await runElectron([".", "--smoke", `--smoke-out=${outPath}`], env);

  const looksLikeDisplayFailure =
    /DISPLAY|ozone|gpu|cannot open display|GTK|Elf file/i.test(result.stderr + result.stdout) &&
    (!fs.existsSync(outPath) || result.code !== 0);

  if (result.code !== 0 && looksLikeDisplayFailure) {
    const xvfb = "/usr/bin/xvfb-run";
    if (fs.existsSync(xvfb)) {
      result = await new Promise((resolve) => {
        const child = spawn(
          xvfb,
          ["-a", "--", electronBinary, ".", "--smoke", `--smoke-out=${outPath}`],
          {
            cwd: root,
            env,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), 25_000);
        child.stdout.on("data", (chunk) => {
          stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk.toString();
        });
        child.on("close", (code, signal) => {
          clearTimeout(timer);
          resolve({ code, signal, stdout, stderr });
        });
      });
    }
  }

  if (!fs.existsSync(outPath)) {
    console.error("Smoke result file was not written.");
    console.error(result.stdout);
    console.error(result.stderr);
    process.exit(result.code === 0 ? 1 : result.code ?? 1);
  }

  const payload = JSON.parse(fs.readFileSync(outPath, "utf8"));
  const requiredDirs = ["conversations", "library", "knowledge", "skills", "settings", "logs"];
  const missing = requiredDirs.filter((name) => !fs.existsSync(path.join(dataDir, name)));

  const snapshot = payload.snapshot ?? {};
  const navLabels = (snapshot.navButtons ?? []).map((item) => item.label);
  const expectedLabels = ["问题对话", "书库", "知识库", "Skills", "设置与数据"];

  const failures = [];
  if (!payload.ok) {
    failures.push(`smoke payload not ok: ${payload.error ?? "unknown"}`);
  }
  if (payload.productName !== "BookSkill Desktop") {
    failures.push(`product name mismatch: ${payload.productName}`);
  }
  if (snapshot.productName !== "BookSkill Desktop") {
    failures.push(`renderer product name mismatch: ${snapshot.productName}`);
  }
  if (snapshot.defaultRouteId !== "chat" || snapshot.defaultViewLabel !== "问题对话") {
    failures.push(`default route was ${snapshot.defaultRouteId}/${snapshot.defaultViewLabel}`);
  }
  if (JSON.stringify(navLabels) !== JSON.stringify(expectedLabels)) {
    failures.push(`nav labels mismatch: ${JSON.stringify(navLabels)}`);
  }
  if (missing.length > 0) {
    failures.push(`missing data directories: ${missing.join(", ")}`);
  }
  if (!fs.existsSync(path.join(dataDir, "layout.json"))) {
    failures.push("layout.json was not created");
  }

  const report = {
    exitCodeFromElectron: result.code,
    dataDir,
    outPath,
    payload,
    failures,
    stdout: result.stdout,
    stderr: result.stderr,
  };

  if (failures.length > 0 || result.code !== 0) {
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  console.log("BookSkill Desktop Linux smoke passed.");
  console.log(`dataDir=${dataDir}`);
  console.log(`smokeResult=${outPath}`);
  console.log(`defaultRoute=${snapshot.defaultRouteId} ${snapshot.defaultViewLabel}`);
}

await main();
