import type { ShootoffIteration } from "./types";

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function iterationScore(it: ShootoffIteration, entryId: string): number {
  const hits = it.results[entryId] ?? [];
  return it.calls.reduce((sum, call, i) => (hits[i] ? sum + call.points : sum), 0);
}

/** Groups by equal value, highest first. */
function groupDesc<T>(items: readonly T[], value: (t: T) => number): T[][] {
  const sorted = [...items].sort((a, b) => value(b) - value(a));
  const groups: T[][] = [];
  for (const item of sorted) {
    const last = groups.at(-1);
    if (last && value(last[0]) === value(item)) last.push(item);
    else groups.push([item]);
  }
  return groups;
}

/**
 * Resolve a tie by "afkamping". Each iteration applies to exactly the set of shooters still tied;
 * the highest afkamping score wins the higher place. Shooters still tied after an iteration need a
 * new iteration among just themselves. Iterations are consumed in the order they were shot.
 *
 * Returns the tied group split into ordered sub-groups; a sub-group of size > 1 is still unresolved.
 */
export function resolveTie(
  tied: readonly string[],
  iterations: readonly ShootoffIteration[],
): string[][] {
  const used = new Set<number>();
  const resolve = (group: readonly string[]): string[][] => {
    if (group.length < 2) return [[...group]];
    const i = iterations.findIndex((it, idx) => !used.has(idx) && sameSet(it.participants, group));
    if (i === -1) return [[...group]];
    used.add(i);
    return groupDesc(group, (id) => iterationScore(iterations[i], id)).flatMap(resolve);
  };
  return resolve(tied);
}
