import { count, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear, RULE_LABEL } from "@/lib/server/season";
import { requireRole } from "@/lib/session";

export default async function AdminHome() {
  await requireRole("admin");
  const db = getDb();
  const year = await currentSeasonYear();
  const [season, [shooters], comps, [users]] = await Promise.all([
    db.query.seasons.findFirst({ where: eq(schema.seasons.year, year) }),
    db.select({ n: count() }).from(schema.shooters).where(eq(schema.shooters.active, true)),
    db
      .select({ status: schema.competitions.status, n: sql<number>`count(*)::int` })
      .from(schema.competitions)
      .where(eq(schema.competitions.seasonYear, year))
      .groupBy(schema.competitions.status),
    db.select({ n: count() }).from(schema.user),
  ]);
  const byStatus = (statuses: string[]) => comps.filter((c) => statuses.includes(c.status)).reduce((n, c) => n + c.n, 0);

  const cards = [
    { href: "/admin/seizoenen", label: `Seizoen ${year}`, value: season?.status === "closed" ? "afgesloten" : "lopend", detail: RULE_LABEL(season?.rankingRule ?? { type: "sum" }) },
    { href: "/admin/schutters", label: "Actieve schutters", value: shooters.n, detail: "Importeer de ledenlijst of voeg schutters toe" },
    {
      href: "/admin/wedstrijden",
      label: "Wedstrijden dit seizoen",
      value: byStatus(["prepared", "draft", "warmup", "round1", "break", "round2", "shootoff", "finished", "published"]),
      detail: `${byStatus(["finished", "published"])} afgewerkt · ${byStatus(["prepared", "draft"])} gepland`,
    },
    { href: "/admin/gebruikers", label: "Gebruikers", value: users.n, detail: "Beheerders en wedstrijdleiding" },
  ];

  return (
    <>
      <h1 className="px-1 text-[1.375rem] font-semibold">Overzicht</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-4">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="flex flex-col gap-1.5 rounded-[1.5rem] border border-border bg-surface px-6 py-[1.375rem] transition-colors hover:border-ink">
            <span className="text-sm text-muted">{c.label}</span>
            <span className="text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] tabular-nums">{c.value}</span>
            <span className="text-pretty text-[0.8125rem] text-muted">{c.detail}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
