import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import {
  DATA_LAYOUT_SCHEMA,
  DATA_SUBDIRECTORIES,
  initializeDataDir,
  LAYOUT_MANIFEST_NAME,
} from "../src/shared/data-layout.ts";
import { PRODUCT_NAME } from "../src/shared/product.ts";

const leftovers: string[] = [];

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("BookSkill data directory initialization", () => {
  it("creates the BookSkill layout under BOOKSKILL_DATA_DIR", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-data-"));
    leftovers.push(dataDir);
    fs.rmSync(dataDir, { recursive: true, force: true });

    const result = initializeDataDir({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
      now: new Date("2026-11-13T09:00:00.000Z"),
    });

    assert.equal(result.dataDir, dataDir);
    assert.equal(result.created, true);
    assert.ok(fs.existsSync(dataDir));
    for (const name of DATA_SUBDIRECTORIES) {
      assert.ok(fs.statSync(path.join(dataDir, name)).isDirectory(), name);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(dataDir, LAYOUT_MANIFEST_NAME), "utf8"));
    assert.equal(manifest.product, PRODUCT_NAME);
    assert.equal(manifest.schema, DATA_LAYOUT_SCHEMA);
    assert.doesNotMatch(dataDir, /anythingllm|anything-llm|mintplex/i);
  });

  it("is idempotent and does not overwrite an existing manifest", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-data-"));
    leftovers.push(dataDir);
    const first = initializeDataDir({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
      now: new Date("2026-11-13T09:00:00.000Z"),
    });
    const original = fs.readFileSync(first.manifestPath, "utf8");
    const second = initializeDataDir({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
      now: new Date("2026-11-13T10:00:00.000Z"),
    });
    assert.equal(second.created, false);
    assert.equal(fs.readFileSync(second.manifestPath, "utf8"), original);
  });

  it("uses the BookSkill XDG directory name, not an AnythingLLM user-data path", () => {
    const result = initializeDataDir({
      platform: "linux",
      env: {},
      homedir: "/tmp/bookskill-home-app001",
    });
    leftovers.push(result.dataDir);
    assert.equal(result.dataDir, "/tmp/bookskill-home-app001/.local/share/bookskill-desktop");
    assert.doesNotMatch(result.dataDir, /anythingllm|anything-llm|mintplex/i);
  });

  it("rejects an AnythingLLM default user directory and does not create it", () => {
    const forbidden = path.join(os.tmpdir(), "anythingllm-desktop-should-not-be-used");
    leftovers.push(forbidden);
    assert.equal(fs.existsSync(forbidden), false);
    assert.throws(
      () =>
        initializeDataDir({
          platform: "linux",
          env: { BOOKSKILL_DATA_DIR: forbidden },
          homedir: "/tmp/bookskill-home-app001",
        }),
      /must not use AnythingLLM/,
    );
    assert.equal(fs.existsSync(forbidden), false);
  });

  it("rejects mintplex and anything-llm path markers", () => {
    assert.throws(
      () =>
        initializeDataDir({
          platform: "linux",
          env: { BOOKSKILL_DATA_DIR: "/home/user/.config/anything-llm" },
        }),
      /must not use AnythingLLM/,
    );
    assert.throws(
      () =>
        initializeDataDir({
          platform: "linux",
          env: { BOOKSKILL_DATA_DIR: "/home/user/mintplex-data" },
        }),
      /must not use AnythingLLM/,
    );
  });
});
