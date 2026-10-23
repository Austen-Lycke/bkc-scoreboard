import "server-only";
import { and, asc, desc, eq, inArray, lt, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { CompetitionEvent, CompetitionSnapshot, CompetitionStatus } from "@/lib/competition";
import { getDb, schema } from "@/lib/db";
import { seasonStandings, suggestSeasonRank, type RankDef } from "@/lib/scoring";

const { competitions, entries, events, passes, ranks, seasons, shooterSeasonRanks, shooters } = schema;

const STATUS_FOR_OPERATOR: Record<(typeof schema.competitionStatus.enumValues)[number], CompetitionStatus> = {
  draft: "prepared",
  prepared: "prepared",
  warmup: "warmup",
  round1: "round1",
  break: "break",
  round2: "round2",
  semifinal: "semifinal",
  final: "final",
  shootoff: "shootoff",
  finished: "finished",
  published: "finished",
};

/** Everything the operator laptop needs to run this competition offline. Null when it doesn't exist. */
export async function buildSnapshot(competitionId: string): Promise<CompetitionSnapshot | null> {
  if (!z.uuid().safeParse(competitionId).success) return null;
  const db = getDb();
  const comp = await db.query.competitions.findFirst({ where: eq(competitions.id, competitionId) });
  if (!comp) return null;

  const [rankRows, shooterRows, thisSeason, earlier, season, eventRows, results] = await Promise.all([
    db.select().from(ranks).orderBy(asc(ranks.order)),
    db.select().from(shooters).where(eq(shooters.active, true)).orderBy(asc(shooters.lastName), asc(shooters.firstName)),
    db.select().from(shooterSeasonRanks).where(eq(shooterSeasonRanks.seasonYear, comp.seasonYear)),
    // Only each shooter's latest earlier season, not every row of every past season.
    db
      .selectDistinctOn([shooterSeasonRanks.shooterId], { shooterId: shooterSeasonRanks.shooterId, rankCode: shooterSeasonRanks.rankCode })
      .from(shooterSeasonRanks)
      .where(lt(shooterSeasonRanks.seasonYear, comp.seasonYear))
      .orderBy(shooterSeasonRanks.shooterId, desc(shooterSeasonRanks.seasonYear)),
    db.query.seasons.findFirst({ where: eq(seasons.year, comp.seasonYear) }),
    db.select().from(events).where(eq(events.competitionId, comp.id)).orderBy(asc(events.clientCreatedAt)),
    // Totals of the other competitions this season that count for the ranking.
    db
      .select({
        competitionId: passes.competitionId,
        shooterId: entries.shooterId,
        total: sql<number>`sum(${passes.score})::int`,
      })
      .from(passes)
      .innerJoin(entries, eq(passes.entryId, entries.id))
      .innerJoin(competitions, eq(passes.competitionId, competitions.id))
      .where(
        and(
          eq(competitions.seasonYear, comp.seasonYear),
          eq(competitions.countsForSeason, true),
          inArray(competitions.status, ["finished", "published"]),
          ne(competitions.id, comp.id),
        ),
      )
      .groupBy(passes.competitionId, entries.shooterId),
  ]);

  const rankDefs: RankDef[] = rankRows.map((r) => ({ code: r.code, name: r.name, order: r.order, isJunior: r.isJunior }));
  const thisSeasonRank = new Map(thisSeason.map((r) => [r.shooterId, r.rankCode]));
  const lastRank = new Map(earlier.map((r) => [r.shooterId, r.rankCode]));

  const snapshotShooters = shooterRows.map((s) => ({
    id: s.id,
    firstName: s.firstName,
    lastName: s.lastName,
    birthdate: s.birthdate,
    rankCode: suggestSeasonRank({
      birthdate: s.birthdate,
      seasonYear: comp.seasonYear,
      thisSeasonRank: thisSeasonRank.get(s.id),
      lastRank: lastRank.get(s.id),
      ranks: rankDefs,
    }),
  }));

  const rankOf = new Map(snapshotShooters.map((s) => [s.id, s.rankCode]));
  const seasonPoints: Record<string, number> = {};
  for (const rows of seasonStandings(results, rankOf, season?.rankingRule ?? { type: "sum" }).values()) {
    for (const row of rows) seasonPoints[row.shooterId] = row.points;
  }

  return {
    competition: {
      id: comp.id,
      slug: comp.slug,
      name: comp.name,
      date: comp.date,
      location: comp.location,
      seasonYear: comp.seasonYear,
      rounds: comp.rounds,
      knockdowns: comp.knockdowns,
      feeCents: comp.feeCents,
      setupByRank: comp.setupByRank,
      format: comp.format,
      status: STATUS_FOR_OPERATOR[comp.status],
    },
    ranks: rankDefs,
    shooters: snapshotShooters,
    seasonPoints,
    events: eventRows.map(
      (e) =>
        ({
          id: e.id,
          competitionId: e.competitionId,
          deviceId: e.deviceId,
          at: e.clientCreatedAt.toISOString(),
          type: e.type,
          payload: e.payload,
        }) as CompetitionEvent,
    ),
    fetchedAt: new Date().toISOString(),
  };
}
