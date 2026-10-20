import { ageOn, entryAdultRank, JUNIOR_AGE_LIMIT, nextRank, seasonReferenceDate } from "./ranks";
import type { SeasonRow } from "./season";
import type { RankDef } from "./types";

export const PROMOTE_COUNT = 10;

export type ProposalReason =
  | "promotion"
  /** Junior who is 18 or older at the start of the next season. */
  | "junior_age_out"
  | "stay"
  /** Tied at the promotion cut: the board decides. Proposed rank defaults to "stay". */
  | "tie_at_cut";

export interface RankProposal {
  shooterId: string;
  fromRank: string;
  toRank: string;
  reason: ProposalReason;
}

/**
 * Year-end proposal for next season's ranks: the top `promoteCount` of every adult rank except
 * the highest move up one rank, juniors who turn 18 move to the entry adult rank, everyone else
 * stays. A tied group that straddles the cut is flagged for the board instead of guessing.
 */
export function proposeRanks(opts: {
  ranks: readonly RankDef[];
  /** Without a birthdate a junior stays junior; the board can still move them by hand. */
  shooters: readonly { shooterId: string; rankCode: string; birthdate: string | null }[];
  standings: ReadonlyMap<string, SeasonRow[]>;
  nextSeasonYear: number;
  promoteCount?: number;
}): RankProposal[] {
  const { ranks, shooters, standings, nextSeasonYear, promoteCount = PROMOTE_COUNT } = opts;
  const juniorCodes = new Set(ranks.filter((r) => r.isJunior).map((r) => r.code));
  const refDate = seasonReferenceDate(nextSeasonYear);

  // Decide promotion per shooter from the season tables.
  const decision = new Map<string, "promotion" | "tie_at_cut">();
  for (const [rankCode, rows] of standings) {
    if (juniorCodes.has(rankCode) || !nextRank(ranks, rankCode)) continue;
    const ranked = rows.filter((r) => r.position !== null);
    for (const row of ranked) {
      if (row.position! > promoteCount) continue;
      const groupSize = ranked.filter((r) => r.position === row.position).length;
      const lastPlaceOfGroup = row.position! + groupSize - 1;
      decision.set(row.shooterId, lastPlaceOfGroup <= promoteCount ? "promotion" : "tie_at_cut");
    }
  }

  return shooters.map(({ shooterId, rankCode, birthdate }) => {
    if (juniorCodes.has(rankCode)) {
      return birthdate && ageOn(birthdate, refDate) >= JUNIOR_AGE_LIMIT
        ? { shooterId, fromRank: rankCode, toRank: entryAdultRank(ranks).code, reason: "junior_age_out" }
        : { shooterId, fromRank: rankCode, toRank: rankCode, reason: "stay" };
    }
    const d = decision.get(shooterId);
    if (d === "promotion") {
      return { shooterId, fromRank: rankCode, toRank: nextRank(ranks, rankCode)!.code, reason: d };
    }
    return { shooterId, fromRank: rankCode, toRank: rankCode, reason: d ?? "stay" };
  });
}
