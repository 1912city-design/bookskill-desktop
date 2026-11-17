import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { SCHEMA_VERSION_CURRENT } from "@bookskill/data";
import { openSliceWorkspace } from "../src/index.ts";

const leftovers: string[] = [];

afterEach(() => {
  while (leftovers.length > 0) {
    const dir = leftovers.pop();
    if (dir) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("business database path policy", () => {
  it("opens the business database under the BookSkill data directory at the current schema version", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-vert-path-"));
    leftovers.push(dataDir);
    const workspace = openSliceWorkspace({ env: { BOOKSKILL_DATA_DIR: dataDir }, platform: "linux" });
    try {
      assert.equal(workspace.dataDir, dataDir);
      assert.equal(workspace.dbPath, path.join(dataDir, "db", "bookskill.sqlite"));
      assert.equal(workspace.schemaVersion, SCHEMA_VERSION_CURRENT);
      assert.equal(workspace.schemaVersion, 3);
      assert.ok(fs.existsSync(workspace.dbPath));
      assert.doesNotMatch(workspace.dbPath, /anythingllm|anything-llm|mintplex/i);
    } finally {
      workspace.close();
    }
  });

  it("rejects AnythingLLM and mintplex data directories and does not create them", () => {
    const forbidden = path.join(os.tmpdir(), "anythingllm-desktop-vert-should-not-exist");
    leftovers.push(forbidden);
    assert.equal(fs.existsSync(forbidden), false);
    assert.throws(
      () => openSliceWorkspace({ env: { BOOKSKILL_DATA_DIR: forbidden }, platform: "linux" }),
      /AnythingLLM/,
    );
    assert.equal(fs.existsSync(forbidden), false);

    assert.throws(
      () =>
        openSliceWorkspace({
          env: { BOOKSKILL_DATA_DIR: "/tmp/mintplex-data-vert" },
          platform: "linux",
        }),
      /AnythingLLM/,
    );
  });
});
