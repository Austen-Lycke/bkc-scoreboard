import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { seasonStandings, type RankDef, type SeasonRow, type SeasonRule } from "@/lib/scoring";

const { competitions, entries, passes, ranks, seasons, shooterSeasonRanks, shooters } = schema;

/** The season shown by default: the latest open season, else the latest one, else this year. */
export async function currentSeasonYear(): Promise<number> {
  const db = getDb();
  const open = await db.query.seasons.findFirst({ where: eq(seasons.status, "open"), orderBy: desc(seasons.year) });
  if (open) return open.year;
  const latest = await db.query.seasons.findFirst({ orderBy: desc(seasons.year) });
  return latest?.year ?? new Date().getFullYear();
}

export async function rankDefs(): Promise<RankDef[]> {
  const rows = await getDb().select().from(ranks).orderBy(asc(ranks.order));
  return rows.map((r) => ({ code: r.code, name: r.name, order: r.order, isJunior: r.isJunior }));
}

/**
 * Season standings from the finished competitions that count, grouped by each shooter's rank for
 * that season. Shared by the public ranking, the admin export and the promotion wizard.
 */
export async function computeSeason(year: number) {
  const db = getDb();
  const [season, defs, results, seasonRanks] = await Promise.all([
    db.query.seasons.findFirst({ where: eq(seasons.year, year) }),
    rankDefs(),
    db
      .select({ competitionId: passes.competitionId, shooterId: entries.shooterId, total: sql<number>`sum(${passes.score})::int` })
      .from(passes)
      .innerJoin(entries, eq(passes.entryId, entries.id))
      .innerJoin(competitions, eq(passes.competitionId, competitions.id))
      .where(and(eq(competitions.seasonYear, year), eq(competitions.countsForSeason, true), inArray(competitions.status, ["finished", "published"])))
      .groupBy(passes.competitionId, entries.shooterId),
    db.select().from(shooterSeasonRanks).where(eq(shooterSeasonRanks.seasonYear, year)),
  ]);
  const rule: SeasonRule = season?.rankingRule ?? { type: "sum" };
  const rankOf = new Map(seasonRanks.map((r) => [r.shooterId, r.rankCode]));
  const standings: Map<string, SeasonRow[]> = seasonStandings(results, rankOf, rule);
  const ids = [...new Set([...results.map((r) => r.shooterId), ...seasonRanks.map((r) => r.shooterId)])];
  const people = ids.length ? await db.select().from(shooters).where(inArray(shooters.id, ids)) : [];
  return {
    season,
    rule,
    ranks: defs,
    standings,
    seasonRanks,
    people: new Map(people.map((p) => [p.id, p])),
    competitionCount: new Set(results.map((r) => r.competitionId)).size,
  };
}

export const RULE_LABEL = (rule: SeasonRule) =>
  rule.type === "sum"
    ? "Som van alle wedstrijden"
    : rule.type === "best_n"
      ? `Som van de ${rule.n} beste wedstrijden`
      : `Gemiddelde per wedstrijd (minstens ${rule.minParticipations})`;
