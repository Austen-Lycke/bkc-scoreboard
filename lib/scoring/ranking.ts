import { resolveTie } from "./shootoff";
import type { ScoredPass, ShootoffIteration } from "./types";

export type TieState =
  /** Unique total, or settled by afkamping. */
  | "none"
  | "resolved"
  /** Equal totals while the rank is still shooting: shared place for now. */
  | "shared"
  /** Rank finished and still tied: afkamping needed. */
  | "pending"
  /** Rank finished and tied, and the jury chose not to afkamp: a shared place. */
  | "waived";

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
 * Standings for one rank (or group) in one competition. Highest total wins; equal totals are settled
 * by afkamping once the rank is complete. Withdrawn shooters are listed last without a position.
 * With `bands` (a knockout day: how far each shooter got) a higher band always ranks higher, and only
 * equal totals within a band are a tie. `complete` overrides the pass count check.
 */
export function rankStandings(opts: {
  entries: readonly { entryId: string; withdrawn?: boolean }[];
  passes: readonly ScoredPass[];
  expectedPasses: number;
  shootoffs?: readonly ShootoffIteration[];
  bands?: ReadonlyMap<string, number>;
  complete?: boolean;
  /** Ties the jury chose not to afkamp (each exactly this set of shooters): they keep a shared place. */
  waived?: readonly (readonly string[])[];
}): RankStandings {
  const { entries, passes, expectedPasses, shootoffs = [], bands, waived = [] } = opts;
  const isWaived = (ids: readonly string[]) => waived.some((w) => w.length === ids.length && ids.every((id) => w.includes(id)));

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
    opts.complete ?? (active.length > 0 && active.every((e) => totals.get(e.entryId)!.passCount >= expectedPasses));

  const row = (entryId: string, position: number | null, tie: TieState, withdrawn = false) => ({
    entryId,
    ...totals.get(entryId)!,
    position,
    tie,
    withdrawn,
  });

  // Group active shooters by band and total, best first.
  const byScore = new Map<string, { band: number; total: number; ids: string[] }>();
  for (const e of active) {
    const band = bands?.get(e.entryId) ?? 0;
    const total = totals.get(e.entryId)!.total;
    const key = `${band}:${total}`;
    const g = byScore.get(key) ?? { band, total, ids: [] };
    g.ids.push(e.entryId);
    byScore.set(key, g);
  }
  const groups = [...byScore.values()].sort((a, b) => b.band - a.band || b.total - a.total).map((g) => g.ids);

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
      } else if (isWaived(sub)) {
        for (const id of sub) rows.push(row(id, position, "waived"));
        position += sub.length;
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
