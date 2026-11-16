import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  FIXED_COUNCIL_SEATS,
  LAOZI_WUWEI_SEAT_ID,
  LUNYU_CONDUCT_SEAT_ID,
  SKILL_STATUS_DRAFT,
  SKILL_STATUS_PUBLISHED,
  SUNZI_DECISION_DEFAULT_QUOTE,
  SUNZI_DECISION_SEAT_ID,
  askCouncilSeat,
  createFixtureCouncilAdapter,
  establishCouncilSeats,
  listCouncilSeats,
  listFixedCouncilSeatIds,
  loadSkill,
  parseCouncilDistillMarkdown,
  runCouncilRoundtable,
  type CouncilAdapter,
} from "../src/index.ts";
import { createTempWorkspace, type TempWorkspace } from "./helpers.ts";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(TEST_DIR, "fixtures", "distill");
const CORE_SRC = path.resolve(TEST_DIR, "../src");
const DESKTOP_NAV = path.resolve(TEST_DIR, "../../desktop/src/shared/navigation.ts");
const DATA_MIGRATIONS = path.resolve(TEST_DIR, "../../data/src/migrations.ts");
const LOCKED_ORIGINALS = "/workspace/书籍蒸馏工作台";

const EXPECTED_FIXTURE_HASHES: Record<string, string> = {
  "孙子兵法_蒸馏结果.md": "87eb1f72705feab77f0991fc74a6e28a19ff499464f1efd1261e19f54bf40290",
  "论语_蒸馏结果.md": "ae5f54132998d9f615999d46920f4c16bb474eaf1263d4518d6dfb5d0f5c177a",
  "道德经_蒸馏结果.md": "ea6097e244e9952183778bfd0f6977ac6fa1c7b65657f1843e667ab01a4a378d",
};

const temps: TempWorkspace[] = [];

afterEach(() => {
  while (temps.length > 0) {
    temps.pop()?.cleanup();
  }
});

function openTemp() {
  const workspace = createTempWorkspace();
  temps.push(workspace);
  return workspace.open();
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function establish(db: ReturnType<typeof openTemp>["db"]) {
  return establishCouncilSeats({ db, fixtureDir: FIXTURE_DIR });
}

describe("COUNCIL-001 locked fixtures", () => {
  it("keeps the three accepted distill fixture hashes unchanged", () => {
    const sums = fs.readFileSync(path.join(FIXTURE_DIR, "SHA256SUMS"), "utf8");
    for (const [filename, expected] of Object.entries(EXPECTED_FIXTURE_HASHES)) {
      const actual = sha256File(path.join(FIXTURE_DIR, filename));
      assert.equal(actual, expected, `${filename} hash changed`);
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      assert.match(sums, new RegExp(`${expected}\\s+${escaped}\\s*$`, "m"));
    }
  });

  it("parses the locked five-segment structure and section 5 skills locally", () => {
    const sunzi = parseCouncilDistillMarkdown(
      fs.readFileSync(path.join(FIXTURE_DIR, "孙子兵法_蒸馏结果.md"), "utf8"),
      "孙子兵法_蒸馏结果.md",
    );
    assert.equal(sunzi.bookTitle, "孙子兵法");
    assert.ok(sunzi.sections.positioning.includes("核心"));
    assert.ok(sunzi.quotes.some((quote) => quote.text === SUNZI_DECISION_DEFAULT_QUOTE));
    assert.ok(sunzi.skills.some((skill) => skill.name === "孙子庙算决策评估"));

    const lunyu = parseCouncilDistillMarkdown(
      fs.readFileSync(path.join(FIXTURE_DIR, "论语_蒸馏结果.md"), "utf8"),
      "论语_蒸馏结果.md",
    );
    assert.equal(lunyu.bookTitle, "论语");
    assert.ok(lunyu.skills.some((skill) => skill.name === "论语君子七问处事顾问"));

    const laozi = parseCouncilDistillMarkdown(
      fs.readFileSync(path.join(FIXTURE_DIR, "道德经_蒸馏结果.md"), "utf8"),
      "道德经_蒸馏结果.md",
    );
    assert.equal(laozi.bookTitle, "道德经");
    assert.ok(laozi.skills.some((skill) => skill.name === "老子无为减法诊断"));
  });
});

describe("COUNCIL-001 fixed seats", () => {
  it("lists three stable seats, each bound to a draft Skill and none published", () => {
    const slice = openTemp();
    const registry = establish(slice.db);
    const seats = listCouncilSeats(registry);

    assert.deepEqual(
      seats.map((seat) => seat.seat_id),
      [SUNZI_DECISION_SEAT_ID, LUNYU_CONDUCT_SEAT_ID, LAOZI_WUWEI_SEAT_ID],
    );
    assert.deepEqual(listFixedCouncilSeatIds(), [
      SUNZI_DECISION_SEAT_ID,
      LUNYU_CONDUCT_SEAT_ID,
      LAOZI_WUWEI_SEAT_ID,
    ]);
    assert.equal(seats[0]?.name, "决策席");
    assert.deepEqual(seats[0]?.based_on, ["孙子庙算决策评估"]);
    assert.equal(seats[1]?.name, "处事席");
    assert.equal(seats[2]?.name, "无为席");

    for (const definition of FIXED_COUNCIL_SEATS) {
      const seat = seats.find((item) => item.seat_id === definition.seat_id);
      assert.ok(seat);
      assert.equal(seat.book_title, definition.book_title);
      assert.equal(seat.source_filename, definition.source_filename);
      assert.equal(seat.skill_status, "draft");
      const skill = loadSkill(slice.db, seat.skill_id);
      assert.equal(skill.status, SKILL_STATUS_DRAFT);
      assert.notEqual(skill.status, SKILL_STATUS_PUBLISHED);
      assert.equal(skill.name, definition.based_on[0]);
      assert.match(seat.system_prompt, new RegExp(definition.source_filename));
    }

    const published = slice.db
      .prepare(`SELECT COUNT(*) AS n FROM skills WHERE status = ?`)
      .get(SKILL_STATUS_PUBLISHED) as { n: number };
    assert.equal(published.n, 0);
  });

  it("reuses the same draft Skills when seats are established again", () => {
    const slice = openTemp();
    const first = establish(slice.db);
    const second = establish(slice.db);
    assert.deepEqual(
      first.seats.map((seat) => seat.skill_id),
      second.seats.map((seat) => seat.skill_id),
    );
    const count = slice.db.prepare(`SELECT COUNT(*) AS n FROM skills`).get() as { n: number };
    assert.equal(count.n, 3);
  });
});

describe("COUNCIL-001 single-seat and roundtable", () => {
  it("answers the decision seat from the Sunzi fixture with a 金句 and source filename", () => {
    const slice = openTemp();
    const registry = establish(slice.db);
    const seenFilenames: string[] = [];
    const adapter: CouncilAdapter = (context) => {
      seenFilenames.push(...context.sources.map((item) => item.filename));
      assert.equal(context.sources.length, 1);
      assert.equal(context.sources[0]?.filename, "孙子兵法_蒸馏结果.md");
      return createFixtureCouncilAdapter()(context);
    };

    const result = askCouncilSeat({
      registry,
      seatId: SUNZI_DECISION_SEAT_ID,
      question: "面对竞争，要不要先摸清对方再出手？",
      adapter,
    });

    assert.equal(result.utterance.source_filename, "孙子兵法_蒸馏结果.md");
    assert.match(result.utterance.content, /孙子兵法/);
    assert.match(result.utterance.content, /孙子兵法_蒸馏结果\.md/);
    assert.match(result.utterance.content, new RegExp(SUNZI_DECISION_DEFAULT_QUOTE));
    assert.equal(result.utterance.citations[0]?.quote, SUNZI_DECISION_DEFAULT_QUOTE);
    assert.equal(result.utterance.citations[0]?.source_filename, "孙子兵法_蒸馏结果.md");
    assert.deepEqual(seenFilenames, ["孙子兵法_蒸馏结果.md"]);
  });

  it("limits single-seat retrieval to that book's fixture even when a quote from another book is requested", () => {
    const slice = openTemp();
    const registry = establish(slice.db);
    const result = askCouncilSeat({
      registry,
      seatId: SUNZI_DECISION_SEAT_ID,
      question: "请用「己所不欲，勿施於人。」来分析这场竞争。",
      adapter: createFixtureCouncilAdapter(),
    });
    assert.equal(result.utterance.source_filename, "孙子兵法_蒸馏结果.md");
    assert.ok(!result.utterance.citations.some((item) => item.quote.includes("己所不欲，勿施於人。")));
    assert.ok(result.utterance.citations.every((item) => item.source_filename === "孙子兵法_蒸馏结果.md"));
  });

  it("runs a roundtable with at least two seats in sequence plus a summary, each with source_filename", () => {
    const slice = openTemp();
    const registry = establish(slice.db);
    const result = runCouncilRoundtable({
      registry,
      question: "面对一次高风险决策，各席如何建议？",
      adapter: createFixtureCouncilAdapter(),
      seatIds: [SUNZI_DECISION_SEAT_ID, LUNYU_CONDUCT_SEAT_ID, LAOZI_WUWEI_SEAT_ID],
    });

    assert.deepEqual(result.seat_ids, [
      SUNZI_DECISION_SEAT_ID,
      LUNYU_CONDUCT_SEAT_ID,
      LAOZI_WUWEI_SEAT_ID,
    ]);
    const seatTurns = result.utterances.filter((item) => item.kind === "seat");
    const summaries = result.utterances.filter((item) => item.kind === "summary");
    assert.ok(seatTurns.length >= 2);
    assert.equal(summaries.length, 1);
    assert.equal(result.utterances.length, seatTurns.length + 1);
    assert.deepEqual(
      seatTurns.map((item) => item.seat_id),
      result.seat_ids,
    );
    assert.equal(summaries[0]?.seat_id, null);
    assert.equal(summaries[0]?.speaker, "圆桌总结");

    for (const utterance of result.utterances) {
      assert.ok(utterance.source_filename, "every utterance must carry source_filename");
      assert.match(utterance.content, /来源：/);
    }
    assert.equal(seatTurns[0]?.source_filename, "孙子兵法_蒸馏结果.md");
    assert.equal(seatTurns[1]?.source_filename, "论语_蒸馏结果.md");
    assert.equal(seatTurns[2]?.source_filename, "道德经_蒸馏结果.md");
    assert.match(summaries[0]?.source_filename ?? "", /孙子兵法_蒸馏结果\.md/);
    assert.match(summaries[0]?.source_filename ?? "", /论语_蒸馏结果\.md/);
    assert.match(summaries[0]?.source_filename ?? "", /道德经_蒸馏结果\.md/);
    assert.ok((summaries[0]?.citations.length ?? 0) >= 2);
  });

  it("rejects citations that invent original text or escape the retrieval scope", () => {
    const slice = openTemp();
    const registry = establish(slice.db);

    assert.throws(
      () =>
        askCouncilSeat({
          registry,
          seatId: SUNZI_DECISION_SEAT_ID,
          question: "请引用一句书里没有的话。",
          adapter: () => ({
            content: "兵贵神速，先下手为强。",
            citations: [{ quote: "兵贵神速，先下手为强。", source_filename: "孙子兵法_蒸馏结果.md" }],
          }),
        }),
      /must not invent original text/,
    );

    assert.throws(
      () =>
        askCouncilSeat({
          registry,
          seatId: SUNZI_DECISION_SEAT_ID,
          question: "能不能引用论语？",
          adapter: () => ({
            content: "己所不欲，勿施於人。",
            citations: [{ quote: "己所不欲，勿施於人。", source_filename: "论语_蒸馏结果.md" }],
          }),
        }),
      /outside the allowed retrieval scope/,
    );
  });

  it("requires at least two seats for a roundtable", () => {
    const slice = openTemp();
    const registry = establish(slice.db);
    assert.throws(
      () =>
        runCouncilRoundtable({
          registry,
          question: "只有一席能开圆桌吗？",
          adapter: createFixtureCouncilAdapter(),
          seatIds: [SUNZI_DECISION_SEAT_ID],
        }),
      /at least two seats/,
    );
  });
});

describe("COUNCIL-001 isolation and contracts", () => {
  it("keeps council isolated from distill imports, schema migrations, and a sixth top-level nav item", () => {
    // DISTILL-001 may now own packages/core/src/distill/**; council must still use its local parser.
    const councilFiles = walkTs(path.join(CORE_SRC, "council"));
    for (const filePath of councilFiles) {
      const source = fs.readFileSync(filePath, "utf8");
      assert.doesNotMatch(source, /from ["']\.\.\/distill/);
      assert.doesNotMatch(source, /(?:import|require)\s*\([^)]*distill/);
      assert.doesNotMatch(source, /verified_by_user/);
      assert.doesNotMatch(source, /status:\s*SKILL_STATUS_PUBLISHED/);
      assert.doesNotMatch(source, /AnythingLLM/);
    }
    assert.match(fs.readFileSync(path.join(CORE_SRC, "council", "establish.ts"), "utf8"), /status:\s*SKILL_STATUS_DRAFT/);

    assert.ok(fs.existsSync(DATA_MIGRATIONS));
    const nav = fs.readFileSync(DESKTOP_NAV, "utf8");
    assert.match(nav, /export const DEFAULT_ROUTE_ID: RouteId = "chat"/);
    assert.match(nav, /"chat",\s*"library",\s*"knowledge",\s*"skills",\s*"settings"/);
    const routeIds = nav.match(/export const ROUTE_IDS = \[([\s\S]*?)\] as const/);
    assert.ok(routeIds);
    const ids = [...(routeIds[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(ids, ["chat", "library", "knowledge", "skills", "settings"]);
    assert.equal(ids.length, 5);

    for (const folder of ["依据", "交付"]) {
      const originalDir = path.join(LOCKED_ORIGINALS, folder);
      if (fs.existsSync(originalDir)) {
        assert.ok(fs.statSync(originalDir).isDirectory());
      }
    }
  });

  it("creates seat Skills with an explicit draft status rather than the tested default", () => {
    const establishSource = fs.readFileSync(path.join(CORE_SRC, "council", "establish.ts"), "utf8");
    assert.match(establishSource, /status:\s*SKILL_STATUS_DRAFT/);
    assert.doesNotMatch(establishSource, /status:\s*SKILL_STATUS_TESTED/);
    assert.doesNotMatch(fs.readFileSync(path.join(CORE_SRC, "skills.ts"), "utf8"), /council/);
  });
});

function walkTs(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkTs(full));
    } else if (entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}
