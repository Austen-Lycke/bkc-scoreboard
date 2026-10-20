import { and, asc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { formatBelgianDate } from "@/components/public/format";
import { Badge } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Schutters" };

const { shooters, shooterSeasonRanks } = schema;
const field = "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold";

export default async function ShootersPage({ searchParams }: PageProps<"/admin/schutters">) {
  await requireRole("admin");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const rank = typeof params.klasse === "string" ? params.klasse : "";
  const showInactive = params.toon === "alle";
  const [year, ranks] = await Promise.all([currentSeasonYear(), rankDefs()]);

  const filters = [
    showInactive ? undefined : eq(shooters.active, true),
    q ? or(ilike(shooters.firstName, `%${q}%`), ilike(shooters.lastName, `%${q}%`), ilike(sql`${shooters.firstName} || ' ' || ${shooters.lastName}`, `%${q}%`)) : undefined,
    rank === "geen" ? isNull(shooterSeasonRanks.rankCode) : rank ? eq(shooterSeasonRanks.rankCode, rank) : undefined,
  ].filter(Boolean);

  const rows = await getDb()
    .select({
      id: shooters.id,
      firstName: shooters.firstName,
      lastName: shooters.lastName,
      birthdate: shooters.birthdate,
      active: shooters.active,
      rankCode: shooterSeasonRanks.rankCode,
      competitions: sql<number>`(select count(*)::int from entries e where e.shooter_id = ${shooters.id})`,
    })
    .from(shooters)
    .leftJoin(shooterSeasonRanks, and(eq(shooterSeasonRanks.shooterId, shooters.id), eq(shooterSeasonRanks.seasonYear, year)))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(shooters.lastName), asc(shooters.firstName));
  const rankName = (code: string | null) => ranks.find((r) => r.code === code)?.name;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Schutters</h1>
          <p className="mt-1 text-muted">Klasse = indeling voor seizoen {year}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/admin/export/shooters" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-gold">
            Exporteren (CSV)
          </a>
          <Link href="/admin/schutters/importeren" className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-gold">
            Ledenlijst importeren
          </Link>
          <Link href="/admin/schutters/nieuw" className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90 dark:bg-gold dark:text-navy">
            + Schutter
          </Link>
        </div>
      </header>

      <form className="flex flex-wrap items-center gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Zoek op naam…" className={`${field} w-64`} aria-label="Zoek op naam" />
        <select name="klasse" defaultValue={rank} className={field} aria-label="Klasse">
          <option value="">Alle klassen</option>
          {ranks.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
          <option value="geen">Nog niet ingedeeld</option>
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="toon" value="alle" defaultChecked={showInactive} className="size-4 accent-[var(--gold)]" />
          Ook inactieve
        </label>
        <button className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium hover:border-gold">Filteren</button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted">
          Geen schutters gevonden. <Link href="/admin/schutters/importeren" className="underline">Importeer de ledenlijst</Link> om te starten.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted">
              <tr className="border-b border-border">
                <th className="px-4 py-2.5">Naam</th>
                <th className="px-4 py-2.5">Geboren</th>
                <th className="px-4 py-2.5">Klasse {year}</th>
                <th className="px-4 py-2.5 text-right">Wedstrijden</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className={`border-b border-border last:border-0 ${s.active ? "" : "text-muted"}`}>
                  <td className="px-4 py-2.5 font-medium">
                    {s.lastName} {s.firstName} {!s.active && <Badge>inactief</Badge>}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{formatBelgianDate(s.birthdate)}</td>
                  <td className="px-4 py-2.5">{rankName(s.rankCode) ?? <span className="text-muted">niet ingedeeld</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.competitions}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/schutters/${s.id}`} className="font-medium text-gold hover:underline">
                      Bewerken
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-sm text-muted">{rows.length} schutter(s)</p>
    </div>
  );
}
