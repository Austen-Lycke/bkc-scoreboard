import Link from "next/link";
import { getSeasonRanking, getSeasonYears } from "@/lib/server/public-data";
import { PROMOTE_COUNT } from "@/lib/scoring";

export async function SeasonRankingView({ year }: { year: number }) {
  const [ranking, years] = await Promise.all([getSeasonRanking(year), getSeasonYears()]);
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Klassement {year}</h1>
          <p className="mt-1 text-muted">
            {ranking.ruleLabel} · {ranking.competitionCount} {ranking.competitionCount === 1 ? "wedstrijd" : "wedstrijden"} afgewerkt
          </p>
        </div>
        {years.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Seizoen">
            {years.map((y) => (
              <Link
                key={y}
                href={`/klassement/${y}`}
                aria-current={y === year ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ${y === year ? "bg-navy text-white dark:bg-gold dark:text-navy" : "border border-border bg-surface hover:border-ink"}`}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {ranking.ranks.length === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-muted">Nog geen afgewerkte wedstrijden dit seizoen.</p>}

      {ranking.ranks.map((rank) => (
        <section key={rank.code}>
          <h2 className="text-lg font-semibold">{rank.name}</h2>
          {rank.promotes && <p className="text-sm text-muted">De top {PROMOTE_COUNT} stijgt op het einde van het seizoen een klasse.</p>}
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="w-12 px-4 py-2.5">Pl.</th>
                  <th className="px-4 py-2.5">Naam</th>
                  <th className="px-4 py-2.5 text-right">Wedstr.</th>
                  <th className="px-4 py-2.5 text-right">Punten</th>
                </tr>
              </thead>
              <tbody>
                {rank.rows.map((row) => (
                  <tr key={row.shooterId} className={`border-b border-border last:border-0 ${row.promotion ? "bg-[var(--hit)]/[0.07]" : ""}`}>
                    <td className="px-4 py-2.5 font-semibold tabular-nums">{row.position ?? "–"}</td>
                    <td className="px-4 py-2.5">
                      <Link href={`/schutter/${row.shooterId}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      {row.promotion && <span className="ml-2 text-xs text-[#15803d] dark:text-[#4ade80]">↑ promotie</span>}
                      {!row.eligible && <span className="ml-2 text-xs text-muted">te weinig wedstrijden</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted">{row.participations}</td>
                    <td className="px-4 py-2.5 text-right text-base font-semibold tabular-nums">{Math.round(row.points * 10) / 10}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
