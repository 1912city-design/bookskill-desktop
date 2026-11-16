import { escapeHtml } from "../../shared/error-boundary.ts";
import {
  formatBookFormat,
  formatLocatorLabel,
  formatParseStatus,
  locatorFromAnnotation,
  locatorFromChunk,
} from "./display.ts";
import type { LibraryUiState, ReaderAnnotation, ReaderBook } from "./types.ts";

export type ReaderViewModel = {
  book: ReaderBook;
  annotations: ReaderAnnotation[];
  draftSelection?: string;
  draftNote?: string;
  focusedChunkId?: string | null;
  jumpMessage?: string | null;
  error?: string | null;
};

export function renderLibraryRoute(state: LibraryUiState): string {
  if (state.openBook) {
    return renderReaderView({
      book: state.openBook,
      annotations: state.annotations,
      draftSelection: state.draftSelection,
      draftNote: state.draftNote,
      focusedChunkId: state.focusedChunkId,
      jumpMessage: state.jumpMessage,
      error: state.error,
    });
  }
  return renderLibraryList(state);
}

function renderLibraryImportControls(): string {
  return [
    `<div class="library-import-bar">`,
    `<button type="button" class="library-import-button" data-testid="library-import">导入许可的 PDF 或 EPUB</button>`,
    `<label class="library-import-file-label" for="library-import-file">选择文件</label>`,
    `<input type="file" id="library-import-file" class="library-import-file" data-testid="library-import-file" accept=".pdf,.epub,application/pdf,application/epub+zip,.md,.markdown,.txt,text/markdown,text/plain">`,
    `</div>`,
  ].join("");
}

export function renderLibraryList(state: Pick<LibraryUiState, "books" | "error">): string {
  const error = state.error
    ? `<p class="library-error" data-testid="library-error" role="alert">${escapeHtml(state.error)}</p>`
    : "";
  const importControls = renderLibraryImportControls();
  if (state.books.length === 0) {
    return [
      `<div class="library-surface" data-testid="library-surface">`,
      error,
      `<p class="library-lead">从已导入的书籍打开阅读器，浏览章节、摘录并写下批注。</p>`,
      importControls,
      `<p class="library-empty" data-testid="library-empty">还没有已导入的书籍。请先导入许可的 PDF 或 EPUB。</p>`,
      `</div>`,
    ].join("");
  }

  const items = state.books
    .map((book) => {
      const format = formatBookFormat(book.format);
      const status = formatParseStatus(book.parseStatus);
      const author = book.author ? escapeHtml(book.author) : "作者未著录";
      const parsed = book.parseStatus === "parsed";
      return [
        `<li class="library-book" data-testid="library-book" data-book-id="${escapeHtml(book.id)}" data-parse-status="${escapeHtml(book.parseStatus)}">`,
        `<button type="button" class="library-book-open" data-testid="open-book" data-book-id="${escapeHtml(book.id)}" data-parse-status="${escapeHtml(book.parseStatus)}"${parsed ? "" : " data-disabled=\"true\""}>`,
        `<span class="library-book-title">${escapeHtml(book.title)}</span>`,
        `<span class="library-book-meta">${author} · ${escapeHtml(format)} · ${escapeHtml(status)}</span>`,
        `</button>`,
        `<button type="button" class="library-distill" data-testid="library-distill" data-book-id="${escapeHtml(book.id)}" data-book-title="${escapeHtml(book.title)}" data-parse-status="${escapeHtml(book.parseStatus)}"${parsed ? "" : " disabled"}>蒸馏</button>`,
        `</li>`,
      ].join("");
    })
    .join("");

  return [
    `<div class="library-surface" data-testid="library-surface">`,
    error,
    `<p class="library-lead">从已导入的书籍打开阅读器，浏览章节、摘录并写下批注。</p>`,
    importControls,
    `<ul class="library-book-list" data-testid="library-book-list">${items}</ul>`,
    `</div>`,
  ].join("");
}

export function renderReaderView(model: ReaderViewModel): string {
  const book = model.book;
  const focusedChunkId = model.focusedChunkId ?? null;
  const chunks = book.chunks
    .map((chunk) => {
      const locator = formatLocatorLabel(locatorFromChunk(chunk));
      const confirmed = chunk.location.confirmed ? "true" : "false";
      const focused = focusedChunkId === chunk.id ? "true" : "false";
      const paragraph = chunk.location.paragraphId ? escapeHtml(chunk.location.paragraphId) : "";
      return [
        `<section class="reader-chunk" data-testid="reader-chunk" data-chunk-id="${escapeHtml(chunk.id)}"`,
        ` data-paragraph-id="${paragraph}" data-confirmed="${confirmed}" data-focused="${focused}">`,
        `<p class="reader-locator" data-testid="chunk-locator" data-confirmed="${confirmed}">${escapeHtml(locator)}</p>`,
        `<p class="reader-chunk-text" data-testid="chunk-text">${escapeHtml(chunk.text)}</p>`,
        `</section>`,
      ].join("");
    })
    .join("");

  const annotations =
    model.annotations.length === 0
      ? `<p class="reader-empty-annotations" data-testid="annotation-empty">还没有摘录或批注。</p>`
      : `<ul class="annotation-list" data-testid="annotation-list">${model.annotations.map(renderAnnotation).join("")}</ul>`;

  const jump = model.jumpMessage
    ? `<p class="reader-jump-status" data-testid="jump-status" data-confirmed="false">${escapeHtml(model.jumpMessage)}</p>`
    : `<p class="reader-jump-status" data-testid="jump-status" hidden></p>`;

  const error = model.error
    ? `<p class="library-error" data-testid="reader-error" role="alert">${escapeHtml(model.error)}</p>`
    : "";

  const format = formatBookFormat(book.format);
  const author = book.author ? escapeHtml(book.author) : "作者未著录";

  return [
    `<div class="reader-surface" data-testid="reader-surface" data-book-id="${escapeHtml(book.id)}">`,
    `<div class="reader-toolbar">`,
    `<button type="button" class="reader-back" data-testid="reader-back">返回书库</button>`,
    `<button type="button" class="library-distill" data-testid="library-distill" data-book-id="${escapeHtml(book.id)}" data-book-title="${escapeHtml(book.title)}" data-parse-status="${escapeHtml(book.parseStatus)}">蒸馏</button>`,
    `</div>`,
    error,
    `<header class="reader-header">`,
    `<h2 data-testid="reader-title">${escapeHtml(book.title)}</h2>`,
    `<p class="reader-byline"><span data-testid="reader-author">${author}</span> · <span data-testid="reader-format">${escapeHtml(format)}</span></p>`,
    `</header>`,
    `<div class="reader-layout">`,
    `<article class="reader-pages" data-testid="reader-pages">${chunks}</article>`,
    `<aside class="reader-aside">`,
    `<form class="excerpt-form" data-testid="excerpt-form">`,
    `<label class="excerpt-label" for="excerpt-selection">从选区生成摘录</label>`,
    `<textarea id="excerpt-selection" class="excerpt-selection" data-testid="excerpt-selection" rows="4">${escapeHtml(model.draftSelection ?? "")}</textarea>`,
    `<label class="excerpt-label" for="excerpt-note">批注（可选）</label>`,
    `<textarea id="excerpt-note" class="excerpt-note" data-testid="excerpt-note" rows="3">${escapeHtml(model.draftNote ?? "")}</textarea>`,
    `<button type="submit" class="excerpt-submit" data-testid="create-excerpt">生成摘录</button>`,
    `</form>`,
    jump,
    annotations,
    `</aside>`,
    `</div>`,
    `</div>`,
  ].join("");
}

function renderAnnotation(annotation: ReaderAnnotation): string {
  const confirmed = annotation.confirmed ? "true" : "false";
  const locator = formatLocatorLabel(locatorFromAnnotation(annotation));
  const note = annotation.note
    ? `<p class="annotation-note" data-testid="annotation-note">${escapeHtml(annotation.note)}</p>`
    : "";
  return [
    `<li class="annotation-item" data-testid="annotation" data-annotation-id="${escapeHtml(annotation.id)}" data-confirmed="${confirmed}">`,
    `<p class="annotation-text" data-testid="annotation-text">${escapeHtml(annotation.text)}</p>`,
    `<p class="annotation-locator" data-testid="annotation-locator" data-confirmed="${confirmed}">${escapeHtml(locator)}</p>`,
    note,
    `<button type="button" class="annotation-jump" data-testid="jump-excerpt" data-annotation-id="${escapeHtml(annotation.id)}">跳回原书</button>`,
    `</li>`,
  ].join("");
}
