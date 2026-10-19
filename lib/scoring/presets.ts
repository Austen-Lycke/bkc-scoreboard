import type { Setup } from "./types";

/** Targets are listed top row first, left to right; keys 1–n on the operator screen follow this order. */
export const SPANISH_KNOCKDOWN: Setup = {
  id: "spanish_knockdown",
  name: "Spaanse knockdown",
  disciplineType: "spanish_knockdown",
  targets: [
    { id: "top-left-3", label: "Links 3", points: 3, row: 1, sizeMm: 125 },
    { id: "top-6", label: "6", points: 6, row: 1, sizeMm: 75 },
    { id: "top-10", label: "10", points: 10, row: 1, sizeMm: 45 },
    { id: "top-right-3", label: "Rechts 3", points: 3, row: 1, sizeMm: 125 },
    { id: "bottom-left-2", label: "Links 2", points: 2, row: 2, sizeMm: 125 },
    { id: "bottom-4", label: "4", points: 4, row: 2, sizeMm: 95 },
    { id: "bottom-right-2", label: "Rechts 2", points: 2, row: 2, sizeMm: 125 },
  ],
};

/** WSA variant 1: big to small, 1 point each. */
export const WSA_V1: Setup = {
  id: "wsa_v1",
  name: "WSA knockdown variant 1",
  disciplineType: "wsa_v1",
  targets: [80, 70, 60, 50, 40].map((sizeMm, i) => ({
    id: `plate-${i + 1}`,
    label: `${sizeMm} mm`,
    points: 1,
    row: 1,
    sizeMm,
  })),
};

/** WSA variant 2: five equal 40 mm plates, 1 point each. */
export const WSA_V2: Setup = {
  id: "wsa_v2",
  name: "WSA knockdown variant 2",
  disciplineType: "wsa_v2",
  targets: Array.from({ length: 5 }, (_, i) => ({
    id: `plate-${i + 1}`,
    label: `Plaat ${i + 1}`,
    points: 1,
    row: 1,
    sizeMm: 40,
  })),
};

export const SETUP_PRESETS: Setup[] = [SPANISH_KNOCKDOWN, WSA_V1, WSA_V2];
