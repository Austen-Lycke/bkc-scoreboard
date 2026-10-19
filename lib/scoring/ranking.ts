import { resolveTie } from "./shootoff";
import type { ScoredPass, ShootoffIteration } from "./types";

export type TieState =
  /** Unique total, or settled by afkamping. */
  | "none"
  | "resolved"
  /** Equal totals while the rank is still shooting: shared place for now. */
  | "shared"
  /** Rank finished and still tied: afkamping needed. */
  | "pending";

export interface StandingRow {
  entryId: string;
  total: number;
  passCount: number;
  /** Standard competition ranking (1, 2, 2, 4). Null for withdrawn shooters. */
  position: number | null;
  tie: TieState;
  withdrawn: boolean;
}

export interface RankStandings {
  rows: StandingRow[];
  /** Every active shooter has shot all their passes. */
  complete: boolean;
  /** Groups that need (another) afkamping iteration, in ranking order. */
  pendingTies: string[][];
}

/**
 * Standings for one rank in one competition. Highest total wins; equal totals are settled by
 * afkamping once the rank is complete. Withdrawn shooters are listed last without a position.
 */
export function rankStandings(opts: {
  entries: readonly { entryId: string; withdrawn?: boolean }[];
  passes: readonly ScoredPass[];
  expectedPasses: number;
  shootoffs?: readonly ShootoffIteration[];
}): RankStandings {
  const { entries, passes, expectedPasses, shootoffs = [] } = opts;

  const totals = new Map<string, { total: number; passCount: number }>();
  for (const e of entries) totals.set(e.entryId, { total: 0, passCount: 0 });
  for (const p of passes) {
    const t = totals.get(p.entryId);
    if (!t) continue; // pass of a shooter in another rank
    t.total += p.score;
    t.passCount++;
  }

  const active = entries.filter((e) => !e.withdrawn);
  const complete =
    active.length > 0 && active.every((e) => totals.get(e.entryId)!.passCount >= expectedPasses);

  const row = (entryId: string, position: number | null, tie: TieState, withdrawn = false) => ({
    entryId,
    ...totals.get(entryId)!,
    position,
    tie,
    withdrawn,
  });

  // Group active shooters by total, best first.
  const byTotal = new Map<number, string[]>();
  for (const e of active) {
    const t = totals.get(e.entryId)!.total;
    byTotal.set(t, [...(byTotal.get(t) ?? []), e.entryId]);
  }
  const groups = [...byTotal.entries()].sort((a, b) => b[0] - a[0]).map(([, ids]) => ids);

  const rows: StandingRow[] = [];
  const pendingTies: string[][] = [];
  let position = 1;
  for (const group of groups) {
    if (group.length === 1) {
      rows.push(row(group[0], position++, "none"));
      continue;
    }
    if (!complete) {
      for (const id of group) rows.push(row(id, position, "shared"));
      position += group.length;
      continue;
    }
    for (const sub of resolveTie(group, shootoffs)) {
      if (sub.length === 1) {
        rows.push(row(sub[0], position++, "resolved"));
      } else {
        pendingTies.push(sub);
        for (const id of sub) rows.push(row(id, position, "pending"));
        position += sub.length;
      }
    }
  }

  const withdrawn = entries
    .filter((e) => e.withdrawn)
    .map((e) => row(e.entryId, null, "none", true))
    .sort((a, b) => b.total - a.total);

  return { rows: [...rows, ...withdrawn], complete, pendingTies };
}
