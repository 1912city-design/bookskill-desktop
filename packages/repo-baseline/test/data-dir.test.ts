import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PRODUCT_DATA_DIR_NAME_UNIX,
  resolveDataDir,
} from "../dist/index.js";

describe("resolveDataDir", () => {
  it("uses a BookSkill XDG path on Linux, not an AnythingLLM path", () => {
    const dir = resolveDataDir({
      platform: "linux",
      env: {},
      homedir: "/tmp/bookskill-home",
    });
    assert.equal(dir, "/tmp/bookskill-home/.local/share/bookskill-desktop");
    assert.doesNotMatch(dir, /anythingllm|anything-llm|mintplex/i);
  });

  it("honors XDG_DATA_HOME on Linux", () => {
    const dir = resolveDataDir({
      platform: "linux",
      env: { XDG_DATA_HOME: "/tmp/xdg-data" },
      homedir: "/tmp/bookskill-home",
    });
    assert.equal(dir, "/tmp/xdg-data/bookskill-desktop");
  });

  it("uses Application Support / BookSkill Desktop on macOS", () => {
    const dir = resolveDataDir({
      platform: "darwin",
      env: {},
      homedir: "/Users/test",
    });
    assert.equal(dir, "/Users/test/Library/Application Support/BookSkill Desktop");
    assert.doesNotMatch(dir, /anythingllm|anything-llm|mintplex/i);
  });

  it("uses APPDATA / BookSkill Desktop on Windows", () => {
    const dir = resolveDataDir({
      platform: "win32",
      env: { APPDATA: "C:\\Users\\test\\AppData\\Roaming" },
      homedir: "C:\\Users\\test",
    });
    assert.equal(dir, "C:\\Users\\test\\AppData\\Roaming\\BookSkill Desktop");
    assert.doesNotMatch(dir, /anythingllm|anything-llm|mintplex/i);
  });

  it("honors BOOKSKILL_DATA_DIR when the path is product-specific", () => {
    const dir = resolveDataDir({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: "/var/tmp/bookskill-data" },
      homedir: "/tmp/bookskill-home",
    });
    assert.equal(dir, "/var/tmp/bookskill-data");
  });

  it("rejects an override that points at AnythingLLM data", () => {
    assert.throws(
      () =>
        resolveDataDir({
          platform: "linux",
          env: { BOOKSKILL_DATA_DIR: "/home/user/.config/anythingllm-desktop" },
          homedir: "/home/user",
        }),
      /must not use AnythingLLM/,
    );
  });

  it("product unix dir name is bookskill-desktop, not an AnythingLLM user-data name", () => {
    assert.equal(PRODUCT_DATA_DIR_NAME_UNIX, "bookskill-desktop");
    assert.doesNotMatch(PRODUCT_DATA_DIR_NAME_UNIX, /anythingllm|anything-llm|mintplex/i);
  });
});
