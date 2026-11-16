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
import { emptyKnowledgeUiState, type KnowledgeUiState } from "./knowledge/types.ts";
import { renderKnowledgeRoute } from "./knowledge/view.ts";
import { emptyRelationsUiState, type RelationsUiState } from "./relations/types.ts";
import { renderRelationsRoute } from "./relations/view.ts";
import { applySearchKeyboard } from "./search/keyboard.ts";
import { emptySearchUiState, type SearchUiState } from "./search/types.ts";
import { renderSearchPanel } from "./search/view.ts";
import { emptyChatUiState, type ChatUiState } from "./chat/types.ts";
import { renderChatRoute } from "./chat/view.ts";

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
  knowledge: KnowledgeUiState;
  search: SearchUiState;
  relations: RelationsUiState;
  chat: ChatUiState;
};

function renderShell(info: ShellInfo, nav: NavigationState, library: LibraryUiState, knowledge: KnowledgeUiState, search: SearchUiState, relations: RelationsUiState, chat: ChatUiState): string {
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
        : view.id === "knowledge"
          ? `${renderKnowledgeRoute(knowledge)}${renderRelationsRoute(relations, knowledge.cards)}`
        : view.id === "chat"
          ? renderChatRoute(chat)
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
    renderSearchPanel(search),
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
          if (id === "knowledge") {
            await ensureKnowledgeCards(state);
            await ensureRelations(state);
          }
          if (id === "chat") {
            await ensureChat(state);
          }
          paint(root, state);
        } catch (error) {
          mountError(root, error);
        }
      })();
    });
  });
}

async function applyImportedBooks(root: HTMLElement, state: ShellState, books: LibraryUiState["books"]): Promise<void> {
  state.library.books = books;
  state.library.error = null;
  try {
    const bridge = getBridge();
    if (bridge?.getShellInfo) {
      state.info = await bridge.getShellInfo();
    }
  } catch {
    // Slice summary refresh is optional; the imported list is the source of truth.
  }
  paint(root, state);
}

function bindLibraryImport(root: HTMLElement, state: ShellState): void {
  root.querySelector<HTMLButtonElement>("[data-testid='library-import']")?.addEventListener("click", () => {
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.chooseAndImport) {
          throw new Error("书库尚未连接到导入接口。");
        }
        const result = await bridge.chooseAndImport();
        if (result.canceled) {
          return;
        }
        await applyImportedBooks(root, state, result.books);
      } catch (error) {
        state.library.error = formatErrorMessage(error);
        await ensureLibraryBooks(state);
        paint(root, state);
      }
    })();
  });

  const fileInput = root.querySelector<HTMLInputElement>("[data-testid='library-import-file']");
  fileInput?.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) {
      return;
    }
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.importBookFile) {
          throw new Error("书库尚未连接到导入接口。");
        }
        const books = await bridge.importBookFile(file);
        fileInput.value = "";
        await applyImportedBooks(root, state, books);
      } catch (error) {
        fileInput.value = "";
        state.library.error = formatErrorMessage(error);
        await ensureLibraryBooks(state);
        paint(root, state);
      }
    })();
  });
}

function bindLibrary(root: HTMLElement, state: ShellState): void {
  if (state.nav.current !== "library") {
    return;
  }

  bindLibraryImport(root, state);

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


function readEditorFields(root: HTMLElement): {
  title: string;
  content: string;
  conditions: string;
  limitations: string;
} {
  return {
    title: root.querySelector<HTMLInputElement>("[data-testid='edit-title']")?.value ?? "",
    content: root.querySelector<HTMLTextAreaElement>("[data-testid='edit-content']")?.value ?? "",
    conditions: root.querySelector<HTMLTextAreaElement>("[data-testid='edit-conditions']")?.value ?? "",
    limitations: root.querySelector<HTMLTextAreaElement>("[data-testid='edit-limitations']")?.value ?? "",
  };
}

function applyEditorDraft(state: ShellState, fields: ReturnType<typeof readEditorFields>): void {
  state.knowledge.editTitle = fields.title;
  state.knowledge.editContent = fields.content;
  state.knowledge.editConditions = fields.conditions;
  state.knowledge.editLimitations = fields.limitations;
}

function selectKnowledgeCard(state: ShellState, cardId: string | null): void {
  state.knowledge.selectedCardId = cardId;
  const selected = state.knowledge.cards.find((card) => card.id === cardId);
  state.knowledge.editTitle = selected?.title ?? "";
  state.knowledge.editContent = selected?.content ?? "";
  state.knowledge.editConditions = selected?.conditions ?? "";
  state.knowledge.editLimitations = selected?.limitations ?? "";
  if (state.knowledge.mergeTargetId === cardId) {
    state.knowledge.mergeTargetId = "";
  }
}

function bindKnowledge(root: HTMLElement, state: ShellState): void {
  if (state.nav.current !== "knowledge") {
    return;
  }

  root.querySelectorAll<HTMLButtonElement>("[data-testid='open-card']").forEach((button) => {
    button.addEventListener("click", () => {
      const cardId = button.getAttribute("data-card-id");
      if (!cardId) {
        return;
      }
      selectKnowledgeCard(state, cardId);
      state.knowledge.error = null;
      paint(root, state);
    });
  });

  root.querySelector<HTMLFormElement>("[data-testid='draft-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const bookId = root.querySelector<HTMLSelectElement>("[data-testid='draft-book']")?.value ?? "";
    const paragraphId = root.querySelector<HTMLInputElement>("[data-testid='draft-paragraph']")?.value ?? "";
    state.knowledge.draftBookId = bookId;
    state.knowledge.draftParagraphId = paragraphId;
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.draftKnowledgeCard) {
          throw new Error("知识库尚未连接到本机业务库。");
        }
        state.knowledge.cards = await bridge.draftKnowledgeCard({ bookId, paragraphId });
        const created = state.knowledge.cards[0];
        selectKnowledgeCard(state, created?.id ?? null);
        state.knowledge.statusMessage = "已生成知识卡草稿。确认之前它仍是 draft。";
        state.knowledge.locatorProof = [];
        state.knowledge.error = null;
        await ensureRelations(state);
        paint(root, state);
      } catch (error) {
        state.knowledge.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });

  root.querySelector<HTMLFormElement>("[data-testid='knowledge-editor']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const cardId = state.knowledge.selectedCardId;
    if (!cardId) {
      return;
    }
    const fields = readEditorFields(root);
    applyEditorDraft(state, fields);
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.updateKnowledgeCard) {
          throw new Error("知识库尚未连接到本机业务库。");
        }
        state.knowledge.cards = await bridge.updateKnowledgeCard({ cardId, ...fields });
        selectKnowledgeCard(state, cardId);
        state.knowledge.statusMessage = "已保存编辑，状态未改变。";
        state.knowledge.error = null;
        paint(root, state);
      } catch (error) {
        state.knowledge.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });

  root.querySelector<HTMLButtonElement>("[data-testid='confirm-card']")?.addEventListener("click", () => {
    const cardId = state.knowledge.selectedCardId;
    if (!cardId) {
      return;
    }
    const fields = readEditorFields(root);
    applyEditorDraft(state, fields);
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.confirmKnowledgeCard) {
          throw new Error("知识库尚未连接到本机业务库。");
        }
        state.knowledge.cards = await bridge.confirmKnowledgeCard({ cardId, ...fields });
        selectKnowledgeCard(state, cardId);
        state.knowledge.statusMessage = "已确认，状态为 verified_by_user。来源关系保持不变。";
        state.knowledge.error = null;
        paint(root, state);
      } catch (error) {
        state.knowledge.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });

  root.querySelector<HTMLButtonElement>("[data-testid='delete-card']")?.addEventListener("click", () => {
    const cardId = state.knowledge.selectedCardId;
    if (!cardId) {
      return;
    }
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.deleteKnowledgeCard) {
          throw new Error("知识库尚未连接到本机业务库。");
        }
        const result = await bridge.deleteKnowledgeCard(cardId);
        state.knowledge.cards = result.cards;
        state.knowledge.locatorProof = result.locatorProof;
        selectKnowledgeCard(state, null);
        state.knowledge.statusMessage = "知识卡已删除。原书仍在，书中定位仍可用。";
        state.knowledge.error = null;
        await ensureRelations(state);
        paint(root, state);
      } catch (error) {
        state.knowledge.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });

  root.querySelector<HTMLFormElement>("[data-testid='merge-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const survivingCardId = state.knowledge.selectedCardId;
    const absorbedCardId = root.querySelector<HTMLSelectElement>("[data-testid='merge-target']")?.value ?? "";
    state.knowledge.mergeTargetId = absorbedCardId;
    if (!survivingCardId) {
      return;
    }
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.mergeKnowledgeCards) {
          throw new Error("知识库尚未连接到本机业务库。");
        }
        const result = await bridge.mergeKnowledgeCards({ survivingCardId, absorbedCardId });
        state.knowledge.cards = result.cards;
        state.knowledge.locatorProof = result.locatorProof;
        selectKnowledgeCard(state, survivingCardId);
        state.knowledge.mergeTargetId = "";
        state.knowledge.statusMessage = "已合并知识卡。被吸收的卡片已删除；合并不会自动把草稿变为已确认。";
        state.knowledge.error = null;
        await ensureRelations(state);
        paint(root, state);
      } catch (error) {
        state.knowledge.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });
}

function applyRelationLists(state: ShellState, lists: { suggested: RelationsUiState["suggested"]; confirmed: RelationsUiState["confirmed"] }): void {
  state.relations.suggested = lists.suggested;
  state.relations.confirmed = lists.confirmed;
}

function bindRelations(root: HTMLElement, state: ShellState): void {
  if (state.nav.current !== "knowledge") {
    return;
  }

  root.querySelector<HTMLFormElement>("[data-testid='suggest-relation-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const fromCardId = root.querySelector<HTMLSelectElement>("[data-testid='relation-from']")?.value ?? "";
    const toCardId = root.querySelector<HTMLSelectElement>("[data-testid='relation-to']")?.value ?? "";
    const relationType = root.querySelector<HTMLSelectElement>("[data-testid='relation-type-input']")?.value ?? "";
    state.relations.fromCardId = fromCardId;
    state.relations.toCardId = toCardId;
    state.relations.relationType = relationType;
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.suggestRelation) {
          throw new Error("关系建议尚未连接到本机业务库。");
        }
        const lists = await bridge.suggestRelation({ fromCardId, toCardId, relationType });
        applyRelationLists(state, lists);
        state.relations.statusMessage = "已生成关系建议。确认之前它不会出现在已确认列表中。";
        state.relations.error = null;
        paint(root, state);
      } catch (error) {
        state.relations.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-testid='confirm-relation']").forEach((button) => {
    button.addEventListener("click", () => {
      const relationId = button.getAttribute("data-relation-id");
      if (!relationId) {
        return;
      }
      void (async () => {
        try {
          const bridge = getBridge();
          if (!bridge?.confirmRelation) {
            throw new Error("关系确认尚未连接到本机业务库。");
          }
          const lists = await bridge.confirmRelation(relationId);
          applyRelationLists(state, lists);
          state.relations.statusMessage = "已确认关系，状态为 verified_by_user。";
          state.relations.error = null;
          paint(root, state);
        } catch (error) {
          state.relations.error = formatErrorMessage(error);
          paint(root, state);
        }
      })();
    });
  });

  root.querySelectorAll<HTMLButtonElement>("[data-testid='reject-relation']").forEach((button) => {
    button.addEventListener("click", () => {
      const relationId = button.getAttribute("data-relation-id");
      if (!relationId) {
        return;
      }
      void (async () => {
        try {
          const bridge = getBridge();
          if (!bridge?.rejectRelation) {
            throw new Error("关系驳回尚未连接到本机业务库。");
          }
          const lists = await bridge.rejectRelation(relationId);
          applyRelationLists(state, lists);
          state.relations.statusMessage = "已驳回该建议，不会成为正式关系。";
          state.relations.error = null;
          paint(root, state);
        } catch (error) {
          state.relations.error = formatErrorMessage(error);
          paint(root, state);
        }
      })();
    });
  });
}

function bindSearch(root: HTMLElement, state: ShellState): void {
  root.querySelector<HTMLFormElement>("[data-testid='search-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = root.querySelector<HTMLInputElement>("[data-testid='search-query']")?.value ?? "";
    const modeInput = root.querySelector<HTMLInputElement>("input[name='search-mode']:checked");
    const mode = modeInput?.value === "semantic" ? "semantic" : "fulltext";
    state.search.query = query;
    state.search.mode = mode;
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.searchLibrary) {
          throw new Error("搜索尚未连接到本机业务库。");
        }
        const result = await bridge.searchLibrary({ query, mode });
        state.search.results = result.results;
        state.search.fallback = result.fallback;
        state.search.searched = true;
        state.search.selectedIndex = result.results.length > 0 ? 0 : -1;
        state.search.keyboardActive = false;
        state.search.statusMessage =
          result.results.length > 0 ? `共 ${result.results.length} 条结果。` : "没有匹配结果。";
        state.search.error = null;
        paint(root, state);
      } catch (error) {
        state.search.error = formatErrorMessage(error);
        state.search.searched = true;
        paint(root, state);
      }
    })();
  });

  root.querySelectorAll<HTMLButtonElement>("[data-testid='search-jump']").forEach((button) => {
    button.addEventListener("click", () => {
      const hit = button.closest("[data-testid='search-hit']");
      if (!hit) {
        return;
      }
      const bookId = hit.getAttribute("data-book-id");
      const chunkId = hit.getAttribute("data-chunk-id");
      const cardId = hit.getAttribute("data-card-id");
      const kind = hit.getAttribute("data-record-kind");
      void (async () => {
        try {
          if (kind === "knowledge_card" && cardId) {
            state.nav.go("knowledge");
            await ensureKnowledgeCards(state);
            const selected = state.knowledge.cards.find((card) => card.id === cardId);
            if (selected) {
              state.knowledge.selectedCardId = selected.id;
              state.knowledge.editTitle = selected.title;
              state.knowledge.editContent = selected.content;
              state.knowledge.editConditions = selected.conditions ?? "";
              state.knowledge.editLimitations = selected.limitations ?? "";
            }
            state.search.statusMessage = "已跳转到知识卡来源。";
            paint(root, state);
            return;
          }
          if (!bookId) {
            return;
          }
          const bridge = getBridge();
          if (!bridge?.loadLibraryBook) {
            throw new Error("阅读器尚未连接到本机书库。");
          }
          state.nav.go("library");
          await ensureLibraryBooks(state);
          state.library.openBook = await bridge.loadLibraryBook(bookId);
          state.library.annotations = (await bridge.loadAnnotations?.(bookId)) ?? [];
          state.library.focusedChunkId = chunkId || null;
          state.library.jumpMessage = chunkId ? "已跳转到搜索来源定位。" : "已打开书籍，但缺少可跳转的切片。";
          state.library.error = null;
          state.search.statusMessage = "已跳转到书中来源。";
          paint(root, state);
          if (chunkId) {
            root.querySelector(`[data-chunk-id="${chunkId}"]`)?.scrollIntoView({ block: "center" });
          }
        } catch (error) {
          state.search.error = formatErrorMessage(error);
          paint(root, state);
        }
      })();
    });
  });

  root.querySelector<HTMLElement>("[data-testid='search-surface']")?.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Enter") {
      return;
    }
    const next = applySearchKeyboard(state.search, key);
    if (!next.handled) {
      return;
    }
    event.preventDefault();
    state.search = next.state;
    if (next.action === "jump") {
      const selected = root.querySelector<HTMLButtonElement>(
        "[data-testid='search-hit'][data-selected='true'] [data-testid='search-jump']",
      );
      selected?.click();
      return;
    }
    paint(root, state);
  });
}

function paint(root: HTMLElement, state: ShellState): void {
  const attempt = renderWithBoundary(() => renderShell(state.info, state.nav, state.library, state.knowledge, state.search, state.relations, state.chat));
  root.innerHTML = attempt.html;
  if (!attempt.ok) {
    return;
  }
  document.title = `${state.nav.currentItem.label} · ${PRODUCT_NAME}`;
  bindNavigation(root, state);
  bindLibrary(root, state);
  bindKnowledge(root, state);
  bindSearch(root, state);
  bindRelations(root, state);
  bindChat(root, state);
}

function bindChat(root: HTMLElement, state: ShellState): void {
  if (state.nav.current !== "chat") {
    return;
  }
  root.querySelector<HTMLFormElement>("[data-testid='chat-form']")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = root.querySelector<HTMLTextAreaElement>("[data-testid='chat-input']")?.value ?? "";
    state.chat.draftQuestion = message;
    void (async () => {
      try {
        const bridge = getBridge();
        if (!bridge?.ask) {
          throw new Error("对话尚未连接到本机业务库。");
        }
        state.chat.conversation = await bridge.ask({
          message,
          conversationId: state.chat.conversation?.id,
        });
        state.chat.draftQuestion = "";
        state.chat.statusMessage = null;
        state.chat.error = null;
        try {
          if (bridge.getShellInfo) {
            state.info = await bridge.getShellInfo();
          }
        } catch {
          // Slice summary refresh is optional after a turn is persisted.
        }
        paint(root, state);
      } catch (error) {
        state.chat.error = formatErrorMessage(error);
        paint(root, state);
      }
    })();
  });
}

async function ensureChat(state: ShellState): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.listConversations && !bridge?.loadConversation) {
    state.chat.loaded = true;
    return;
  }
  try {
    if (state.chat.conversation && bridge.loadConversation) {
      state.chat.conversation = await bridge.loadConversation(state.chat.conversation.id);
    } else if (bridge.listConversations && bridge.loadConversation) {
      const listed = await bridge.listConversations();
      const latest = listed[0];
      state.chat.conversation = latest ? await bridge.loadConversation(latest.id) : null;
    }
    state.chat.error = null;
  } catch (error) {
    state.chat.error = formatErrorMessage(error);
  } finally {
    state.chat.loaded = true;
  }
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


async function ensureKnowledgeCards(state: ShellState): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.listKnowledgeCards) {
    state.knowledge.loaded = true;
    return;
  }
  try {
    const [cards, books] = await Promise.all([
      bridge.listKnowledgeCards(),
      bridge.listKnowledgeBooks ? bridge.listKnowledgeBooks() : Promise.resolve(state.knowledge.books),
    ]);
    state.knowledge.cards = cards;
    state.knowledge.books = books;
    if (state.knowledge.selectedCardId && !cards.some((card) => card.id === state.knowledge.selectedCardId)) {
      selectKnowledgeCard(state, null);
    } else if (state.knowledge.selectedCardId) {
      selectKnowledgeCard(state, state.knowledge.selectedCardId);
    }
    if (!state.knowledge.draftBookId && books[0]?.id) {
      state.knowledge.draftBookId = books[0].id;
    }
    state.knowledge.error = null;
  } catch (error) {
    state.knowledge.error = formatErrorMessage(error);
  } finally {
    state.knowledge.loaded = true;
  }
}

async function ensureRelations(state: ShellState): Promise<void> {
  const bridge = getBridge();
  if (!bridge?.listSuggestedRelations && !bridge?.listConfirmedRelations) {
    state.relations.loaded = true;
    return;
  }
  try {
    const [suggested, confirmed] = await Promise.all([
      bridge.listSuggestedRelations ? bridge.listSuggestedRelations() : Promise.resolve(state.relations.suggested),
      bridge.listConfirmedRelations ? bridge.listConfirmedRelations() : Promise.resolve(state.relations.confirmed),
    ]);
    state.relations.suggested = suggested;
    state.relations.confirmed = confirmed;
    if (!state.relations.fromCardId && state.knowledge.cards[0]?.id) {
      state.relations.fromCardId = state.knowledge.cards[0].id;
    }
    if (!state.relations.toCardId && state.knowledge.cards[1]?.id) {
      state.relations.toCardId = state.knowledge.cards[1].id;
    }
    state.relations.error = null;
  } catch (error) {
    state.relations.error = formatErrorMessage(error);
  } finally {
    state.relations.loaded = true;
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
      knowledge: emptyKnowledgeUiState(),
      search: emptySearchUiState(),
      relations: emptyRelationsUiState(),
      chat: emptyChatUiState(),
    };
    if (nav.current === "library") {
      await ensureLibraryBooks(state);
    }
    if (nav.current === "knowledge") {
      await ensureKnowledgeCards(state);
      await ensureRelations(state);
    }
    if (nav.current === "chat") {
      await ensureChat(state);
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
