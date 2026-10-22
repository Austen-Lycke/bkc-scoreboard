/** Shared domain types for the scoring engine. Pure data, no I/O. */

export type DisciplineType = "spanish_knockdown" | "wsa_v1" | "wsa_v2";

export interface Target {
  id: string;
  /** As the judge calls it, e.g. "Links 2". */
  label: string;
  points: number;
  /** 1 = top row. Used to draw the knockdown. */
  row: number;
  /** Diameter of the plate, for drawing to scale. */
  sizeMm: number;
}

export interface Setup {
  id: string;
  name: string;
  disciplineType: DisciplineType;
  targets: Target[];
  /**
   * How a pass is entered. "plates" (default): the operator taps the plates that fell.
   * "points": the operator types the score of the series from the scorecard (WSA).
   */
  entry?: "plates" | "points";
}

export interface RankDef {
  code: string;
  name: string;
  /** 0 = lowest (Junior), higher = better. */
  order: number;
  isJunior?: boolean;
}

/** One shooter's 7 shots on one knockdown in one round, already scored. */
export interface ScoredPass {
  entryId: string;
  round: number;
  knockdown: number;
  score: number;
}

/** One "afkamping" iteration: the judge calls targets, every tied shooter shoots at each. */
export interface ShootoffIteration {
  participants: string[];
  calls: { targetId: string; points: number }[];
  /** Per participant: hit (true) / miss (false), aligned with `calls`. */
  results: Record<string, boolean[]>;
}

/** Shooters who shoot and are ranked together. Without groups, every rank is its own group. */
export interface GroupDef {
  code: string;
  name: string;
  rankCodes: string[];
}

/** The countdowns the TV shows on a timed day. */
export interface FormatTiming {
  seriesSeconds: number;
  /** Rest between two series of the same heat. */
  recoverSeconds: number;
  /** Warmup before a round. */
  warmupSeconds: number;
}

/**
 * After the qualification rounds: a semi-final and/or an elimination final, each optional.
 * The best half (rounded down, never fewer than `podium`) goes on to the next stage. In the final every
 * series drops the last `dropPerStep` shooters, until `podium` shooters shoot for the podium places.
 */
export interface KnockoutFormat {
  semifinal: boolean;
  final: boolean;
  semiSetup: Setup;
  finalSetup: Setup;
  /** Series in the one semi-final round. */
  semiSeries: number;
  dropPerStep: number;
  podium: number;
}

/**
 * How a competition is shot. The Spanish day: pairs on 2 knockdowns that swap after each pass.
 * A WSA day: up to 15 shooters on their own frame, 2 series per round, nobody swaps.
 */
export interface CompetitionFormat {
  /** Shooters on the line at the same time, one per knockdown (frame). */
  lanes: number;
  /** Scored series (passes) per shooter per qualification round. */
  seriesPerRound: number;
  /** After each series every shooter moves on to the next knockdown. Needs `seriesPerRound === lanes`. */
  rotate: boolean;
  groups?: GroupDef[];
  /** Setup per qualification round ("1", "2"); otherwise the setup of the rank. */
  setupByRound?: Record<string, Setup>;
  timing?: FormatTiming;
  knockout?: KnockoutFormat;
}

export type SeasonRule =
  | { type: "sum" }
  | { type: "best_n"; n: number }
  | { type: "average"; minParticipations: number };
