import Link from "next/link";
import { getSeasonRanking, getSeasonYears } from "@/lib/server/public-data";
import { PROMOTE_COUNT } from "@/lib/scoring";

/** "↑ promotie" only from the second competition on: after one, every shooter of a small rank would have it. */
const PROMOTION_SHOWN_FROM = 2;

export async function SeasonRankingView({ year }: { year: number }) {
  const [ranking, years] = await Promise.all([getSeasonRanking(year), getSeasonYears()]);
  const showPromotion = ranking.competitionCount >= PROMOTION_SHOWN_FROM;
  const pill = "inline-flex min-h-11 items-center rounded-pill border-2 px-[1.125rem] font-semibold";
  return (
    <div className="flex flex-col gap-[clamp(1.75rem,4cqw,3rem)]">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="flex flex-col gap-3.5">
          <h1 className="text-[clamp(3.25rem,9cqw,7rem)] font-semibold leading-[0.88] tracking-[-0.05em]">Klassement {year}</h1>
          <span className="text-[clamp(1rem,1.6cqw,1.25rem)] text-muted max-md:hidden">
            {ranking.ruleLabel} · {ranking.competitionCount} {ranking.competitionCount === 1 ? "wedstrijd" : "wedstrijden"} afgewerkt
          </span>
        </div>
        {years.length > 1 && (
          <nav className="flex flex-wrap gap-2" aria-label="Seizoen">
            {[...years].reverse().map((y) => (
              <Link
                key={y}
                href={`/klassement/${y}`}
                aria-current={y === year ? "page" : undefined}
                className={`${pill} ${y === year ? "border-ink bg-ink text-white" : "border-border bg-surface hover:border-ink"}`}
              >
                {y}
              </Link>
            ))}
          </nav>
        )}
      </header>

      {ranking.ranks.length === 0 && <p className="rounded-card border-2 border-dashed border-border p-6 text-muted">Nog geen afgewerkte wedstrijden dit seizoen.</p>}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,30rem),1fr))] items-start gap-[clamp(1rem,2.5cqw,1.5rem)]">
        {ranking.ranks.map((rank) => (
          <section
            key={rank.code}
            className="flex min-w-0 flex-col gap-3.5 rounded-card border-2 border-border bg-surface px-[clamp(1rem,3cqw,2rem)] py-[clamp(1.25rem,3cqw,1.875rem)]"
          >
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[clamp(1.625rem,3cqw,2.25rem)] font-semibold leading-none tracking-[-0.035em]">{rank.name}</h2>
              {rank.promotes && (
                <span className="text-pretty text-[0.9375rem] text-muted max-md:hidden">De top {PROMOTE_COUNT} stijgt op het einde van het seizoen een klasse.</span>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-1 text-[0.8125rem] text-muted">
              <span className="w-[3.25rem] text-right">wedstr.</span>
              <span className="w-14 text-right">punten</span>
            </div>
            <ol className="flex flex-col">
              {rank.rows.map((row) => {
                const first = row.position === 1;
                return (
                  <li key={row.shooterId} className="flex min-h-14 items-center gap-3 border-t-2 border-divider py-1.5 first:border-t-0">
                    <span className={`w-7 flex-none text-lg font-semibold ${first ? "text-ink" : "text-muted"}`}>{row.position ?? "–"}</span>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                      <Link
                        href={`/schutter/${row.shooterId}`}
                        className={`max-w-full truncate text-[clamp(1.0625rem,1.5cqw,1.1875rem)] tracking-[-0.01em] hover:underline hover:decoration-2 hover:underline-offset-[0.1875rem] ${
                          first ? "font-bold" : "font-medium"
                        } ${row.eligible ? "" : "text-faint"}`}
                      >
                        {row.name}
                      </Link>
                      {showPromotion && row.promotion && (
                        <span className="rounded-pill bg-good-light px-2 py-0.5 text-xs font-bold text-good">↑ promotie</span>
                      )}
                      {!row.eligible && <span className="text-[0.8125rem] font-semibold text-muted">te weinig wedstrijden</span>}
                    </div>
                    <span className="w-[3.25rem] flex-none text-right text-[1.0625rem] text-muted">{row.participations}</span>
                    <span className="w-14 flex-none text-right text-[clamp(1.25rem,1.8cqw,1.5rem)] font-semibold tracking-[-0.03em]">
                      {Math.round(row.points * 10) / 10}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
