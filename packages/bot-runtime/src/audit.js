import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import { redact } from "./redact.js";

export function createAuditLog({ filePath }) {
  async function record({ taskId, role, action, result, detail, at } = {}) {
    const entry = redact({
      timestamp: (at ?? new Date()).toISOString(),
      taskId: taskId ?? null,
      role: role ?? null,
      action,
      result,
      detail: detail ?? null,
    });

    await mkdir(path.dirname(filePath), { recursive: true });
    await appendFile(filePath, `${JSON.stringify(entry)}\n`, "utf8");
    return entry;
  }

  return {
    record,
    get filePath() {
      return filePath;
    },
  };
}
