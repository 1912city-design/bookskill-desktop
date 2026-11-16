import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, it } from "node:test";
import {
  KNOWLEDGE_CARD_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  draftKnowledgeCardFromLocator,
  openSliceWorkspace,
} from "@bookskill/core";
import {
  askOnProductPath,
  ensureShellSkill,
  loadLatestConversationView,
  SHELL_SKILL_NAME,
} from "../src/main/conversation-path.ts";
import { importLibraryBook } from "../src/main/library-import.ts";
import { renderChatRoute } from "../src/renderer/chat/view.ts";
import { emptyChatUiState } from "../src/renderer/chat/types.ts";
import { renderLibraryList, renderLibraryRoute } from "../src/renderer/read/view.ts";
import { initializeDataDir } from "../src/shared/data-layout.ts";

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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-path-"));
  leftovers.push(dataDir);
  initializeDataDir({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
  return dataDir;
}

function openWorkspace(dataDir: string) {
  return openSliceWorkspace({
    platform: "linux",
    env: { BOOKSKILL_DATA_DIR: dataDir },
  });
}

describe("PATH-001 library import and chat product path", () => {
  it("renders a file picker and import control in empty and populated library views", () => {
    const emptyHtml = renderLibraryList({ books: [], error: null });
    const populatedHtml = renderLibraryRoute({
      loaded: true,
      books: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          title: "BookSkill Test Primer",
          author: null,
          format: "epub",
          parseStatus: "parsed",
        },
      ],
      error: null,
      openBook: null,
      annotations: [],
      draftSelection: "",
      draftNote: "",
      focusedChunkId: null,
      jumpMessage: null,
    });

    for (const html of [emptyHtml, populatedHtml]) {
      assert.match(html, /<input type="file"/);
      assert.match(html, /data-testid="library-import"/);
      assert.match(html, /data-testid="library-import-file"/);
      assert.match(html, /accept="[^"]*\.pdf[^"]*\.epub/);
      assert.match(html, /导入许可的 PDF 或 EPUB/);
      assert.match(html, /选择文件/);
    }
    assert.match(emptyHtml, /data-testid="library-empty"/);
    assert.match(populatedHtml, /data-testid="library-book"/);
    assert.doesNotMatch(emptyHtml, /data-testid="library-book"/);
  });

  it("imports licensed EPUB and PDF fixtures through the same helper main will use", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const epub = importLibraryBook({
        db: workspace.db,
        dataDir,
        filePath: EPUB_FIXTURE,
      });
      assert.equal(epub.book.format, "epub");
      assert.equal(epub.book.parseStatus, "parsed");
      assert.match(epub.book.title, /BookSkill Test Primer/);
      assert.equal(epub.books.length, 1);
      assert.ok(fs.existsSync(path.join(dataDir, "db", "bookskill.sqlite")));

      const listHtml = renderLibraryList({ books: epub.books, error: null });
      assert.match(listHtml, /data-testid="library-book"/);
      assert.match(listHtml, /data-testid="library-import"/);
      assert.match(listHtml, /<input type="file"/);
      assert.match(listHtml, /BookSkill Test Primer/);

      const pdf = importLibraryBook({
        db: workspace.db,
        dataDir,
        filePath: PDF_FIXTURE,
      });
      assert.equal(pdf.book.format, "pdf");
      assert.equal(pdf.book.parseStatus, "parsed");
      assert.equal(pdf.books.length, 2);
      const pdfHtml = renderLibraryList({ books: pdf.books, error: null });
      assert.equal([...pdfHtml.matchAll(/data-testid="library-book"/g)].length, 2);
    } finally {
      workspace.close();
    }
  });

  it("renders a chat composer and sourced citations after import plus a first question", () => {
    const composer = renderChatRoute(emptyChatUiState());
    assert.match(composer, /data-testid="chat-form"/);
    assert.match(composer, /data-testid="chat-input"/);
    assert.match(composer, /<textarea[^>]*name="question"/);
    assert.match(composer, /data-testid="chat-send"/);

    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      importLibraryBook({
        db: workspace.db,
        dataDir,
        filePath: EPUB_FIXTURE,
      });
      const skill = ensureShellSkill(workspace.db);
      assert.ok(skill.skillId);
      const skillRow = workspace.db
        .prepare(`SELECT name, status FROM skills WHERE id = ?`)
        .get(skill.skillId) as { name: string; status: string };
      assert.equal(skillRow.name, SHELL_SKILL_NAME);
      assert.notEqual(skillRow.status, SKILL_STATUS_PUBLISHED);
      const version = workspace.loadSkillVersion(skill.skillVersionId);
      assert.equal(version.inputs.some((input) => input.required), false);

      const bookRow = workspace.db.prepare(`SELECT id FROM books LIMIT 1`).get() as { id: string } | undefined;
      assert.ok(bookRow);
      const draft = draftKnowledgeCardFromLocator({
        db: workspace.db,
        bookId: bookRow.id,
        paragraphId: "P1.3",
      });
      assert.equal(draft.status, KNOWLEDGE_CARD_STATUS_DRAFT);

      const conversation = askOnProductPath(workspace.db, {
        message: "这条原则的原书出处是什么？",
      });
      assert.ok(conversation.turns.length >= 2);
      const html = renderChatRoute({
        loaded: true,
        conversation,
        draftQuestion: "",
        error: null,
        statusMessage: null,
      });
      assert.match(html, /data-testid="chat-form"/);
      assert.match(html, /data-testid="chat-input"/);
      assert.match(html, /<textarea[^>]*name="question"/);
      assert.match(html, /data-testid="chat-source"/);
      assert.match(html, /\[P1\.3\]/);
      assert.match(html, /BookSkill Test Primer/);
      assert.match(html, /data-grounding="sourced"/);
      assert.match(html, /data-paragraph-id="P1\.3"/);

      const stillDraft = workspace.loadKnowledgeCard(draft.id);
      assert.equal(stillDraft.status, KNOWLEDGE_CARD_STATUS_DRAFT);
    } finally {
      workspace.close();
    }
  });

  it("reloads sourced turns from the same data directory after close and reopen", () => {
    const dataDir = createDataDir();
    const first = openWorkspace(dataDir);
    try {
      importLibraryBook({
        db: first.db,
        dataDir,
        filePath: EPUB_FIXTURE,
      });
      askOnProductPath(first.db, { message: "这条原则的原书出处是什么？" });
    } finally {
      first.close();
    }

    const second = openWorkspace(dataDir);
    try {
      const reloaded = loadLatestConversationView(second.db);
      assert.ok(reloaded);
      assert.ok(reloaded.turns.length >= 2);
      const html = renderChatRoute({
        loaded: true,
        conversation: reloaded,
        draftQuestion: "",
        error: null,
        statusMessage: null,
      });
      assert.match(html, /data-testid="chat-source"/);
      assert.match(html, /\[P1\.3\]/);
      assert.match(html, /BookSkill Test Primer/);
      const counts = second.snapshot();
      assert.ok(counts.books >= 1);
      assert.ok(counts.conversations >= 1);
    } finally {
      second.close();
    }
  });
});
