import { resolveTie } from "./shootoff";
import type { ShootoffIteration } from "./types";

/**
 * The semi-final and the elimination final of a WSA day. Pure rules; lib/competition/derive.ts
 * applies them to a competition.
 */

/** How many go on from a field of `n`: the best half, rounded down, never fewer than `min` (all of them when there aren't more). */
export function advanceCount(n: number, min = 3): number {
  return n <= min ? n : Math.max(min, Math.floor(n / 2));
}

/** How many drop out after a final series with `n` left: `drop`, but never fewer left than the podium. */
export function dropCount(n: number, drop = 2, podium = 3): number {
  return Math.max(0, Math.min(drop, n - podium));
}

/**
 * Ranks shooters by total, best first, as groups: a group of more than one is still tied after the
 * given afkamping iterations.
 */
export function rankByTotal(ids: readonly string[], total: (id: string) => number, shootoffs: readonly ShootoffIteration[]): string[][] {
  const sorted = [...ids].sort((a, b) => total(b) - total(a));
  const groups: string[][] = [];
  for (const id of sorted) {
    const last = groups.at(-1);
    if (last && total(last[0]) === total(id)) last.push(id);
    else groups.push([id]);
  }
  return groups.flatMap((g) => resolveTie(g, shootoffs));
}

/**
 * The first `keep` of a ranking go on. When the line falls inside a tie, nobody goes on yet: that
 * tie needs an afkamping first.
 */
export function cutAt(ranked: readonly string[][], keep: number): { through: string[]; out: string[] } | { tie: string[] } {
  const through: string[] = [];
  let i = 0;
  for (; i < ranked.length && through.length < keep; i++) {
    if (through.length + ranked[i].length > keep) return { tie: [...ranked[i]] };
    through.push(...ranked[i]);
  }
  return { through, out: ranked.slice(i).flat() };
}
