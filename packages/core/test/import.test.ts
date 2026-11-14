import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  PRINCIPLE_PARAGRAPH_ID,
  PRINCIPLE_SENTENCE,
  HOLLOW_ECHO_PARAGRAPH_ID,
  HOLLOW_ECHO_SENTENCE,
  UNCONFIRMED_LOCATION_LABEL,
} from "../src/index.ts";
import { createTempWorkspace, EPUB_FIXTURE, PDF_FIXTURE, type TempWorkspace } from "./helpers.ts";

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    const env = temps.pop();
    env?.cleanup();
  }
});

describe("licensed import and locators", () => {
  it("imports the licensed EPUB and locates [P1.3] and [P2.2]", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(EPUB_FIXTURE);
      assert.equal(book.title, "BookSkill Test Primer");
      assert.equal(book.author, "BookSkill Desktop Project");
      assert.equal(book.format, "epub");
      assert.equal(book.parseStatus, "parsed");
      assert.match(book.filePath, /library/);
      assert.doesNotMatch(book.filePath, /anythingllm|mintplex/i);

      const principle = workspace.findChunkByParagraphId(book, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(principle.location.confirmed, true);
      assert.equal(principle.location.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.match(principle.chapter ?? "", /Chapter 1/);
      assert.match(principle.text, new RegExp(PRINCIPLE_SENTENCE));
      assert.ok(principle.location.href?.includes("P1.3"));

      const echo = workspace.findChunkByParagraphId(book, HOLLOW_ECHO_PARAGRAPH_ID);
      assert.equal(echo.location.confirmed, true);
      assert.match(echo.chapter ?? "", /Chapter 2/);
      assert.match(echo.text, new RegExp(HOLLOW_ECHO_SENTENCE));

      const highlight = workspace.locateHighlight(book, "A knowledge card is valid only");
      assert.equal(highlight.location.paragraphId, PRINCIPLE_PARAGRAPH_ID);
      assert.notEqual(highlight.location.paragraphId, "P1.4");
    } finally {
      workspace.close();
    }
  });

  it("imports the licensed text PDF and keeps page plus paragraph locators", () => {
    const temp = createTempWorkspace();
    temps.push(temp);
    const workspace = temp.open();
    try {
      const book = workspace.importBook(PDF_FIXTURE);
      assert.equal(book.title, "BookSkill Test Primer");
      assert.equal(book.format, "pdf");

      const principle = workspace.findChunkByParagraphId(book, PRINCIPLE_PARAGRAPH_ID);
      assert.equal(principle.location.confirmed, true);
      assert.equal(principle.page, 1);
      assert.match(principle.chapter ?? "", /Chapter 1/);
      assert.match(principle.text, new RegExp(PRINCIPLE_SENTENCE));

      const echo = workspace.findChunkByParagraphId(book, HOLLOW_ECHO_PARAGRAPH_ID);
      assert.equal(echo.page, 1);
      assert.match(echo.text, new RegExp(HOLLOW_ECHO_SENTENCE));

      const ending = workspace.findChunkByParagraphId(book, "P2.5");
      assert.equal(ending.page, 2);

      const highlight = workspace.locateHighlight(book, "A knowledge card is valid only");
      assert.equal(highlight.location.paragraphId, PRINCIPLE_PARAGRAPH_ID);

      const unconfirmed = book.chunks.filter((chunk) => !chunk.location.confirmed);
      assert.ok(unconfirmed.length >= 1, "intro text should be unconfirmed");
      assert.equal(unconfirmed[0]?.location.unconfirmedLabel, UNCONFIRMED_LOCATION_LABEL);
    } finally {
      workspace.close();
    }
  });
});
