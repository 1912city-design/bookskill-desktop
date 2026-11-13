export const ERROR_BOUNDARY_TEST_ID = "error-boundary";

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    return message || error.name;
  }
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  try {
    return JSON.stringify(error) ?? "发生了未知错误。";
  } catch {
    return "发生了未知错误。";
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * Visible error surface for render or startup failures.
 * The shell must show this panel instead of a blank window.
 */
export function buildErrorPanelHTML(error: unknown): string {
  const message = escapeHtml(formatErrorMessage(error));
  return [
    `<section data-testid="${ERROR_BOUNDARY_TEST_ID}" class="error-boundary" role="alert">`,
    `<p class="error-kicker">BookSkill Desktop</p>`,
    `<h1>无法显示此页面</h1>`,
    `<p class="error-boundary-message">${message}</p>`,
    `<p class="error-boundary-hint">请重试，或从侧边栏打开其他入口。如果问题持续出现，可在「设置与数据」确认本机数据目录是否可用。</p>`,
    `</section>`,
  ].join("");
}

export type RenderAttempt =
  | { ok: true; html: string }
  | { ok: false; html: string; message: string };

export function renderWithBoundary(render: () => string): RenderAttempt {
  try {
    return { ok: true, html: render() };
  } catch (error) {
    return {
      ok: false,
      html: buildErrorPanelHTML(error),
      message: formatErrorMessage(error),
    };
  }
}
