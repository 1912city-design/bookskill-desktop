import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { ValidationError } from "./errors.js";

function emptyStore() {
  return { version: 1, tasks: {} };
}

export function createStore({ filePath, inFlightStates }) {
  let data = emptyStore();

  async function load() {
    try {
      const raw = await readFile(filePath, "utf8");
      data = JSON.parse(raw);
      if (!data.tasks || typeof data.tasks !== "object") {
        throw new ValidationError(`Invalid task store at ${filePath}`);
      }
    } catch (error) {
      if (error.code === "ENOENT") {
        data = emptyStore();
        return data;
      }
      throw error;
    }
    return data;
  }

  async function persist() {
    await mkdir(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await rename(tmp, filePath);
  }

  function get(taskId) {
    const task = data.tasks[taskId];
    if (!task) {
      throw new ValidationError(`Unknown task: ${taskId}`);
    }
    return task;
  }

  function list() {
    return Object.values(data.tasks);
  }

  function inFlightCount() {
    return list().filter((task) => inFlightStates.has(task.state)).length;
  }

  function create(task) {
    if (!task?.id) throw new ValidationError("Task id is required");
    if (data.tasks[task.id]) {
      throw new ValidationError(`Task already exists: ${task.id}`);
    }
    const now = task.updatedAt ?? new Date().toISOString();
    const record = {
      id: task.id,
      state: task.state ?? "Backlog",
      risk: task.risk ?? "medium",
      riskCategories: [...(task.riskCategories ?? [])],
      acceptanceCriteria: [...(task.acceptanceCriteria ?? [])],
      assigneeRole: task.assigneeRole ?? null,
      retriesUsed: task.retriesUsed ?? 0,
      costUsd: task.costUsd ?? 0,
      tokens: task.tokens ?? 0,
      startedAt: task.startedAt ?? null,
      createdAt: now,
      updatedAt: now,
      history: [],
    };
    data.tasks[task.id] = record;
    return record;
  }

  function save(task) {
    data.tasks[task.id] = task;
    return task;
  }

  return {
    load,
    persist,
    get,
    list,
    inFlightCount,
    create,
    save,
    get filePath() {
      return filePath;
    },
  };
}
