import "server-only";
import { and, count, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { fullName, proposeRanks, type ProposalReason } from "@/lib/scoring";
import { computeSeason } from "./season";

export interface PromotionRow {
  shooterId: string;
  name: string;
  fromRank: string;
  toRank: string;
  reason: ProposalReason;
  position: number | null;
  points: number | null;
  participations: number;
}

/** The engine's proposal for next season, enriched with names and season results. */
export async function promotionProposal(year: number) {
  const db = getDb();
  const { ranks, standings, seasonRanks, people } = await computeSeason(year);
  // Birthdates are no longer kept up to date, so juniors always stay junior here: the board moves
  // whoever turns 18 by hand.
  const shooters = seasonRanks
    .filter((r) => people.get(r.shooterId)?.active)
    .map((r) => ({ shooterId: r.shooterId, rankCode: r.rankCode, birthdate: null }));
  const proposals = proposeRanks({ ranks, shooters, standings, nextSeasonYear: year + 1 });
  const rowOf = new Map([...standings.values()].flat().map((r) => [r.shooterId, r]));

  const [[{ n: alreadySet }], [{ n: nextEntries }]] = await Promise.all([
    db.select({ n: count() }).from(schema.shooterSeasonRanks).where(eq(schema.shooterSeasonRanks.seasonYear, year + 1)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.entries)
      .innerJoin(schema.competitions, eq(schema.entries.competitionId, schema.competitions.id))
      .where(and(eq(schema.competitions.seasonYear, year + 1))),
  ]);

  const rows: PromotionRow[] = proposals.map((p) => {
    const row = rowOf.get(p.shooterId);
    return {
      ...p,
      name: fullName(people.get(p.shooterId)!),
      position: row?.position ?? null,
      points: row?.points ?? null,
      participations: row?.participations ?? 0,
    };
  });
  return { ranks, rows, proposals, alreadySet, nextEntries };
}
