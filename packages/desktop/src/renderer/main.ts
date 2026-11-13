import {
  buildErrorPanelHTML,
  formatErrorMessage,
  renderWithBoundary,
} from "../shared/error-boundary.ts";
import {
  createNavigationState,
  DEFAULT_ROUTE_ID,
  type NavigationState,
  type RouteId,
} from "../shared/navigation.ts";
import { PRODUCT_NAME } from "../shared/product.ts";
import type { BookskillDesktopBridge, ShellInfo } from "../shared/shell-info.ts";
import { emptyLibraryUiState, type LibraryUiState } from "./read/types.ts";
import { jumpToAnnotation } from "./read/display.ts";
import { renderLibraryRoute } from "./read/view.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getBridge(): BookskillDesktopBridge | null {
  const fromWindow = (window as Window & { bookskillDesktop?: BookskillDesktopBridge }).bookskillDesktop;
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

type ShellState = {
  info: ShellInfo;
  nav: NavigationState;
  library: LibraryUiState;
};

function renderShell(info: ShellInfo, nav: NavigationState, library: LibraryUiState): string {
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
  const mainBody =
    view.id === "settings"
      ? `<dl class="meta-list">
          <div><dt>产品名称</dt><dd data-testid="settings-product-name">${info.productName}</dd></div>
          <div><dt>本机数据目录</dt><dd data-testid="data-dir">${info.dataDir || "尚未创建（启动时解析失败）"}</dd></div>
          <div><dt>业务库路径</dt><dd data-testid="business-db-path">${info.businessDbPath || "尚未解析"}</dd></div>
          <div><dt>Schema 版本</dt><dd data-testid="schema-version">${info.schemaVersion ?? "未知"}</dd></div>
          <div><dt>薄切片数据</dt><dd data-testid="slice-summary">${sliceSummary}</dd></div>
          <div><dt>版本</dt><dd>${info.version}</dd></div>
        </dl>`
      : view.id === "library"
        ? renderLibraryRoute(library)
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
    mainBody,
    `</section>`,
    `</main>`,
    `</div>`,
  ].join("");
}

function bindNavigation(root: HTMLElement, state: ShellState): void {
  root.querySelectorAll<HTMLButtonElement>("[data-nav-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-nav-id");
      if (!id) {
        return;
      }
      void (async () => {
        try {
          state.nav.go(id);
          if (id === "library") {
            await ensureLibraryBooks(state);
          }
          paint(root, state);
        } catch (error) {
          mountError(root, error);
        }
      })();
    });
  });
}

function bindLibrary(root: HTMLElement, state: ShellState): void {
  if (state.nav.current !== "library") {
    return;
  }

  root.querySelectorAll<HTMLButtonElement>("[data-testid='open-book']").forEach((button) => {
    button.addEventListener("click", () => {
      const bookId = button.getAttribute("data-book-id");
      const parseStatus = button.getAttribute("data-parse-status");
      if (!bookId) {
        return;
      }
      void (async () => {
        try {
          if (parseStatus !== "parsed") {
            state.library.error = "该书尚未解析完成，无法打开阅读器。";
            paint(root, state);
            return;
          }
          const bridge = getBridge();
          if (!bridge?.loadLibraryBook) {
            state.library.error = "阅读器尚未连接到本机书库。";
            paint(root, state);
            return;
          }
          state.library.openBook = await bridge.loadLibraryBook(bookId);
          state.library.annotations = (await bridge.loadAnnotations?.(bookId)) ?? [];
          state.library.draftSelection = "";
          state.library.draftNote = "";
          state.library.focusedChunkId = null;
          state.library.jumpMessage = null;
          state.library.error = null;
          paint(root, state);
        } catch (error) {
          state.library.error = formatErrorMessage(error);
          paint(root, state);
        }
      })();
    });
  });

  root.querySelector<HTMLButtonElement>("[data-testid='reader-back']")?.addEventListener("click", () => {
    state.library.openBook = null;
    state.library.annotations = [];
    state.library.draftSelection = "";
    state.library.draftNote = "";
    state.library.focusedChunkId = null;
    state.library.jumpMessage = null;
    state.library.error = null;
    paint(root, state);
  });

  const pages = root.querySelector("[data-testid='reader-pages']");
  const selectionBox = root.querySelector<HTMLTextAreaElement>("[data-testid='excerpt-selection']");
  pages?.addEventListener("mouseup", () => {
    const selected = window.getSelection()?.toString() ?? "";
    if (selectionBox && selected.trim()) {
      selectionBox.value = selected;
    }
  });

  root.querySelector<HTMLFormElement>("[data-testid='excerpt-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const book = state.library.openBook;
    if (!book) {
      return;
    }
    const selectedText = selectionBox?.value ?? "";
    const note = root.querySelector<HTMLTextAreaElement>("[data-testid='excerpt-note']")?.value ?? "";
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.createExcerpt) {
          throw new Error("阅读器尚未连接到本机书库。");
        }
        state.library.annotations = await bridge.createExcerpt({
          bookId: book.id,
          selectedText,
          note,
        });
        state.library.draftSelection = "";
        state.library.draftNote = "";
        state.library.jumpMessage = null;
        state.library.error = null;
        paint(root, state);
      } catch (error) {
        state.library.error = formatErrorMessage(error);
        state.library.draftSelection = selectedText;
        state.library.draftNote = note;
        paint(root, state);
      }
    })();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-testid='jump-excerpt']").forEach((button) => {
    button.addEventListener("click", () => {
      const book = state.library.openBook;
      const annotationId = button.getAttribute("data-annotation-id");
      if (!book || !annotationId) {
        return;
      }
      const annotation = state.library.annotations.find((entry) => entry.id === annotationId);
      if (!annotation) {
        return;
      }
      const jumped = jumpToAnnotation(book, annotation);
      state.library.focusedChunkId = jumped.focusedChunkId;
      state.library.jumpMessage = jumped.message;
      paint(root, state);
      if (jumped.focusedChunkId) {
        root.querySelector(`[data-chunk-id="${jumped.focusedChunkId}"]`)?.scrollIntoView({ block: "center" });
      }
    });
  });
}

function paint(root: HTMLElement, state: ShellState): void {
  const attempt = renderWithBoundary(() => renderShell(state.info, state.nav, state.library));
  root.innerHTML = attempt.html;
  if (!attempt.ok) {
    return;
  }
  document.title = `${state.nav.currentItem.label} · ${PRODUCT_NAME}`;
  bindNavigation(root, state);
  bindLibrary(root, state);
}

async function ensureLibraryBooks(state: ShellState): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.listLibraryBooks) {
    state.library.loaded = true;
    return;
  }
  try {
    state.library.books = await bridge.listLibraryBooks();
    if (!state.library.openBook) {
      state.library.error = null;
    }
  } catch (error) {
    state.library.error = formatErrorMessage(error);
  } finally {
    state.library.loaded = true;
  }
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
    const state: ShellState = {
      info,
      nav,
      library: emptyLibraryUiState(),
    };
    if (nav.current === "library") {
      await ensureLibraryBooks(state);
    }
    paint(root, state);
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
