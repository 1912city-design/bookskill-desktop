import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  HOLLOW_ECHO_PARAGRAPH_ID,
  HOLLOW_ECHO_SENTENCE,
  IMPORT_STATUS_FILENAME,
  ImportParseError,
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  importBook,
  listFailedImports,
  loadImportStatus,
  retryImport,
} from "../src/index.ts";
import {
  EPUB_FIXTURE,
  MD_FIXTURE,
  PDF_FIXTURE,
  TXT_FIXTURE,
  createTempWorkspace,
  type TempWorkspace,
} from "./helpers.ts";

const temps: TempWorkspace[] = [];
const leftoverFiles: string[] = [];

afterEach(() => {
  while (temps.length > 0) {
    const env = temps.pop();
    env?.cleanup();
  }
  while (leftoverFiles.length > 0) {
    const target = leftoverFiles.pop();
    if (target) {
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
});

function openTemp() {
  const temp = createTempWorkspace();
  temps.push(temp);
  return temp;
}

function countBooks(db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown } }): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM books`).get() as { n: number };
  return row.n;
}

function countChunks(
  db: { prepare: (sql: string) => { get: (...args: unknown[]) => unknown } },
  bookId?: string,
): number {
  if (bookId) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM source_chunks WHERE book_id = ?`).get(bookId) as {
      n: number;
    };
    return row.n;
  }
  const row = db.prepare(`SELECT COUNT(*) AS n FROM source_chunks`).get() as { n: number };
  return row.n;
}

function libraryDirs(dataDir: string): string[] {
  const root = path.join(dataDir, "library");
  if (!fs.existsSync(root)) {
    return [];
  }
  return fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory());
}

function writeTempSource(name: string, contents: string | Buffer): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-import-src-"));
  leftoverFiles.push(dir);
  const filePath = path.join(dir, name);
  fs.writeFileSync(filePath, contents);
  return filePath;
}

function assertOwnLibraryPath(filePath: string): void {
  assert.match(filePath, /library/);
  assert.doesNotMatch(filePath, /anythingllm|anything-llm|mintplex/i);
}

function assertPrimerLocators(book: {
  chunks: Array<{
    location: { paragraphId: string | null };
    text: string;
    chapter: string | null;
  }>;
}): void {
  const principle = book.chunks.find((chunk) => chunk.location.paragraphId === PRINCIPLE_PARAGRAPH_ID);
  const echo = book.chunks.find((chunk) => chunk.location.paragraphId === HOLLOW_ECHO_PARAGRAPH_ID);
  assert.ok(principle, `missing locator ${PRINCIPLE_PARAGRAPH_ID}`);
  assert.ok(echo, `missing locator ${HOLLOW_ECHO_PARAGRAPH_ID}`);
  assert.match(principle.text, new RegExp(PRINCIPLE_SENTENCE));
  assert.match(echo.text, new RegExp(HOLLOW_ECHO_SENTENCE));
  assert.match(principle.chapter ?? "", /Chapter 1/);
  assert.match(echo.chapter ?? "", /Chapter 2/);
}

describe("IMPORT-001 markdown and txt import", () => {
  it("imports the licensed Markdown fixture into the BookSkill library", () => {
    const temp = openTemp();
    const workspace = temp.open();
    try {
      const book = workspace.importBook(MD_FIXTURE);
      assert.equal(book.title, "BookSkill Test Primer");
      assert.equal(book.author, null);
      assert.equal(book.format, "markdown");
      assert.equal(book.parseStatus, "parsed");
      assertOwnLibraryPath(book.filePath);
      assert.ok(book.filePath.startsWith(path.join(temp.dataDir, "library", book.id)));
      assertPrimerLocators(book);
      assert.equal(countBooks(workspace.db), 1);
    } finally {
      workspace.close();
    }
  });

  it("imports the licensed plain-text fixture into the BookSkill library", () => {
    const temp = openTemp();
    const workspace = temp.open();
    try {
      const book = workspace.importBook(TXT_FIXTURE);
      assert.equal(book.title, "BookSkill Test Primer");
      assert.equal(book.author, null);
      assert.equal(book.format, "txt");
      assert.equal(book.parseStatus, "parsed");
      assertOwnLibraryPath(book.filePath);
      assert.ok(book.filePath.startsWith(path.join(temp.dataDir, "library", book.id)));
      assertPrimerLocators(book);
    } finally {
      workspace.close();
    }
  });
});

describe("IMPORT-001 dedup", () => {
  it("recognizes a second import of the same Markdown bytes and keeps a single book row", () => {
    const temp = openTemp();
    const workspace = temp.open();
    try {
      const first = workspace.importBook(MD_FIXTURE);
      const second = workspace.importBook(MD_FIXTURE);
      assert.equal(second.id, first.id);
      assert.equal(second.contentHash, first.contentHash);
      assert.equal(second.parseStatus, "parsed");
      assert.equal(countBooks(workspace.db), 1);
      assert.deepEqual(libraryDirs(temp.dataDir), [first.id]);
    } finally {
      workspace.close();
    }
  });

  it("treats PDF, EPUB, Markdown, and TXT primer files as distinct books", () => {
    const temp = openTemp();
    const workspace = temp.open();
    try {
      const pdf = workspace.importBook(PDF_FIXTURE);
      const epub = workspace.importBook(EPUB_FIXTURE);
      const markdown = workspace.importBook(MD_FIXTURE);
      const txt = workspace.importBook(TXT_FIXTURE);
      const ids = new Set([pdf.id, epub.id, markdown.id, txt.id]);
      assert.equal(ids.size, 4);
      const hashes = new Set([pdf.contentHash, epub.contentHash, markdown.contentHash, txt.contentHash]);
      assert.equal(hashes.size, 4);
      assert.equal(countBooks(workspace.db), 4);
    } finally {
      workspace.close();
    }
  });

  it("does not create a second row when the same failed bytes are imported again", () => {
    const temp = openTemp();
    const workspace = temp.open();
    const broken = writeTempSource("empty.md", "");
    try {
      let bookId = "";
      try {
        importBook({ db: workspace.db, dataDir: temp.dataDir, filePath: broken });
        assert.fail("expected the empty markdown import to throw");
      } catch (error) {
        assert.ok(error instanceof ImportParseError);
        bookId = error.bookId;
      }
      const again = importBook({ db: workspace.db, dataDir: temp.dataDir, filePath: broken });
      assert.equal(again.id, bookId);
      assert.equal(again.parseStatus, "failed");
      assert.equal(again.chunks.length, 0);
      assert.equal(countBooks(workspace.db), 1);
      assert.deepEqual(libraryDirs(temp.dataDir), [bookId]);
    } finally {
      workspace.close();
    }
  });
});

describe("IMPORT-001 failure status and retry", () => {
  it("persists a queryable failed import and leaves an existing successful book untouched", () => {
    const temp = openTemp();
    const workspace = temp.open();
    const broken = writeTempSource("garbage.md", Buffer.alloc(0));
    try {
      const ok = workspace.importBook(EPUB_FIXTURE);
      const okChunks = countChunks(workspace.db, ok.id);
      assert.ok(okChunks > 0);
      const okHash = ok.contentHash;

      let failedId = "";
      try {
        importBook({ db: workspace.db, dataDir: temp.dataDir, filePath: broken });
        assert.fail("expected the broken markdown import to throw");
      } catch (error) {
        assert.ok(error instanceof ImportParseError);
        failedId = error.bookId;
        assert.match(error.message, /Failed to parse markdown/);
      }

      const failed = workspace.loadBook(failedId);
      assert.equal(failed.parseStatus, "failed");
      assert.equal(failed.chunks.length, 0);
      assert.equal(failed.title, "garbage.md");
      assertOwnLibraryPath(failed.filePath);
      assert.ok(fs.existsSync(failed.filePath));

      const status = loadImportStatus({ db: workspace.db, dataDir: temp.dataDir, bookId: failedId });
      assert.equal(status.bookId, failedId);
      assert.equal(status.parseStatus, "failed");
      assert.ok(status.error && status.error.length > 0);
      assert.equal(status.retryCount, 0);
      assert.ok(fs.existsSync(path.join(temp.dataDir, "library", failedId, IMPORT_STATUS_FILENAME)));

      const listed = listFailedImports({ db: workspace.db, dataDir: temp.dataDir });
      assert.equal(listed.length, 1);
      assert.equal(listed[0]?.id, failedId);
      assert.equal(listed[0]?.parseStatus, "failed");
      assert.equal(listed[0]?.error, status.error);

      const stillOk = workspace.loadBook(ok.id);
      assert.equal(stillOk.parseStatus, "parsed");
      assert.equal(stillOk.contentHash, okHash);
      assert.equal(stillOk.chunks.length, okChunks);
      assert.equal(countBooks(workspace.db), 2);
      assert.equal(countChunks(workspace.db, failedId), 0);
    } finally {
      workspace.close();
    }
  });

  it("retries a failed item after the stored original is replaced, without changing siblings", () => {
    const temp = openTemp();
    const workspace = temp.open();
    const broken = writeTempSource("retry-me.md", "");
    try {
      const sibling = workspace.importBook(PDF_FIXTURE);
      const siblingChunks = sibling.chunks.map((chunk) => ({
        id: chunk.id,
        text: chunk.text,
        contentHash: chunk.contentHash,
        ordinal: chunk.ordinal,
      }));

      let failedId = "";
      try {
        importBook({ db: workspace.db, dataDir: temp.dataDir, filePath: broken });
        assert.fail("expected the empty markdown import to throw");
      } catch (error) {
        assert.ok(error instanceof ImportParseError);
        failedId = error.bookId;
      }

      const failed = workspace.loadBook(failedId);
      fs.copyFileSync(MD_FIXTURE, failed.filePath);

      const retried = retryImport({
        db: workspace.db,
        dataDir: temp.dataDir,
        bookId: failedId,
      });
      assert.equal(retried.id, failedId);
      assert.equal(retried.parseStatus, "parsed");
      assert.equal(retried.format, "markdown");
      assert.equal(retried.title, "BookSkill Test Primer");
      assert.equal(retried.author, null);
      assertPrimerLocators(retried);
      assert.ok(retried.chunks.length > 0);

      const status = loadImportStatus({ db: workspace.db, dataDir: temp.dataDir, bookId: failedId });
      assert.equal(status.parseStatus, "parsed");
      assert.equal(status.error, null);
      assert.equal(status.retryCount, 1);

      assert.equal(listFailedImports({ db: workspace.db, dataDir: temp.dataDir }).length, 0);

      const stillSibling = workspace.loadBook(sibling.id);
      assert.equal(stillSibling.parseStatus, "parsed");
      assert.equal(stillSibling.contentHash, sibling.contentHash);
      assert.deepEqual(
        stillSibling.chunks.map((chunk) => ({
          id: chunk.id,
          text: chunk.text,
          contentHash: chunk.contentHash,
          ordinal: chunk.ordinal,
        })),
        siblingChunks,
      );
    } finally {
      workspace.close();
    }
  });

  it("keeps siblings untouched when a retry still fails", () => {
    const temp = openTemp();
    const workspace = temp.open();
    const broken = writeTempSource("still-broken.md", "");
    try {
      const sibling = workspace.importBook(EPUB_FIXTURE);
      const siblingChunkCount = countChunks(workspace.db, sibling.id);

      let failedId = "";
      try {
        importBook({ db: workspace.db, dataDir: temp.dataDir, filePath: broken });
        assert.fail("expected the empty markdown import to throw");
      } catch (error) {
        assert.ok(error instanceof ImportParseError);
        failedId = error.bookId;
      }

      try {
        retryImport({ db: workspace.db, dataDir: temp.dataDir, bookId: failedId });
        assert.fail("expected retry of the empty markdown to throw");
      } catch (error) {
        assert.ok(error instanceof ImportParseError);
        assert.equal(error.bookId, failedId);
      }

      const failed = workspace.loadBook(failedId);
      assert.equal(failed.parseStatus, "failed");
      assert.equal(failed.chunks.length, 0);
      assert.equal(failed.title, "still-broken.md");

      const status = loadImportStatus({ db: workspace.db, dataDir: temp.dataDir, bookId: failedId });
      assert.equal(status.parseStatus, "failed");
      assert.equal(status.retryCount, 1);
      assert.ok(status.error && status.error.length > 0);

      const stillSibling = workspace.loadBook(sibling.id);
      assert.equal(stillSibling.parseStatus, "parsed");
      assert.equal(stillSibling.chunks.length, siblingChunkCount);
      assert.equal(countBooks(workspace.db), 2);
    } finally {
      workspace.close();
    }
  });

  it("persists failure for a truncated PDF and does not write AnythingLLM paths", () => {
    const temp = openTemp();
    const workspace = temp.open();
    const truncated = writeTempSource("truncated.pdf", Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n", "utf8"));
    try {
      let failedId = "";
      try {
        importBook({ db: workspace.db, dataDir: temp.dataDir, filePath: truncated });
        assert.fail("expected the truncated PDF import to throw");
      } catch (error) {
        assert.ok(error instanceof ImportParseError);
        failedId = error.bookId;
        assert.match(error.message, /Failed to parse pdf/);
      }
      const failed = workspace.loadBook(failedId);
      assert.equal(failed.parseStatus, "failed");
      assertOwnLibraryPath(failed.filePath);
      const listed = listFailedImports({ db: workspace.db, dataDir: temp.dataDir });
      assert.equal(listed.length, 1);
      assert.doesNotMatch(listed[0]?.filePath ?? "", /anythingllm|mintplex/i);
    } finally {
      workspace.close();
    }
  });
});
