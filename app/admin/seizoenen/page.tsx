import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { RULE_LABEL } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
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
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Seizoenen</h1>
      <p className="max-w-2xl text-muted">
        Per seizoen bepaal je hoe het klassement berekend wordt. Op het einde van het seizoen zet de promotie-assistent de klassen
        voor het volgende seizoen klaar: de top 10 van elke klasse stijgt, juniors die 18 worden gaan naar de laagste klasse.
      </p>
      {rows.map((s) => (
        <section key={s.year} className="rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-semibold">Seizoen {s.year}</h2>
              <Badge tone={s.status === "open" ? "green" : "neutral"}>{s.status === "open" ? "lopend" : "afgesloten"}</Badge>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <Link href={`/klassement/${s.year}`} className="text-muted hover:text-foreground">
                Publiek klassement
              </Link>
              <a href={`/api/admin/export/seasons/${s.year}`} className="text-muted hover:text-foreground">
                Klassement (CSV)
              </a>
              <Link href={`/admin/seizoenen/${s.year}/promotie`} className="font-medium underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-ink">
                Promotie naar {s.year + 1} →
              </Link>
            </div>
          </div>
          <p className="mt-1 text-sm text-muted">
            {s.finished} van {s.total} wedstrijden afgewerkt · nu: {RULE_LABEL(s.rankingRule)}
          </p>
          <RuleForm year={s.year} rule={s.rankingRule} />
        </section>
      ))}
    </div>
  );
}
