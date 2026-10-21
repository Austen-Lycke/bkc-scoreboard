import { and, asc, eq, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { pillClass } from "@/components/styles";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { Lead, PageHead } from "../kit";
import { ShooterList } from "./shooter-list";

export const metadata: Metadata = { title: "Schutters" };

const { shooters, shooterSeasonRanks } = schema;

export default async function ShootersPage({ searchParams }: PageProps<"/admin/schutters">) {
  await requireRole("admin");
  const params = await searchParams;
  const [year, ranks] = await Promise.all([currentSeasonYear(), rankDefs()]);
  const rows = await getDb()
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      active: shooters.active,
      rankCode: shooterSeasonRanks.rankCode,
      competitions: sql<number>`(select count(*)::int from entries e where e.shooter_id = ${shooters.id})`,
    })
    .from(shooters)
    .leftJoin(shooterSeasonRanks, and(eq(shooterSeasonRanks.shooterId, shooters.id), eq(shooterSeasonRanks.seasonYear, year)))
    .orderBy(asc(shooters.lastName), asc(shooters.firstName));

  return (
    <>
      <PageHead
        title="Schutters"
        actions={
          <>
            <a href="/api/admin/export/shooters" className={pillClass("surface")}>
              Exporteren (CSV)
            </a>
            <Link href="/admin/schutters/importeren" className={pillClass("surface")}>
              Ledenlijst importeren
            </Link>
            <Link href="/admin/schutters/nieuw" className={pillClass("yellow")}>
              + Schutter
            </Link>
          </>
        }
      >
        <Lead>Klasse = indeling voor seizoen {year}.</Lead>
      </PageHead>
      <ShooterList
        shooters={rows}
        ranks={ranks.map(({ code, name }) => ({ code, name }))}
        seasonYear={year}
        initial={{
          q: typeof params.q === "string" ? params.q : "",
          rank: typeof params.klasse === "string" ? params.klasse : "",
          inactive: params.toon === "alle",
        }}
      />
    </>
  );
}
