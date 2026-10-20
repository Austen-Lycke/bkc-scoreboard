import type { RankDef } from "./types";

export const DEFAULT_RANKS: RankDef[] = [
  { code: "junior", name: "Junior", order: 0, isJunior: true },
  { code: "klasse3", name: "3de klasse", order: 1 },
  { code: "klasse2", name: "2de klasse", order: 2 },
  { code: "klasse1", name: "1ste klasse", order: 3 },
  { code: "ereklasse", name: "Ereklasse", order: 4 },
];

export const JUNIOR_AGE_LIMIT = 18;

export function sortRanks(ranks: readonly RankDef[]): RankDef[] {
  return [...ranks].sort((a, b) => a.order - b.order);
}

export function juniorRank(ranks: readonly RankDef[]): RankDef {
  const r = ranks.find((x) => x.isJunior);
  if (!r) throw new Error("No junior rank configured");
  return r;
}

/** The rank every adult starts in: the lowest non-junior rank. */
export function entryAdultRank(ranks: readonly RankDef[]): RankDef {
  const r = sortRanks(ranks).find((x) => !x.isJunior);
  if (!r) throw new Error("No adult rank configured");
  return r;
}

/** Next rank up, or null for the top rank. Juniors don't promote by score. */
export function nextRank(ranks: readonly RankDef[], code: string): RankDef | null {
  const sorted = sortRanks(ranks).filter((r) => !r.isJunior);
  const i = sorted.findIndex((r) => r.code === code);
  if (i === -1) return null;
  return sorted[i + 1] ?? null;
}

/** Age in whole years on a given ISO date (YYYY-MM-DD). */
export function ageOn(birthdate: string, onDate: string): number {
  const [by, bm, bd] = birthdate.split("-").map(Number);
  const [y, m, d] = onDate.split("-").map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

/** Ranks are fixed per season: age is checked on January 1st of the season year. */
export function seasonReferenceDate(seasonYear: number): string {
  return `${seasonYear}-01-01`;
}

/**
 * Rank for a shooter who has no rank yet this season (new walk-in).
 * Under 18 on the season reference date → Junior, otherwise (or without a birthdate) the entry adult rank.
 */
export function initialRank(
  birthdate: string | null,
  seasonYear: number,
  ranks: readonly RankDef[] = DEFAULT_RANKS,
): RankDef {
  return birthdate && ageOn(birthdate, seasonReferenceDate(seasonYear)) < JUNIOR_AGE_LIMIT
    ? juniorRank(ranks)
    : entryAdultRank(ranks);
}

/**
 * The rank to propose at check-in. Ranks are fixed per season, so an existing rank for this season
 * wins. Otherwise the most recent rank carries over (a junior who is 18 by now moves to the entry
 * adult rank, as the promotion wizard would), and a shooter we've never seen gets `initialRank`.
 */
export function suggestSeasonRank(opts: {
  birthdate: string | null;
  seasonYear: number;
  thisSeasonRank?: string | null;
  lastRank?: string | null;
  ranks?: readonly RankDef[];
}): string {
  const { birthdate, seasonYear, thisSeasonRank, lastRank, ranks = DEFAULT_RANKS } = opts;
  if (thisSeasonRank) return thisSeasonRank;
  if (lastRank) {
    const isJunior = ranks.find((r) => r.code === lastRank)?.isJunior;
    if (isJunior && birthdate && ageOn(birthdate, seasonReferenceDate(seasonYear)) >= JUNIOR_AGE_LIMIT) {
      return entryAdultRank(ranks).code;
    }
    return lastRank;
  }
  return initialRank(birthdate, seasonYear, ranks).code;
}
