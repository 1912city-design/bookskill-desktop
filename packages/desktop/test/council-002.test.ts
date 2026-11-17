import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, it } from "node:test";
import { createFixtureCouncilAdapter, openSliceWorkspace, type CouncilAdapter } from "@bookskill/core";
import {
  NO_COUNCIL_ADAPTER_REASON,
  askDesktopCouncilSeat,
  enableFixtureCouncilAdapter,
  listDesktopCouncilSeats,
  runDesktopCouncilRoundtable,
  setCouncilAdapter,
} from "../src/main/council.ts";
import { emptyCouncilUiState } from "../src/renderer/council/types.ts";
import { renderCouncilPanel } from "../src/renderer/council/view.ts";
import { DEFAULT_ROUTE_ID, NAV_ITEMS } from "../src/shared/navigation.ts";
import { initializeDataDir } from "../src/shared/data-layout.ts";

const leftovers: string[] = [];
const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const WORKTREE_ROOT = path.resolve(TEST_DIR, "../../..");
const FIXTURE_DIR = path.join(WORKTREE_ROOT, "packages/core/test/fixtures/distill");

const LOCKED_FILES = {
  "蒸馏提示词模板.md": "7719c8aecbb38833e25e6bb529606dc82f86ca4eb9d2c1d1c0a9c7a1813091e2",
  "孙子兵法_蒸馏结果.md": "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290",
  "论语_蒸馏结果.md": "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a",
  "道德经_蒸馏结果.md": "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d",
} as const;

const SUNZI_DEFAULT_QUOTE =
  "知彼知己，百戰不殆；不知彼而知己，一勝一負；不知彼不知己，每戰必殆。";

after(() => {
  setCouncilAdapter(null);
  for (const dir of leftovers) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

before(() => {
  setCouncilAdapter(null);
});

function createDataDir(): string {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "bookskill-desktop-council-"));
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

function sha256File(name: string): string {
  return createHash("sha256").update(fs.readFileSync(path.join(FIXTURE_DIR, name))).digest("hex");
}

function utteranceBlocks(html: string): string[] {
  return [...html.matchAll(/data-testid="council-utterance"[\s\S]*?<\/li>/g)].map((match) => match[0] ?? "");
}

describe("COUNCIL-002 desktop seats and roundtable", { concurrency: false }, () => {
  it("leaves locked distill fixture SHA-256 hashes unchanged", () => {
    for (const [name, expected] of Object.entries(LOCKED_FILES)) {
      assert.equal(sha256File(name), expected, name);
    }
    const sums = fs.readFileSync(path.join(FIXTURE_DIR, "SHA256SUMS"), "utf8");
    for (const [name, expected] of Object.entries(LOCKED_FILES)) {
      assert.match(sums, new RegExp(`${expected}\\s+${name}`));
    }
  });

  it("lists three stable draft seats with stable ids and source filenames", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const listed = listDesktopCouncilSeats({ db: workspace.db, fixtureDir: FIXTURE_DIR });
      assert.deepEqual(
        listed.seats.map((seat) => seat.seat_id),
        ["sunzi-decision", "lunyu-conduct", "laozi-wuwei"],
      );
      assert.deepEqual(
        listed.seats.map((seat) => seat.name),
        ["决策席", "处事席", "无为席"],
      );
      assert.deepEqual(
        listed.seats.map((seat) => seat.source_filename),
        ["孙子兵法_蒸馏结果.md", "论语_蒸馏结果.md", "道德经_蒸馏结果.md"],
      );
      assert.ok(listed.seats.every((seat) => seat.skill_status === "draft"));
      assert.ok(listed.seats.every((seat) => seat.skill_id.length > 0));

      const html = renderCouncilPanel({
        ...emptyCouncilUiState(),
        loaded: true,
        seats: listed.seats,
        selectedSeatId: "sunzi-decision",
        adapterKind: listed.adapterKind,
      });
      assert.match(html, /data-testid="council-panel"/);
      assert.match(html, /data-testid="council-seat-sunzi-decision"/);
      assert.match(html, /data-testid="council-seat-lunyu-conduct"/);
      assert.match(html, /data-testid="council-seat-laozi-wuwei"/);
      assert.match(html, /data-testid="council-question"/);
      assert.match(html, /data-testid="council-ask"/);
      assert.match(html, /data-testid="council-roundtable"/);
      assert.match(html, /孙子兵法_蒸馏结果\.md/);
      assert.match(html, /论语_蒸馏结果\.md/);
      assert.match(html, /道德经_蒸馏结果\.md/);
      assert.match(html, /data-skill-status="draft"/);
    } finally {
      workspace.close();
    }
  });

  it("answers the sunzi seat with an injected fixture adapter and displays source_filename", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const result = askDesktopCouncilSeat({
        db: workspace.db,
        fixtureDir: FIXTURE_DIR,
        seatId: "sunzi-decision",
        question: "面对竞争，要不要先摸清对方再出手？",
        adapter: createFixtureCouncilAdapter(),
      });
      assert.equal(result.ok, true);
      if (!result.ok) {
        return;
      }
      assert.equal(result.adapterKind, "injected");
      assert.equal(result.seat.seat_id, "sunzi-decision");
      assert.equal(result.utterance.source_filename, "孙子兵法_蒸馏结果.md");
      assert.match(result.utterance.content, /孙子兵法_蒸馏结果\.md/);
      assert.match(result.utterance.content, new RegExp(SUNZI_DEFAULT_QUOTE));
      assert.equal(result.utterance.citations[0]?.quote, SUNZI_DEFAULT_QUOTE);
      assert.equal(result.utterance.citations[0]?.source_filename, "孙子兵法_蒸馏结果.md");

      const html = renderCouncilPanel({
        ...emptyCouncilUiState(),
        loaded: true,
        seats: [
          {
            seat_id: result.seat.seat_id,
            name: result.seat.name,
            book_title: result.seat.book_title,
            source_filename: result.seat.source_filename,
            skill_status: "draft",
            skill_id: result.seat.skill_id,
            based_on: result.seat.based_on,
          },
        ],
        selectedSeatId: "sunzi-decision",
        utterances: [result.utterance],
        adapterKind: result.adapterKind,
      });
      assert.match(html, /data-testid="council-utterance"/);
      assert.match(html, /data-testid="council-source-filename"/);
      assert.match(html, /孙子兵法_蒸馏结果\.md/);
      assert.match(html, /data-testid="council-citation"/);
      assert.match(html, new RegExp(SUNZI_DEFAULT_QUOTE));
      assert.doesNotMatch(html, /data-adapter-kind="live"/);
    } finally {
      workspace.close();
    }
  });

  it("runs a roundtable of at least two seats plus a summary, each showing source_filename", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const result = runDesktopCouncilRoundtable({
        db: workspace.db,
        fixtureDir: FIXTURE_DIR,
        question: "面对一次高风险决策，各席如何建议？",
        adapter: createFixtureCouncilAdapter(),
        seatIds: ["sunzi-decision", "lunyu-conduct", "laozi-wuwei"],
      });
      assert.equal(result.ok, true);
      if (!result.ok) {
        return;
      }
      const seats = result.utterances.filter((item) => item.kind === "seat");
      const summaries = result.utterances.filter((item) => item.kind === "summary");
      assert.ok(seats.length >= 2);
      assert.equal(summaries.length, 1);
      assert.equal(summaries[0]?.speaker, "圆桌总结");
      for (const utterance of result.utterances) {
        assert.ok(utterance.source_filename, "every utterance must carry source_filename");
      }
      assert.equal(seats[0]?.source_filename, "孙子兵法_蒸馏结果.md");
      assert.equal(seats[1]?.source_filename, "论语_蒸馏结果.md");
      assert.equal(seats[2]?.source_filename, "道德经_蒸馏结果.md");

      const html = renderCouncilPanel({
        ...emptyCouncilUiState(),
        loaded: true,
        utterances: result.utterances,
        adapterKind: result.adapterKind,
      });
      const blocks = utteranceBlocks(html);
      assert.equal(blocks.length, result.utterances.length);
      assert.match(html, /data-testid="council-summary"/);
      for (const utterance of result.utterances) {
        assert.match(html, new RegExp(`data-testid="council-source-filename">${utterance.source_filename.replaceAll(".", "\\.")}`));
      }
    } finally {
      workspace.close();
    }
  });

  it("fails visibly when no generation adapter is configured and does not pretend a live model succeeded", () => {
    setCouncilAdapter(null);
    const previous = process.env.BOOKSKILL_COUNCIL_ADAPTER;
    delete process.env.BOOKSKILL_COUNCIL_ADAPTER;
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const result = askDesktopCouncilSeat({
        db: workspace.db,
        fixtureDir: FIXTURE_DIR,
        seatId: "sunzi-decision",
        question: "未配置适配器时能否假装成功？",
      });
      assert.equal(result.ok, false);
      if (result.ok) {
        return;
      }
      assert.equal(result.adapterKind, "none");
      assert.equal(result.error, NO_COUNCIL_ADAPTER_REASON);

      const html = renderCouncilPanel({
        ...emptyCouncilUiState(),
        loaded: true,
        error: result.error,
        adapterKind: "none",
      });
      assert.match(html, /data-testid="council-error"/);
      assert.match(html, /未配置生成适配器/);
      assert.doesNotMatch(html, /data-testid="council-utterance"/);
      assert.doesNotMatch(html, /data-adapter-kind="live"/);
    } finally {
      if (previous === undefined) {
        delete process.env.BOOKSKILL_COUNCIL_ADAPTER;
      } else {
        process.env.BOOKSKILL_COUNCIL_ADAPTER = previous;
      }
      workspace.close();
    }
  });

  it("rejects invented citations instead of presenting them as confirmed quotes", () => {
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const invented = "兵贵神速，先下手为强。";
      const adapter: CouncilAdapter = () => ({
        content: invented,
        citations: [{ quote: invented, source_filename: "孙子兵法_蒸馏结果.md" }],
      });
      const result = askDesktopCouncilSeat({
        db: workspace.db,
        fixtureDir: FIXTURE_DIR,
        seatId: "sunzi-decision",
        question: "请引用一句书里没有的话。",
        adapter,
      });
      assert.equal(result.ok, false);
      if (result.ok) {
        return;
      }
      assert.match(result.error, /must not invent original text/);

      const html = renderCouncilPanel({
        ...emptyCouncilUiState(),
        loaded: true,
        error: `引用未确认：${result.error}`,
        adapterKind: "injected",
      });
      assert.match(html, /data-testid="council-error"/);
      assert.match(html, /未确认/);
      assert.doesNotMatch(html, /data-testid="council-citation"/);
      assert.doesNotMatch(html, /data-testid="council-utterance"/);
    } finally {
      workspace.close();
    }
  });

  it("can explicitly enable the fixture demo adapter without labeling it as a live model success", () => {
    setCouncilAdapter(null);
    const kind = enableFixtureCouncilAdapter();
    assert.equal(kind, "fixture");
    const dataDir = createDataDir();
    const workspace = openWorkspace(dataDir);
    try {
      const result = askDesktopCouncilSeat({
        db: workspace.db,
        fixtureDir: FIXTURE_DIR,
        seatId: "sunzi-decision",
        question: "启用夹具演示适配器后能否提问？",
      });
      assert.equal(result.ok, true);
      if (!result.ok) {
        return;
      }
      assert.equal(result.adapterKind, "fixture");
      const html = renderCouncilPanel({
        ...emptyCouncilUiState(),
        utterances: [result.utterance],
        adapterKind: "fixture",
      });
      assert.match(html, /夹具演示适配器（非在线模型）/);
      assert.doesNotMatch(html, /data-adapter-kind="live"/);
    } finally {
      setCouncilAdapter(null);
      workspace.close();
    }
  });

  it("keeps five nav items, defaults to chat, and does not value-import the core barrel from renderer/council", () => {
    assert.equal(NAV_ITEMS.length, 5);
    assert.equal(DEFAULT_ROUTE_ID, "chat");
    assert.deepEqual(
      NAV_ITEMS.map((item) => item.id),
      ["chat", "library", "knowledge", "skills", "settings"],
    );

    const navigation = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/shared/navigation.ts"), "utf8");
    assert.match(navigation, /export const DEFAULT_ROUTE_ID: RouteId = "chat"/);
    assert.doesNotMatch(navigation, /id: "council"/);

    const councilDir = path.join(WORKTREE_ROOT, "packages/desktop/src/renderer/council");
    for (const file of fs.readdirSync(councilDir)) {
      if (!file.endsWith(".ts")) {
        continue;
      }
      const source = fs.readFileSync(path.join(councilDir, file), "utf8");
      assert.doesNotMatch(source, /import\s+(?!type\b)[^;]*from\s+["']@bookskill\/core["']/);
    }

    const preload = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/preload.cjs"), "utf8");
    assert.match(preload, /listCouncilSeats:/);
    assert.match(preload, /askCouncilSeat:/);
    assert.match(preload, /runCouncilRoundtable:/);
    assert.match(preload, /enableFixtureCouncilAdapter:/);
    assert.match(preload, /council:listSeats/);
    assert.match(preload, /council:askSeat/);
    assert.match(preload, /council:runRoundtable/);

    const main = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/main/main.ts"), "utf8");
    assert.match(main, /council:listSeats/);
    assert.match(main, /council:askSeat/);
    assert.match(main, /council:runRoundtable/);
    assert.match(main, /DEFAULT_ROUTE_ID/);
    assert.doesNotMatch(main, /workspace Pin/);

    const rendererMain = fs.readFileSync(path.join(WORKTREE_ROOT, "packages/desktop/src/renderer/main.ts"), "utf8");
    assert.match(rendererMain, /renderCouncilPanel/);
    assert.match(rendererMain, /DEFAULT_ROUTE_ID/);
  });
});
