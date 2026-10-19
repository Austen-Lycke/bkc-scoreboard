import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { buildState, publicName, publicView, type PublicView } from "@/lib/competition";
import { getDb, schema } from "@/lib/db";
import { nextRank, PROMOTE_COUNT } from "@/lib/scoring";
import { computeSeason, RULE_LABEL } from "./season";
import { buildSnapshot } from "./snapshot";
import { tags } from "./tags";

const { competitions, entries, ranks, shooterSeasonRanks, shooters } = schema;

/** Public data for the portal. Cached per tag; every sync from the operator laptop invalidates the tags. */

export const LIVE_STATUSES = ["warmup", "round1", "break", "round2", "shootoff"] as const;
export const FINISHED_STATUSES = ["finished", "published"] as const;
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });

export type CompetitionListItem = Awaited<ReturnType<typeof getCompetitionList>>[number];

export async function getCompetitionList() {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.competitions);
  return getDb()
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      date: competitions.date,
      location: competitions.location,
      status: competitions.status,
      seasonYear: competitions.seasonYear,
    })
    .from(competitions)
    .where(sql`${competitions.status} <> 'draft'`)
    .orderBy(desc(competitions.date));
}

async function viewFor(slug: string): Promise<{ view: PublicView; competitionId: string } | null> {
  const comp = await getDb().query.competitions.findFirst({ where: eq(competitions.slug, slug), columns: { id: true, status: true } });
  if (!comp || comp.status === "draft") return null;
  const snapshot = await buildSnapshot(comp.id);
  if (!snapshot) return null;
  return { view: publicView(buildState(snapshot)), competitionId: comp.id };
}

/** A competition's results: cached until the next sync for it. */
export async function getCompetitionView(slug: string): Promise<PublicView | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.competitions);
  const result = await viewFor(slug);
  if (result) cacheTag(tags.competition(result.competitionId));
  return result?.view ?? null;
}

/**
 * The live view: deliberately not cached by Next, so it's never behind the laptop. The public API
 * puts a short CDN cache in front of it, which keeps the database load flat however many follow along.
 */
export async function getLiveView(slug: string): Promise<PublicView | null> {
  return (await viewFor(slug))?.view ?? null;
}

export async function getSeasonYears(): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.competitions);
  const rows = await getDb()
    .selectDistinct({ year: competitions.seasonYear })
    .from(competitions)
    .orderBy(desc(competitions.seasonYear));
  return rows.map((r) => r.year);
}

export interface SeasonRanking {
  year: number;
  ruleLabel: string;
  competitionCount: number;
  ranks: {
    code: string;
    name: string;
    promotes: boolean;
    rows: { position: number | null; shooterId: string; name: string; points: number; participations: number; eligible: boolean; promotion: boolean }[];
  }[];
}

export async function getSeasonRanking(year: number): Promise<SeasonRanking> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.season(year), tags.competitions);
  const { rule, ranks: rankDefs, standings, people, competitionCount } = await computeSeason(year);
  const onDate = today();
  return {
    year,
    ruleLabel: RULE_LABEL(rule),
    competitionCount,
    ranks: rankDefs
      .map((rank) => {
        const promotes = !rank.isJunior && nextRank(rankDefs, rank.code) !== null;
        return {
          code: rank.code,
          name: rank.name,
          promotes,
          rows: (standings.get(rank.code) ?? []).map((row) => {
            const p = people.get(row.shooterId);
            return {
              ...row,
              name: p ? publicName(p, { isJuniorRank: !!rank.isJunior, onDate }) : "Onbekend",
              promotion: promotes && row.position !== null && row.position <= PROMOTE_COUNT,
            };
          }),
        };
      })
      .filter((r) => r.rows.length > 0),
  };
}

export interface ShooterProfile {
  name: string;
  currentRank: string | null;
  rankHistory: { year: number; rank: string }[];
  results: { slug: string; competition: string; date: string; rank: string; position: number | null; total: number; passes: (number | null)[] }[];
  stats: { competitions: number; average: number | null; best: number | null; perfectPasses: number };
}

export async function getShooterProfile(id: string): Promise<ShooterProfile | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.shooters, tags.competitions);
  if (!z.uuid().safeParse(id).success) return null;
  const db = getDb();
  const person = await db.query.shooters.findFirst({ where: eq(shooters.id, id) });
  if (!person) return null;
  const [history, rankRows, attended] = await Promise.all([
    db.select().from(shooterSeasonRanks).where(eq(shooterSeasonRanks.shooterId, id)).orderBy(desc(shooterSeasonRanks.seasonYear)),
    db.select().from(ranks),
    db
      .select({ slug: competitions.slug, date: competitions.date })
      .from(entries)
      .innerJoin(competitions, eq(entries.competitionId, competitions.id))
      .where(and(eq(entries.shooterId, id), inArray(competitions.status, [...FINISHED_STATUSES])))
      .orderBy(desc(competitions.date)),
  ]);
  const rankName = (code: string) => rankRows.find((r) => r.code === code)?.name ?? code;
  const junior = rankRows.find((r) => r.isJunior)?.code;

  const results: ShooterProfile["results"] = [];
  let perfectPasses = 0;
  for (const a of attended) {
    const view = await getCompetitionView(a.slug);
    if (!view) continue;
    for (const rank of view.ranks) {
      const row = rank.rows.find((r) => r.shooterId === id);
      if (!row) continue;
      perfectPasses += row.passes.filter((p) => p === rank.maxPass).length;
      results.push({ slug: a.slug, competition: view.competition.name, date: a.date, rank: rank.name, position: row.position, total: row.total, passes: row.passes });
    }
  }
  const totals = results.map((r) => r.total);
  return {
    name: publicName(person, { isJuniorRank: history[0]?.rankCode === junior, onDate: today() }),
    currentRank: history[0] ? rankName(history[0].rankCode) : null,
    rankHistory: history.map((h) => ({ year: h.seasonYear, rank: rankName(h.rankCode) })),
    results,
    stats: {
      competitions: results.length,
      average: totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 10) / 10 : null,
      best: totals.length ? Math.max(...totals) : null,
      perfectPasses,
    },
  };
}
