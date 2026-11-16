import { COUNCIL_SEAT_IDS, type CouncilSeatId } from "./types.ts";

export const COUNCIL_SKILL_DOMAIN = "智囊团";

export const SUNZI_DECISION_SEAT_ID = "sunzi-decision" as const;
export const LUNYU_CONDUCT_SEAT_ID = "lunyu-conduct" as const;
export const LAOZI_WUWEI_SEAT_ID = "laozi-wuwei" as const;

export type FixedCouncilSeatDefinition = {
  seat_id: CouncilSeatId;
  name: string;
  based_on: [string];
  book_title: string;
  source_filename: string;
};

export const FIXED_COUNCIL_SEATS: readonly FixedCouncilSeatDefinition[] = [
  {
    seat_id: SUNZI_DECISION_SEAT_ID,
    name: "决策席",
    based_on: ["孙子庙算决策评估"],
    book_title: "孙子兵法",
    source_filename: "孙子兵法_蒸馏结果.md",
  },
  {
    seat_id: LUNYU_CONDUCT_SEAT_ID,
    name: "处事席",
    based_on: ["论语君子七问处事顾问"],
    book_title: "论语",
    source_filename: "论语_蒸馏结果.md",
  },
  {
    seat_id: LAOZI_WUWEI_SEAT_ID,
    name: "无为席",
    based_on: ["老子无为减法诊断"],
    book_title: "道德经",
    source_filename: "道德经_蒸馏结果.md",
  },
];

export function isCouncilSeatId(value: string): value is CouncilSeatId {
  return (COUNCIL_SEAT_IDS as readonly string[]).includes(value);
}

export function getFixedCouncilSeat(seatId: string): FixedCouncilSeatDefinition {
  const seat = FIXED_COUNCIL_SEATS.find((item) => item.seat_id === seatId);
  if (!seat) {
    throw new Error(`Unknown council seat: ${seatId}`);
  }
  return seat;
}

export function listFixedCouncilSeatIds(): CouncilSeatId[] {
  return [...COUNCIL_SEAT_IDS];
}
