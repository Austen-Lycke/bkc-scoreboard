import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { formatShortDate } from "@/components/public/format";
import { StatusPill } from "@/components/public/status-pill";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Wedstrijden" };

export default async function CompetitionsAdminPage() {
  await requireRole("admin");
  const { competitions } = schema;
  const rows = await getDb()
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      date: competitions.date,
      status: competitions.status,
      countsForSeason: competitions.countsForSeason,
      entries: sql<number>`(select count(*)::int from entries e where e.competition_id = ${competitions.id})`,
    })
    .from(competitions)
    .orderBy(desc(competitions.date));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Wedstrijden</h1>
        <Link href="/operator" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-gold dark:text-navy">
          Nieuwe wedstrijd (wedstrijdleiding)
        </Link>
      </header>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted">Nog geen wedstrijden.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5">Datum</th>
                <th className="px-4 py-2.5">Naam</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Schutters</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 tabular-nums">{formatShortDate(c.date)}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {c.name}
                    {!c.countsForSeason && <span className="ml-2 text-xs text-muted">telt niet mee</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{c.entries}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <a href={`/api/admin/export/competitions/${c.id}`} className="mr-4 text-muted hover:text-foreground">
                      CSV
                    </a>
                    <Link href={`/admin/wedstrijden/${c.id}/afdrukken`} className="mr-4 text-muted hover:text-foreground">
                      Afdrukken
                    </Link>
                    <Link href={`/admin/wedstrijden/${c.id}`} className="font-medium text-gold hover:underline">
                      Bewerken
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
