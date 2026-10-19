import type { RankProposal } from "@/lib/scoring";

export type SeasonRankReason = "start" | "junior" | "promotion" | "junior_age_out" | "manual";

/**
 * Next season's ranks: the engine's proposal with the board's decisions applied. A tie at the
 * promotion cut must be decided (promote or stay) before anything is saved.
 */
export function finalizeProposal(
  proposals: readonly RankProposal[],
  decisions: Readonly<Record<string, string>>,
  juniorCodes: ReadonlySet<string>,
): { ok: true; ranks: { shooterId: string; rankCode: string; reason: SeasonRankReason }[] } | { ok: false; undecided: string[] } {
  const undecided = proposals.filter((p) => p.reason === "tie_at_cut" && !decisions[p.shooterId]).map((p) => p.shooterId);
  if (undecided.length) return { ok: false, undecided };
  return {
    ok: true,
    ranks: proposals.map((p) => {
      const decided = decisions[p.shooterId];
      if (decided && decided !== p.toRank) return { shooterId: p.shooterId, rankCode: decided, reason: "manual" };
      if (p.reason === "tie_at_cut") return { shooterId: p.shooterId, rankCode: decided ?? p.toRank, reason: decided !== p.fromRank ? "promotion" : "start" };
      if (p.reason === "promotion" || p.reason === "junior_age_out") return { shooterId: p.shooterId, rankCode: p.toRank, reason: p.reason };
      return { shooterId: p.shooterId, rankCode: p.toRank, reason: juniorCodes.has(p.toRank) ? "junior" : "start" };
    }),
  };
}
