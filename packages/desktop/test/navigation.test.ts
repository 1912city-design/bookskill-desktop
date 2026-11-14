import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createNavigationState,
  DEFAULT_ROUTE_ID,
  NAV_ITEMS,
  ROUTE_IDS,
} from "../src/shared/navigation.ts";
import { PRODUCT_NAME } from "../src/shared/product.ts";

describe("BookSkill Desktop navigation", () => {
  it("exposes exactly five first-level entries with the contract labels", () => {
    assert.equal(NAV_ITEMS.length, 5);
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.label),
      ["问题对话", "书库", "知识库", "Skills", "设置与数据"],
    );
    assert.deepEqual([...ROUTE_IDS], ["chat", "library", "knowledge", "skills", "settings"]);
  });

  it("defaults to 问题对话", () => {
    const nav = createNavigationState();
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.equal(nav.current, "chat");
    assert.equal(nav.currentItem.label, "问题对话");
  });

  it("can navigate to every first-level entry", () => {
    const nav = createNavigationState();
    for (const item of NAV_ITEMS) {
      assert.equal(nav.go(item.id), item.id);
      assert.equal(nav.current, item.id);
      assert.equal(nav.currentItem.label, item.label);
    }
  });

  it("rejects unknown routes so a typo cannot silently show a blank view", () => {
    const nav = createNavigationState();
    assert.throws(() => nav.go("anythingllm"), /Unknown route/);
    assert.equal(nav.current, "chat");
  });

  it("uses the BookSkill Desktop product name, not an AnythingLLM mark", () => {
    assert.equal(PRODUCT_NAME, "BookSkill Desktop");
    assert.doesNotMatch(PRODUCT_NAME, /anythingllm|anything-llm|mintplex/i);
  });
});
