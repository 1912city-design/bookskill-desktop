import {
  buildErrorPanelHTML,
  renderWithBoundary,
} from "../shared/error-boundary.ts";
import {
  createNavigationState,
  DEFAULT_ROUTE_ID,
  type NavigationState,
  type RouteId,
} from "../shared/navigation.ts";
import { PRODUCT_NAME } from "../shared/product.ts";
import type { ShellInfo } from "../shared/shell-info.ts";

type DesktopBridge = {
  getShellInfo: () => Promise<ShellInfo>;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getBridge(): DesktopBridge | null {
  const fromWindow = (window as Window & { bookskillDesktop?: DesktopBridge }).bookskillDesktop;
  return fromWindow ?? null;
}

function readBootError(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("bootError");
  return fromQuery && fromQuery.trim() ? fromQuery : null;
}

function shouldCrashForTest(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get("crash") === "1";
}

function mountError(root: HTMLElement, error: unknown): void {
  root.innerHTML = buildErrorPanelHTML(error);
}

function renderShell(info: ShellInfo, nav: NavigationState): string {
  const navButtons = nav.items
    .map((item) => {
      const current = item.id === nav.current;
      return [
        `<button type="button" class="nav-button" data-nav-id="${item.id}" data-testid="nav-${item.id}"`,
        ` aria-current="${current ? "page" : "false"}">`,
        `<span class="nav-label">${item.label}</span>`,
        `</button>`,
      ].join("");
    })
    .join("");

  const view = nav.currentItem;
  const sliceSummary = info.slice
    ? `书籍 ${info.slice.books} · 知识卡 ${info.slice.knowledgeCards} · Skills ${info.slice.skills} · 对话 ${info.slice.conversations} · 反馈 ${info.slice.feedback}`
    : info.sliceError
      ? `业务库尚未打开：${escapeHtml(info.sliceError)}`
      : "业务库尚未打开。";
  const dataDir =
    view.id === "settings"
      ? `<dl class="meta-list">
          <div><dt>产品名称</dt><dd data-testid="settings-product-name">${info.productName}</dd></div>
          <div><dt>本机数据目录</dt><dd data-testid="data-dir">${info.dataDir || "尚未创建（启动时解析失败）"}</dd></div>
          <div><dt>业务库路径</dt><dd data-testid="business-db-path">${info.businessDbPath || "尚未解析"}</dd></div>
          <div><dt>Schema 版本</dt><dd data-testid="schema-version">${info.schemaVersion ?? "未知"}</dd></div>
          <div><dt>薄切片数据</dt><dd data-testid="slice-summary">${sliceSummary}</dd></div>
          <div><dt>版本</dt><dd>${info.version}</dd></div>
        </dl>`
      : `<p class="view-note">此入口已可导航。薄切片的导入、知识卡、Skill 与离线对话已接到本机业务库；完整阅读器或 Skill Studio 不在本页范围。</p>`;

  return [
    `<div class="app-shell" data-testid="app-shell">`,
    `<aside class="sidebar">`,
    `<div class="brand">`,
    `<div class="brand-mark" aria-hidden="true"></div>`,
    `<div class="brand-text">`,
    `<p class="brand-kicker">本地阅读工作台</p>`,
    `<p class="product-name" data-testid="product-name">${info.productName}</p>`,
    `</div>`,
    `</div>`,
    `<nav class="nav" data-testid="nav" aria-label="主导航">${navButtons}</nav>`,
    `</aside>`,
    `<main class="main">`,
    `<section class="active-view" data-testid="active-view" data-route="${view.id}">`,
    `<p class="view-kicker">当前入口</p>`,
    `<h1 data-testid="view-title">${view.title}</h1>`,
    `<p class="view-description" data-testid="view-description">${view.description}</p>`,
    dataDir,
    `</section>`,
    `</main>`,
    `</div>`,
  ].join("");
}

function bindNavigation(root: HTMLElement, info: ShellInfo, nav: NavigationState): void {
  root.querySelectorAll<HTMLButtonElement>("[data-nav-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-nav-id");
      if (!id) {
        return;
      }
      try {
        nav.go(id);
        paint(root, info, nav);
      } catch (error) {
        mountError(root, error);
      }
    });
  });
}

function paint(root: HTMLElement, info: ShellInfo, nav: NavigationState): void {
  const attempt = renderWithBoundary(() => renderShell(info, nav));
  root.innerHTML = attempt.html;
  if (!attempt.ok) {
    return;
  }
  document.title = `${nav.currentItem.label} · ${PRODUCT_NAME}`;
  bindNavigation(root, info, nav);
}

async function loadShellInfo(): Promise<ShellInfo> {
  const bridge = getBridge();
  if (bridge) {
    return bridge.getShellInfo();
  }
  return {
    productName: PRODUCT_NAME,
    version: "0.0.0",
    dataDir: "",
    defaultRouteId: DEFAULT_ROUTE_ID,
    routes: createNavigationState().items,
    businessDbPath: "",
    schemaVersion: null,
    slice: null,
    sliceError: null,
  };
}

async function start(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("缺少 #root 挂载点。");
  }

  const bootError = readBootError();
  if (bootError) {
    mountError(root, bootError);
    document.title = `启动失败 · ${PRODUCT_NAME}`;
    return;
  }

  if (shouldCrashForTest()) {
    mountError(root, new Error("渲染层测试失败：故意触发错误边界。"));
    document.title = `页面错误 · ${PRODUCT_NAME}`;
    return;
  }

  try {
    const info = await loadShellInfo();
    const initial: RouteId = info.defaultRouteId;
    const nav = createNavigationState(initial);
    paint(root, info, nav);
  } catch (error) {
    mountError(root, error);
    document.title = `页面错误 · ${PRODUCT_NAME}`;
  }
}

window.addEventListener("error", (event) => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }
  event.preventDefault();
  mountError(root, event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  const root = document.getElementById("root");
  if (!root) {
    return;
  }
  mountError(root, event.reason);
});

void start();
