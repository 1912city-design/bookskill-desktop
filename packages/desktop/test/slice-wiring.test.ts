import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import { openSliceWorkspace } from "@bookskill/core";
import { SCHEMA_VERSION_CURRENT, resolveBusinessDbPath } from "@bookskill/data";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import { PRODUCT_NAME } from "../src/shared/product.ts";

const leftovers: string[] = [];
const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures",
);

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("desktop shell wiring for the VERT-001 slice", () => {
  it("initializes the shell data directory and opens the business database under it", () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-vert-"));
    leftovers.push(dataDir);
    const initialized = initializeDataDir({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    const dbPath = resolveBusinessDbPath({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    assert.equal(initialized.dataDir, dataDir);
    assert.equal(dbPath, path.join(dataDir, "db", "bookskill.sqlite"));
    assert.doesNotMatch(dbPath, /anythingllm|mintplex/i);

    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(path.join(FIXTURES_DIR, "bookskill-test-primer.epub"));
      assert.equal(book.title, "BookSkill Test Primer");
      const snapshot = workspace.snapshot();
      assert.equal(snapshot.schemaVersion, SCHEMA_VERSION_CURRENT);
      assert.equal(snapshot.books, 1);
      assert.equal(snapshot.dbPath, dbPath);
      assert.ok(fs.existsSync(dbPath));
      assert.equal(PRODUCT_NAME, "BookSkill Desktop");
    } finally {
      workspace.close();
    }
  });
});
