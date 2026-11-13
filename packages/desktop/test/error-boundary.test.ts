import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildErrorPanelHTML,
  ERROR_BOUNDARY_TEST_ID,
  escapeHtml,
  formatErrorMessage,
  renderWithBoundary,
} from "../src/shared/error-boundary.ts";

describe("render error boundary", () => {
  it("returns a visible alert panel instead of an empty document", () => {
    const html = buildErrorPanelHTML(new Error("renderer exploded"));
    assert.match(html, new RegExp(`data-testid="${ERROR_BOUNDARY_TEST_ID}"`));
    assert.match(html, /role="alert"/);
    assert.match(html, /无法显示此页面/);
    assert.match(html, /renderer exploded/);
    assert.notEqual(html.trim(), "");
  });

  it("escapes untrusted error text so a failed render cannot inject markup", () => {
    assert.equal(escapeHtml('<img src="x" onerror="alert(1)">'), "&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;");
    const html = buildErrorPanelHTML('<script>alert(1)</script>');
    assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  });

  it("catches a thrown render function and still produces visible output", () => {
    const attempt = renderWithBoundary(() => {
      throw new Error("导航视图渲染失败");
    });
    assert.equal(attempt.ok, false);
    if (attempt.ok) {
      assert.fail("expected a failed render attempt");
    }
    assert.equal(attempt.message, "导航视图渲染失败");
    assert.match(attempt.html, /导航视图渲染失败/);
    assert.match(attempt.html, /role="alert"/);
  });

  it("passes through a successful render unchanged", () => {
    const attempt = renderWithBoundary(() => "<div data-testid=\"active-view\">问题对话</div>");
    assert.equal(attempt.ok, true);
    assert.equal(attempt.html, "<div data-testid=\"active-view\">问题对话</div>");
  });

  it("formats unknown values without going blank", () => {
    assert.equal(formatErrorMessage(undefined), "发生了未知错误。");
    const html = buildErrorPanelHTML({ reason: "bad" });
    assert.match(html, /role="alert"/);
    assert.match(html, /bad/);
  });
});
