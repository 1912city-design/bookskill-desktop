export const COUNCIL_SEAT_IDS = ["sunzi-decision", "lunyu-conduct", "laozi-wuwei"] as const;

export type CouncilSeatId = (typeof COUNCIL_SEAT_IDS)[number];

export type CouncilAdapterKind = "none" | "fixture" | "injected";

export type CouncilSeatView = {
  seat_id: string;
  name: string;
  book_title: string;
  source_filename: string;
  skill_status: "draft";
  skill_id: string;
  based_on: string[];
};

export type CouncilCitationView = {
  quote: string;
  source_filename: string;
  attribution?: string;
};

export type CouncilUtteranceView = {
  kind: "seat" | "summary";
  seat_id: string | null;
  speaker: string;
  content: string;
  source_filename: string;
  citations: CouncilCitationView[];
};

export type CouncilAskBridgeResult =
  | {
      ok: true;
      seat: CouncilSeatView;
      question: string;
      utterance: CouncilUtteranceView;
      adapterKind: Exclude<CouncilAdapterKind, "none">;
    }
  | {
      ok: false;
      error: string;
      adapterKind: CouncilAdapterKind;
    };

export type CouncilRoundtableBridgeResult =
  | {
      ok: true;
      question: string;
      seat_ids: string[];
      utterances: CouncilUtteranceView[];
      adapterKind: Exclude<CouncilAdapterKind, "none">;
    }
  | {
      ok: false;
      error: string;
      adapterKind: CouncilAdapterKind;
    };

export type CouncilListBridgeResult = {
  seats: CouncilSeatView[];
  adapterKind: CouncilAdapterKind;
};

export type CouncilUiState = {
  loaded: boolean;
  seats: CouncilSeatView[];
  selectedSeatId: string | null;
  draftQuestion: string;
  utterances: CouncilUtteranceView[];
  error: string | null;
  adapterKind: CouncilAdapterKind;
  statusMessage: string | null;
};

export function emptyCouncilUiState(): CouncilUiState {
  return {
    loaded: false,
    seats: [],
    selectedSeatId: "sunzi-decision",
    draftQuestion: "",
    utterances: [],
    error: null,
    adapterKind: "none",
    statusMessage: null,
  };
}
