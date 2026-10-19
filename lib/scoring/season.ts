import type { SeasonRule } from "./types";

export interface CompetitionResult {
  competitionId: string;
  shooterId: string;
  total: number;
}

export interface SeasonRow {
  shooterId: string;
  points: number;
  participations: number;
  /** Below the minimum participations for the "average" rule: listed, but not ranked. */
  eligible: boolean;
  /** Standard competition ranking among eligible shooters; null when not eligible. */
  position: number | null;
}

const EPS = 1e-9;

function seasonPoints(totals: number[], rule: SeasonRule): number {
  switch (rule.type) {
    case "sum":
      return totals.reduce((a, b) => a + b, 0);
    case "best_n":
      return [...totals]
        .sort((a, b) => b - a)
        .slice(0, rule.n)
        .reduce((a, b) => a + b, 0);
    case "average":
      return totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  }
}

/**
 * Season ranking per rank. A shooter's rank is fixed for the season, so `shooterRanks` decides the
 * table they appear in. Only competitions that count for the season should be passed in.
 */
export function seasonStandings(
  results: readonly CompetitionResult[],
  shooterRanks: ReadonlyMap<string, string>,
  rule: SeasonRule,
): Map<string, SeasonRow[]> {
  const perShooter = new Map<string, number[]>();
  for (const r of results) perShooter.set(r.shooterId, [...(perShooter.get(r.shooterId) ?? []), r.total]);

  const byRank = new Map<string, SeasonRow[]>();
  for (const [shooterId, totals] of perShooter) {
    const rankCode = shooterRanks.get(shooterId);
    if (!rankCode) continue;
    const eligible = rule.type !== "average" || totals.length >= rule.minParticipations;
    const rows = byRank.get(rankCode) ?? [];
    rows.push({
      shooterId,
      points: seasonPoints(totals, rule),
      participations: totals.length,
      eligible,
      position: null,
    });
    byRank.set(rankCode, rows);
  }

  for (const rows of byRank.values()) {
    rows.sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.points - a.points);
    let prev: SeasonRow | undefined;
    rows.forEach((row, i) => {
      if (!row.eligible) return;
      row.position = prev && Math.abs(prev.points - row.points) < EPS ? prev.position : i + 1;
      prev = row;
    });
  }
  return byRank;
}
