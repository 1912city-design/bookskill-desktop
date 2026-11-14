import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  BUSINESS_DB_FILENAME,
  assertBusinessDbPath,
  migrateBusinessDatabase,
  resolveBusinessDbPath,
} from "../src/index.ts";
import { createTempDataEnv, type TempDataEnv } from "./helpers.ts";

const temps: TempDataEnv[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

describe("business database path", () => {
  it("places the business db under the BookSkill data directory, not AnythingLLM storage", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const dbPath = resolveBusinessDbPath({ env: env.env, platform: "linux" });
    assert.equal(dbPath, path.join(env.dataDir, "db", BUSINESS_DB_FILENAME));
    assert.ok(dbPath.startsWith(env.dataDir));
    assert.doesNotMatch(dbPath, /anythingllm|anything-llm|mintplex/i);
    assert.equal(path.basename(dbPath), "bookskill.sqlite");
  });

  it("uses the BookSkill XDG path on Linux when no override is set", () => {
    const dbPath = resolveBusinessDbPath({
      platform: "linux",
      env: {},
      homedir: "/tmp/bookskill-home",
    });
    assert.equal(
      dbPath,
      "/tmp/bookskill-home/.local/share/bookskill-desktop/db/bookskill.sqlite",
    );
    assert.doesNotMatch(dbPath, /anythingllm|anything-llm|mintplex/i);
  });

  it("uses Application Support / BookSkill Desktop on macOS", () => {
    const dbPath = resolveBusinessDbPath({
      platform: "darwin",
      env: {},
      homedir: "/Users/test",
    });
    assert.equal(
      dbPath,
      "/Users/test/Library/Application Support/BookSkill Desktop/db/bookskill.sqlite",
    );
  });

  it("uses APPDATA / BookSkill Desktop on Windows", () => {
    const dbPath = resolveBusinessDbPath({
      platform: "win32",
      env: { APPDATA: "C:\\Users\\test\\AppData\\Roaming" },
      homedir: "C:\\Users\\test",
    });
    assert.equal(
      dbPath,
      "C:\\Users\\test\\AppData\\Roaming\\BookSkill Desktop\\db\\bookskill.sqlite",
    );
    assert.doesNotMatch(dbPath, /anythingllm|anything-llm|mintplex/i);
  });

  it("rejects an AnythingLLM override and never creates a database there", () => {
    const anythingDir = fs.mkdtempSync(path.join(os.tmpdir(), "anythingllm-store-"));
    const env = { BOOKSKILL_DATA_DIR: anythingDir };
    assert.throws(
      () => resolveBusinessDbPath({ platform: "linux", env }),
      /must not use AnythingLLM/,
    );
    assert.throws(
      () => migrateBusinessDatabase({ platform: "linux", env }),
      /must not use AnythingLLM/,
    );
    assert.throws(
      () =>
        assertBusinessDbPath(path.join(anythingDir, "db", "bookskill.sqlite"), {
          platform: "linux",
          env: { BOOKSKILL_DATA_DIR: "/tmp/bookskill-data" },
        }),
      /must not use AnythingLLM/,
    );
    const leftover = fs.readdirSync(anythingDir);
    assert.deepEqual(leftover, []);
    fs.rmSync(anythingDir, { recursive: true, force: true });
  });

  it("open/migrate writes only inside the BookSkill data directory", () => {
    const env = createTempDataEnv();
    temps.push(env);
    const result = migrateBusinessDatabase({ env: env.env, platform: "linux" });
    assert.ok(result.dbPath.startsWith(env.dataDir));
    assert.equal(path.basename(result.dbPath), BUSINESS_DB_FILENAME);
    assert.ok(fs.existsSync(result.dbPath));
    assert.doesNotMatch(result.dbPath, /anythingllm|anything-llm|mintplex/i);
  });
});
