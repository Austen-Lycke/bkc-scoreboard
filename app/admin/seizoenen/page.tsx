import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { pillClass } from "@/components/styles";
import { Empty, Tag } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Lead, PageHead } from "../kit";
import { RuleForm } from "./rule-form";

export const metadata: Metadata = { title: "Seizoenen" };

export default async function SeasonsPage() {
  await requireRole("admin");
  const { competitions, seasons } = schema;
  const rows = await getDb()
    .select({
      year: seasons.year,
      status: seasons.status,
      rankingRule: seasons.rankingRule,
      finished: sql<number>`(select count(*)::int from ${competitions} c where c.season_year = ${seasons.year} and c.status in ('finished','published') and c.counts_for_season)`,
      total: sql<number>`(select count(*)::int from ${competitions} c where c.season_year = ${seasons.year})`,
    })
    .from(seasons)
    .orderBy(desc(seasons.year));

  return (
    <>
      <PageHead title="Seizoenen">
        <Lead>
          Per seizoen bepaal je hoe het klassement berekend wordt. Op het einde van het seizoen zet de promotie-assistent de klassen voor
          het volgende seizoen klaar: de top 10 van elke klasse stijgt.
        </Lead>
      </PageHead>
      {rows.length === 0 && <Empty>Nog geen seizoenen. Een seizoen begint met de eerste wedstrijd.</Empty>}
      {rows.map((s) => (
        <section key={s.year} className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-surface px-4 py-[1.375rem] sm:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[1.0625rem] font-semibold">Seizoen {s.year}</h2>
            <Tag tone={s.status === "open" ? "good" : "fill"}>{s.status === "open" ? "lopend" : "afgesloten"}</Tag>
            <span className="text-[0.8125rem] text-muted">
              {s.finished} van {s.total} wedstrijden afgewerkt
            </span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              <Link href={`/klassement/${s.year}`} className={pillClass("outline", "sm")}>
                Publiek klassement
              </Link>
              <a href={`/api/admin/export/seasons/${s.year}`} className={pillClass("outline", "sm")}>
                Klassement (CSV)
              </a>
              <Link href={`/admin/seizoenen/${s.year}/promotie`} className={pillClass("ink", "sm")}>
                Promotie naar {s.year + 1} →
              </Link>
            </div>
          </div>
          <RuleForm year={s.year} rule={s.rankingRule} />
        </section>
      ))}
    </>
  );
}
