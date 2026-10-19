import { shuffle } from "./rng";

/**
 * Start order within one rank: reverse season ranking (weakest first, leader last).
 * Shooters without a season score yet go first, in random order. In the first competition
 * of a season nobody has a score, so the whole rank is a random draw.
 * Equal season scores are drawn randomly too. The seed makes the draw reproducible.
 */
export function reverseRankingOrder(
  shooterIds: readonly string[],
  seasonPoints: ReadonlyMap<string, number>,
  seed: string,
): string[] {
  const drawn = shuffle(shooterIds, seed);
  // Array.prototype.sort is stable, so the random draw breaks remaining ties.
  return drawn.sort((a, b) => {
    const pa = seasonPoints.get(a);
    const pb = seasonPoints.get(b);
    if (pa === undefined && pb === undefined) return 0;
    if (pa === undefined) return -1;
    if (pb === undefined) return 1;
    return pa - pb;
  });
}

export interface Heat {
  round: number;
  rankCode: string;
  /** Position of this heat within its rank and round, starting at 0. */
  index: number;
  /** Entry ids shooting together, one per knockdown (the last heat may be short). */
  shooters: string[];
  /** Per phase: who shoots which knockdown. Shooters rotate over the knockdowns between phases. */
  phases: { entryId: string; knockdown: number }[][];
}

/**
 * The full shooting schedule of a competition: per round, ranks in the given order (Junior first),
 * each rank split into heats of `knockdowns` shooters. In every phase each shooter has their own
 * knockdown; after the phase they rotate ("wissel"), until everyone has shot every knockdown.
 */
export function buildSchedule(opts: {
  rankOrder: readonly string[];
  ordersByRank: Readonly<Record<string, readonly string[]>>;
  rounds: number;
  knockdowns: number;
}): Heat[] {
  const { rankOrder, ordersByRank, rounds, knockdowns } = opts;
  const heats: Heat[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (const rankCode of rankOrder) {
      const order = ordersByRank[rankCode] ?? [];
      for (let i = 0, index = 0; i < order.length; i += knockdowns, index++) {
        const shooters = order.slice(i, i + knockdowns);
        const phases = Array.from({ length: knockdowns }, (_, p) =>
          shooters.map((entryId, s) => ({ entryId, knockdown: ((s + p) % knockdowns) + 1 })),
        );
        heats.push({ round, rankCode, index, shooters, phases });
      }
    }
  }
  return heats;
}

export const passKey = (entryId: string, round: number, knockdown: number) =>
  `${entryId}:${round}:${knockdown}`;

export interface ScheduleProgress {
  /** Index into the schedule of the heat that is shooting now, or null when everything is shot. */
  heatIndex: number | null;
  phaseIndex: number | null;
  /** Heats after the current one, in order. */
  upcoming: Heat[];
}

/** Where the competition is: the first heat/phase that still has passes to enter. */
export function scheduleProgress(
  schedule: readonly Heat[],
  donePasses: ReadonlySet<string>,
): ScheduleProgress {
  for (let h = 0; h < schedule.length; h++) {
    const heat = schedule[h];
    const p = heat.phases.findIndex((phase) =>
      phase.some((s) => !donePasses.has(passKey(s.entryId, heat.round, s.knockdown))),
    );
    if (p !== -1) return { heatIndex: h, phaseIndex: p, upcoming: schedule.slice(h + 1) };
  }
  return { heatIndex: null, phaseIndex: null, upcoming: [] };
}
