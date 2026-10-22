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

/** One shooter on the line in one phase of a heat. */
export interface LineSpot {
  entryId: string;
  /**
   * Which pass of the round this is: the knockdown shot on (Spanish, swapping) or the series number
   * (WSA, own frame). The third part of `passKey`; stored as "knockdown".
   */
  knockdown: number;
  /** The knockdown (frame) the shooter stands at, from 1. */
  lane: number;
}

export interface Heat {
  round: number;
  /** The group shooting: a rank, or several ranks together (WSA: Junior / Volwassenen). */
  groupCode: string;
  /** Position of this heat within its group and round, starting at 0. */
  index: number;
  /** Entry ids on the line together, one per lane (the last heat may be short). */
  shooters: string[];
  /** Per phase (one series each): who stands where and which pass they shoot. */
  phases: LineSpot[][];
}

export interface LineFormat {
  lanes: number;
  seriesPerRound: number;
  rotate: boolean;
}

/**
 * The heats of one group in one round: `lanes` shooters at a time, in the given order. With `rotate`
 * every shooter moves on a knockdown after each phase ("wissel") until everyone has shot every
 * knockdown; otherwise they keep their frame and shoot `series` series on it.
 */
export function groupHeats(opts: {
  round: number;
  groupCode: string;
  order: readonly string[];
  lanes: number;
  series: number;
  rotate: boolean;
}): Heat[] {
  const { round, groupCode, order, lanes, series, rotate } = opts;
  const heats: Heat[] = [];
  for (let i = 0, index = 0; i < order.length; i += lanes, index++) {
    const shooters = order.slice(i, i + lanes);
    const phases = Array.from({ length: series }, (_, p) =>
      shooters.map((entryId, s) => {
        if (!rotate) return { entryId, knockdown: p + 1, lane: s + 1 };
        const kd = ((s + p) % lanes) + 1;
        return { entryId, knockdown: kd, lane: kd };
      }),
    );
    heats.push({ round, groupCode, index, shooters, phases });
  }
  return heats;
}

/** The qualification schedule: per round, every group in the given order (Junior first). */
export function buildSchedule(opts: {
  groupOrder: readonly string[];
  ordersByGroup: Readonly<Record<string, readonly string[]>>;
  rounds: number;
  format: LineFormat;
}): Heat[] {
  const { groupOrder, ordersByGroup, rounds, format } = opts;
  const heats: Heat[] = [];
  for (let round = 1; round <= rounds; round++) {
    for (const groupCode of groupOrder) {
      heats.push(
        ...groupHeats({
          round,
          groupCode,
          order: ordersByGroup[groupCode] ?? [],
          lanes: format.lanes,
          series: format.seriesPerRound,
          rotate: format.rotate,
        }),
      );
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
