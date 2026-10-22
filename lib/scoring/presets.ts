import type { CompetitionFormat, RankDef, Setup } from "./types";

/** Targets are listed top row first, left to right; keys 1–n on the operator screen follow this order. */
export const SPANISH_KNOCKDOWN: Setup = {
  id: "spanish_knockdown",
  name: "Spaanse knockdown",
  disciplineType: "spanish_knockdown",
  targets: [
    { id: "top-left-3", label: "Links 3", points: 3, row: 1, sizeMm: 125 },
    { id: "top-6", label: "Midden 6", points: 6, row: 1, sizeMm: 75 },
    { id: "top-10", label: "Midden 10", points: 10, row: 1, sizeMm: 45 },
    { id: "top-right-3", label: "Rechts 3", points: 3, row: 1, sizeMm: 125 },
    { id: "bottom-left-2", label: "Links 2", points: 2, row: 2, sizeMm: 125 },
    { id: "bottom-4", label: "Midden 4", points: 4, row: 2, sizeMm: 95 },
    { id: "bottom-right-2", label: "Rechts 2", points: 2, row: 2, sizeMm: 125 },
  ],
};

/** WSA variant 1: big to small, the smaller the plate the more it's worth. Scored from the scorecard. */
export const WSA_V1: Setup = {
  id: "wsa_v1",
  name: "WSA variant 1 · groot naar klein",
  disciplineType: "wsa_v1",
  entry: "points",
  targets: [80, 70, 60, 50, 40].map((sizeMm, i) => ({
    id: `plate-${i + 1}`,
    label: `${sizeMm} mm`,
    points: (i + 1) * 2,
    row: 1,
    sizeMm,
  })),
};

/** WSA variant 2: five small 40 mm plates, 10 points each. Scored from the scorecard. */
export const WSA_V2: Setup = {
  id: "wsa_v2",
  name: "WSA variant 2 · allemaal klein",
  disciplineType: "wsa_v2",
  entry: "points",
  targets: Array.from({ length: 5 }, (_, i) => ({
    id: `plate-${i + 1}`,
    label: `Plaat ${i + 1}`,
    points: 10,
    row: 1,
    sizeMm: 40,
  })),
};

export const SETUP_PRESETS: Setup[] = [SPANISH_KNOCKDOWN, WSA_V1, WSA_V2];

/** The Spanish day: pairs on 2 knockdowns, swapping after each pass. Also what a competition without a format is. */
export const SPANISH_FORMAT: CompetitionFormat = { lanes: 2, seriesPerRound: 2, rotate: true };

export const WSA_LANES = 15;

/**
 * The WSA day: up to 15 shooters on their own frame, 2 timed series per round, Junior and adults
 * (all adult ranks together) ranked apart. Round 1 on variant 1, round 2 on variant 2, then the
 * optional semi-final and final on variant 2.
 */
export function wsaFormat(
  ranks: readonly RankDef[],
  opts: { lanes?: number; round1?: Setup; round2?: Setup; semifinal?: boolean; final?: boolean } = {},
): CompetitionFormat {
  const sorted = [...ranks].sort((a, b) => a.order - b.order);
  const round2 = opts.round2 ?? WSA_V2;
  return {
    lanes: opts.lanes ?? WSA_LANES,
    seriesPerRound: 2,
    rotate: false,
    groups: [
      { code: "junior", name: "Junior", rankCodes: sorted.filter((r) => r.isJunior).map((r) => r.code) },
      { code: "volwassenen", name: "Volwassenen", rankCodes: sorted.filter((r) => !r.isJunior).map((r) => r.code) },
    ].filter((g) => g.rankCodes.length > 0),
    setupByRound: { "1": opts.round1 ?? WSA_V1, "2": round2 },
    timing: { seriesSeconds: 150, recoverSeconds: 10, warmupSeconds: 300 },
    knockout: {
      semifinal: opts.semifinal ?? true,
      final: opts.final ?? true,
      semiSetup: round2,
      finalSetup: round2,
      semiSeries: 2,
      dropPerStep: 2,
      podium: 3,
    },
  };
}
