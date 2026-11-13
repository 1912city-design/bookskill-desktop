import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  UNCONFIRMED_LOCATION_LABEL,
  openSliceWorkspace,
} from "@bookskill/core";
import { initializeDataDir } from "../src/shared/data-layout.ts";
import {
  annotationsFilePath,
  createAnnotationStore,
} from "../src/renderer/read/annotations.ts";
import {
  READER_UNCONFIRMED_LOCATION_LABEL,
  formatLocatorLabel,
  jumpToAnnotation,
  locatorFromAnnotation,
  locatorFromChunk,
} from "../src/renderer/read/display.ts";
import { listImportedBooks } from "../src/renderer/read/library.ts";
import { createExcerptFromSelection } from "../src/renderer/read/locators.ts";
import { renderLibraryList, renderReaderView } from "../src/renderer/read/view.ts";

const leftovers: string[] = [];
const FIXTURES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../fixtures",
);
const EPUB_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.epub");
const PDF_FIXTURE = path.join(FIXTURES_DIR, "bookskill-test-primer.pdf");

after(() => {
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-read-"));
  leftovers.push(dataDir);
  initializeDataDir({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
  return dataDir;
}

function unconfirmedLocatorLabels(html: string, testId: string): string[] {
  const pattern = new RegExp(
    `data-testid="${testId}"[^>]*data-confirmed="false"[^>]*>([^<]*)`,
    "g",
  );
  return [...html.matchAll(pattern)].map((match) => match[1] ?? "");
}

describe("READ-001 reader locators, excerpts, and annotations", () => {
  it("keeps the contract unconfirmed label identical to @bookskill/core", () => {
    assert.equal(READER_UNCONFIRMED_LOCATION_LABEL, UNCONFIRMED_LOCATION_LABEL);
    assert.equal(
      formatLocatorLabel({ confirmed: false, page: 1, paragraphId: "P9.9" }),
      UNCONFIRMED_LOCATION_LABEL,
    );
    assert.doesNotMatch(
      formatLocatorLabel({ confirmed: false, page: 1, paragraphId: "P9.9" }),
      /P9\.9|第 1 页/,
    );
  });

  it("shows chapter and paragraph locators for an imported licensed EPUB", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      assert.equal(book.format, "epub");
      assert.equal(book.parseStatus, "parsed");

      const listed = listImportedBooks(workspace.db);
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.id, book.id);
      assert.equal(listed[0]?.format, "epub");

      const libraryHtml = renderLibraryList({ books: listed, error: null });
      assert.match(libraryHtml, /data-testid="library-surface"/);
      assert.match(libraryHtml, /BookSkill Test Primer/);
      assert.match(libraryHtml, /EPUB/);

      const html = renderReaderView({ book, annotations: [] });
      assert.match(html, /data-testid="reader-surface"/);
      assert.match(html, /Chapter 1/);
      assert.match(html, /P1\.3/);
      assert.match(html, /Chapter 2/);
      assert.match(html, /P2\.2/);

      const principle = book.chunks.find((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
      assert.ok(principle);
      assert.equal(principle.location.confirmed, true);
      assert.match(formatLocatorLabel(locatorFromChunk(principle)), /Chapter 1/);
      assert.match(formatLocatorLabel(locatorFromChunk(principle)), /P1\.3/);
    } finally {
      workspace.close();
    }
  });

  it("shows page and paragraph locators for an imported licensed text PDF", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(PDF_FIXTURE);
      assert.equal(book.format, "pdf");

      const html = renderReaderView({ book, annotations: [] });
      assert.match(html, /第 1 页/);
      assert.match(html, /第 2 页/);
      assert.match(html, /P1\.3/);
      assert.match(html, /P2\.5/);
      assert.match(html, /Chapter 1/);

      const unconfirmed = unconfirmedLocatorLabels(html, "chunk-locator");
      assert.ok(unconfirmed.length >= 1, "intro text should be unconfirmed");
      for (const label of unconfirmed) {
        assert.equal(label, UNCONFIRMED_LOCATION_LABEL);
        assert.doesNotMatch(label, /P\d+\.\d+|第 \d+ 页/);
      }
    } finally {
      workspace.close();
    }
  });

  it("creates an excerpt from a selection and jumps back to the original location", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      const excerpt = createExcerptFromSelection({
        book,
        selectedText: "A knowledge card is valid only",
        note: "有效知识卡必须引用段落编号。",
      });
      assert.equal(excerpt.confirmed, true);
      assert.equal(excerpt.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.ok(excerpt.chunkId);
      assert.match(excerpt.chapter ?? "", /Chapter 1/);
      assert.match(excerpt.text, /A knowledge card is valid only/);
      assert.equal(excerpt.note, "有效知识卡必须引用段落编号。");

      const jumped = jumpToAnnotation(book, excerpt);
      assert.equal(jumped.confirmed, true);
      assert.equal(jumped.focusedChunkId, excerpt.chunkId);
      assert.equal(jumped.message, null);

      const html = renderReaderView({
        book,
        annotations: [excerpt],
        focusedChunkId: jumped.focusedChunkId,
      });
      assert.match(html, new RegExp(`data-chunk-id="${excerpt.chunkId}"[^>]*data-focused="true"`));
      assert.match(html, /有效知识卡必须引用段落编号。/);
      assert.match(html, /跳回原书/);
      const locator = formatLocatorLabel(locatorFromAnnotation(excerpt));
      assert.match(locator, /P1\.3/);
      assert.match(html, /P1\.3/);
    } finally {
      workspace.close();
    }
  });

  it("marks unmatched or unconfirmed sources as unconfirmed and never fakes a precise locator", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    try {
      const book = workspace.importBook(PDF_FIXTURE);

      const missing = createExcerptFromSelection({
        book,
        selectedText: "this sentence does not appear in the licensed primer xyzzy-unmatched-highlight",
      });
      assert.equal(missing.confirmed, false);
      assert.equal(missing.chunkId, null);
      assert.equal(missing.paragraphId, null);
      assert.equal(missing.page, null);
      assert.equal(missing.chapter, null);
      assert.equal(missing.unconfirmedLabel, UNCONFIRMED_LOCATION_LABEL);

      const intro = createExcerptFromSelection({
        book,
        selectedText: "created solely as licensed test data for the BookSkill Desktop project",
      });
      assert.equal(intro.confirmed, false);
      assert.equal(intro.paragraphId, null);
      assert.equal(intro.page, null);
      assert.equal(intro.unconfirmedLabel, UNCONFIRMED_LOCATION_LABEL);

      const missingJump = jumpToAnnotation(book, missing);
      assert.equal(missingJump.confirmed, false);
      assert.equal(missingJump.focusedChunkId, null);
      assert.equal(missingJump.message, UNCONFIRMED_LOCATION_LABEL);

      const introJump = jumpToAnnotation(book, intro);
      assert.equal(introJump.confirmed, false);
      assert.equal(introJump.focusedChunkId, null);
      assert.equal(introJump.message, UNCONFIRMED_LOCATION_LABEL);

      const html = renderReaderView({
        book,
        annotations: [missing, intro],
        jumpMessage: introJump.message,
      });
      const annotationLabels = unconfirmedLocatorLabels(html, "annotation-locator");
      assert.equal(annotationLabels.length, 2);
      for (const label of annotationLabels) {
        assert.equal(label, UNCONFIRMED_LOCATION_LABEL);
        assert.doesNotMatch(label, /P\d+\.\d+|第 \d+ 页/);
      }
      assert.match(html, /data-testid="jump-status"[^>]*data-confirmed="false"[^>]*>来源定位未确认/);
      assert.doesNotMatch(
        html,
        /data-testid="annotation-locator" data-confirmed="true"/,
      );
    } finally {
      workspace.close();
    }
  });

  it("persists annotations in the BookSkill data directory across a fresh store instance", () => {
    const dataDir = createDataDir();
    const workspace = openSliceWorkspace({
      platform: "linux",
      env: { BOOKSKILL_DATA_DIR: dataDir },
    });
    let bookId = "";
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      bookId = book.id;
      const excerpt = createExcerptFromSelection({
        book,
        selectedText: PRINCIPLE_SENTENCE,
        note: "退出后仍应能读到这条批注。",
      });
      const first = createAnnotationStore(dataDir);
      first.save(excerpt);

      const storedPath = first.pathFor(book.id);
      assert.equal(storedPath, annotationsFilePath(dataDir, book.id));
      assert.equal(storedPath, path.join(dataDir, "library", book.id, "annotations.json"));
      assert.match(storedPath, /library/);
      assert.doesNotMatch(storedPath, /anythingllm|mintplex/i);
      assert.ok(fs.existsSync(storedPath));
    } finally {
      workspace.close();
    }

    const reopened = createAnnotationStore(dataDir);
    const loaded = reopened.load(bookId);
    assert.equal(loaded.length, 1);
    const saved = loaded[0];
    assert.ok(saved);
    assert.equal(saved.confirmed, true);
    assert.equal(saved.paragraphId, PRINCIPLE_PARAGRAPH_ID);
    assert.equal(saved.note, "退出后仍应能读到这条批注。");
    assert.match(saved.text, new RegExp(PRINCIPLE_SENTENCE));
    assert.doesNotMatch(reopened.pathFor(bookId), /anythingllm|mintplex/i);
  });
});
