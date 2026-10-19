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

export type SeasonRule =
  | { type: "sum" }
  | { type: "best_n"; n: number }
  | { type: "average"; minParticipations: number };
