import {
  askCouncilSeat,
  createFixtureCouncilAdapter,
  establishCouncilSeats,
  listCouncilSeats,
  runCouncilRoundtable,
  type CouncilAdapter,
  type CouncilSeat,
  type CouncilUtterance,
} from "@bookskill/core";
import fs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import type {
  CouncilAdapterKind,
  CouncilAskBridgeResult,
  CouncilListBridgeResult,
  CouncilRoundtableBridgeResult,
  CouncilSeatView,
  CouncilUtteranceView,
} from "../renderer/council/types.ts";

const MAIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MAIN_DIR, "../../../..");

export const DEFAULT_COUNCIL_FIXTURE_DIR = path.join(
  REPO_ROOT,
  "packages/core/test/fixtures/distill",
);

export const NO_COUNCIL_ADAPTER_REASON =
  "未配置生成适配器，无法向智囊团席位提问或召开圆桌。请显式启用夹具演示适配器，或注入只引用夹具原文的适配器。";

type ConfiguredAdapter = {
  adapter: CouncilAdapter;
  kind: Exclude<CouncilAdapterKind, "none">;
};

let configuredAdapter: ConfiguredAdapter | null = null;

export function setCouncilAdapter(adapter: CouncilAdapter | null, kind: Exclude<CouncilAdapterKind, "none"> = "injected"): void {
  configuredAdapter = adapter ? { adapter, kind } : null;
}

export function enableFixtureCouncilAdapter(): Exclude<CouncilAdapterKind, "none"> {
  configuredAdapter = { adapter: createFixtureCouncilAdapter(), kind: "fixture" };
  return "fixture";
}

export function getCouncilAdapterKind(): CouncilAdapterKind {
  if (configuredAdapter) {
    return configuredAdapter.kind;
  }
  if (process.env.BOOKSKILL_COUNCIL_ADAPTER === "fixture") {
    return "fixture";
  }
  return "none";
}

export function resolveCouncilFixtureDir(explicit?: string): string {
  const dir = explicit ?? DEFAULT_COUNCIL_FIXTURE_DIR;
  if (!fs.existsSync(dir)) {
    throw new Error(`智囊团夹具目录不存在：${dir}`);
  }
  return dir;
}

export type ListDesktopCouncilSeatsOptions = {
  db: DatabaseSync;
  fixtureDir?: string;
};

export type AskDesktopCouncilSeatOptions = {
  db: DatabaseSync;
  fixtureDir?: string;
  seatId: string;
  question: string;
  adapter?: CouncilAdapter | null;
  useFixtureAdapter?: boolean;
};

export type RunDesktopCouncilRoundtableOptions = {
  db: DatabaseSync;
  fixtureDir?: string;
  question: string;
  seatIds?: string[];
  adapter?: CouncilAdapter | null;
  useFixtureAdapter?: boolean;
};

export function listDesktopCouncilSeats(options: ListDesktopCouncilSeatsOptions): CouncilListBridgeResult {
  const fixtureDir = resolveCouncilFixtureDir(options.fixtureDir);
  const registry = establishCouncilSeats({ db: options.db, fixtureDir });
  return {
    seats: listCouncilSeats(registry).map(toSeatView),
    adapterKind: resolveAdapter(undefined, false).kind,
  };
}

export function askDesktopCouncilSeat(options: AskDesktopCouncilSeatOptions): CouncilAskBridgeResult {
  const resolved = resolveAdapter(options.adapter, options.useFixtureAdapter === true);
  if (!resolved.adapter) {
    return { ok: false, error: NO_COUNCIL_ADAPTER_REASON, adapterKind: "none" };
  }
  try {
    const fixtureDir = resolveCouncilFixtureDir(options.fixtureDir);
    const registry = establishCouncilSeats({ db: options.db, fixtureDir });
    const result = askCouncilSeat({
      registry,
      seatId: options.seatId,
      question: options.question,
      adapter: resolved.adapter,
    });
    return {
      ok: true,
      seat: toSeatView(result.seat),
      question: result.question,
      utterance: toUtteranceView(result.utterance),
      adapterKind: resolved.kind,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      adapterKind: resolved.kind,
    };
  }
}

export function runDesktopCouncilRoundtable(
  options: RunDesktopCouncilRoundtableOptions,
): CouncilRoundtableBridgeResult {
  const resolved = resolveAdapter(options.adapter, options.useFixtureAdapter === true);
  if (!resolved.adapter) {
    return { ok: false, error: NO_COUNCIL_ADAPTER_REASON, adapterKind: "none" };
  }
  try {
    const fixtureDir = resolveCouncilFixtureDir(options.fixtureDir);
    const registry = establishCouncilSeats({ db: options.db, fixtureDir });
    const result = runCouncilRoundtable({
      registry,
      question: options.question,
      adapter: resolved.adapter,
      seatIds: options.seatIds,
    });
    return {
      ok: true,
      question: result.question,
      seat_ids: [...result.seat_ids],
      utterances: result.utterances.map(toUtteranceView),
      adapterKind: resolved.kind,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      adapterKind: resolved.kind,
    };
  }
}

function resolveAdapter(
  override: CouncilAdapter | null | undefined,
  useFixtureAdapter: boolean,
): { adapter: CouncilAdapter; kind: Exclude<CouncilAdapterKind, "none"> } | { adapter: null; kind: "none" } {
  if (override) {
    return { adapter: override, kind: "injected" };
  }
  if (useFixtureAdapter) {
    if (!configuredAdapter || configuredAdapter.kind !== "fixture") {
      enableFixtureCouncilAdapter();
    }
    return configuredAdapter ?? { adapter: createFixtureCouncilAdapter(), kind: "fixture" };
  }
  if (configuredAdapter) {
    return configuredAdapter;
  }
  if (process.env.BOOKSKILL_COUNCIL_ADAPTER === "fixture") {
    enableFixtureCouncilAdapter();
    return configuredAdapter ?? { adapter: createFixtureCouncilAdapter(), kind: "fixture" };
  }
  return { adapter: null, kind: "none" };
}

function toSeatView(seat: CouncilSeat): CouncilSeatView {
  return {
    seat_id: seat.seat_id,
    name: seat.name,
    book_title: seat.book_title,
    source_filename: seat.source_filename,
    skill_status: "draft",
    skill_id: seat.skill_id,
    based_on: [...seat.based_on],
  };
}

function toUtteranceView(utterance: CouncilUtterance): CouncilUtteranceView {
  return {
    kind: utterance.kind,
    seat_id: utterance.seat_id,
    speaker: utterance.speaker,
    content: utterance.content,
    source_filename: utterance.source_filename,
    citations: utterance.citations.map((item) => ({
      quote: item.quote,
      source_filename: item.source_filename,
      attribution: item.attribution,
    })),
  };
}

