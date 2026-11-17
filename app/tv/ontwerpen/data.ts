import { formatClock, useNow } from "@/components/use-now";

/**
 * Made-up data for the WSA TV mockups: round 2 (variant 2, 10 per plate) of the Volwassenen,
 * beurt 2 of 3, 15 shooters on the line, series 1 typed in and series 2 running.
 */

export type MockShooter = {
  lane: number;
  first: string;
  last: string;
  /** Round 1, series 1 and 2 (variant 1: 2·4·6·8·10). */
  r1: [number, number];
  /** Round 2, series 1 and 2 (variant 2: 5 × 10). Null while not on a card yet. */
  r2: [number | null, number | null];
  total: number;
  /** Place in the group of {@link GROUP_SIZE}. */
  place: number;
  /** Places gained (+) or lost (−) among the line with the last series. */
  move: number;
};

const RAW: [string, string, number, number][] = [
  ["Wout", "Vandamme", 44, 30],
  ["Lotte", "Dewulf", 52, 40],
  ["Jens", "Verhaeghe", 38, 20],
  ["Sofie", "Claeys", 56, 40],
  ["Pieter", "Maes", 30, 10],
  ["Hanne", "Goethals", 46, 30],
  ["Bram", "Desmet", 58, 50],
  ["Elke", "Vermeersch", 40, 20],
  ["Ruben", "Lambrecht", 48, 30],
  ["Nathalie", "Pauwels", 34, 30],
  ["Thomas", "Van Acker", 50, 20],
  ["Jolien", "Decock", 42, 40],
  ["Kobe", "Willems", 36, 10],
  ["Inge", "Vanhoutte", 54, 30],
  ["Stijn", "De Smet", 28, 20],
];

/** The rest of the group, not on the line now. */
const OTHERS = [104, 96, 92, 88, 86, 84, 80, 78, 76, 74, 70, 68, 66, 62, 60, 58, 54, 50, 48, 44, 40, 36, 30];

export const GROUP_SIZE = RAW.length + OTHERS.length;

const placeIn = (t: number, all: number[]) => 1 + all.filter((x) => x > t).length;
const now = RAW.map(([, , r1, s1]) => r1 + s1);
const before = RAW.map(([, , r1]) => r1);

export const LINE: MockShooter[] = RAW.map(([first, last, r1, s1], i) => {
  const a = Math.min(30, Math.ceil(r1 / 4) * 2);
  const place = placeIn(now[i], [...now, ...OTHERS]);
  return {
    lane: i + 1,
    first,
    last,
    r1: [a, r1 - a],
    r2: [s1, null],
    total: now[i],
    place,
    move: placeIn(before[i], before) - placeIn(now[i], now),
  };
});

export const BY_PLACE = [...LINE].sort((a, b) => a.place - b.place || a.lane - b.lane);

export const NEXT = [
  "Arne Verstraete",
  "Lien Bossuyt",
  "Dries Coppens",
  "Fien Vandenberghe",
  "Senne Mortier",
  "Ann Dhondt",
  "Lars Vermeulen",
  "Margot De Clercq",
  "Jasper Huys",
  "Eline Verbeke",
  "Wim Deprez",
  "Tine Rosseel",
  "Robbe Van Damme",
];

export type MockTimer = { series: number; of: number; clock: string; left: number; warn: boolean; progress: number };

/** A series of 2:30 that keeps running down and starts over, so the mockups move. */
export function useMockTimer(): MockTimer {
  const t = useNow(250);
  const left = 150 - Math.floor((t / 1000) % 150);
  return { series: 2, of: 2, clock: formatClock(left), left, warn: left <= 10, progress: 1 - left / 150 };
}
