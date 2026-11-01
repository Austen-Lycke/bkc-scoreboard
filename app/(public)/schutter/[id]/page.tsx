import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { dateParts, formatCompactDate } from "@/components/public/format";
import { getShooterProfile } from "@/lib/server/public-data";

export async function generateMetadata({ params }: PageProps<"/schutter/[id]">): Promise<Metadata> {
  const { id } = await params;
  const profile = await getShooterProfile(id);
  return { title: profile?.name ?? "Schutter" };
}

export default function ShooterPage(props: PageProps<"/schutter/[id]">) {
  return (
    <Suspense fallback={<p className="text-muted">Laden…</p>}>
      <Profile params={props.params} />
    </Suspense>
  );
}

async function Profile({ params }: Pick<PageProps<"/schutter/[id]">, "params">) {
  const { id } = await params;
  const profile = await getShooterProfile(id);
  if (!profile) notFound();
  const { stats } = profile;

  const card = "flex min-w-0 flex-col rounded-card border-2 border-border bg-surface px-[clamp(1rem,3cqw,2rem)] py-[clamp(1.25rem,3cqw,1.875rem)]";

  return (
    <div className="flex flex-col gap-[clamp(1.5rem,4cqw,2.5rem)]">
      <header className="flex flex-col gap-3.5">
        {profile.currentRank && (
          <span className="self-start rounded-pill bg-yellow px-3.5 py-[0.3125rem] text-[clamp(0.9375rem,1.4cqw,1.125rem)] font-bold">{profile.currentRank}</span>
        )}
        <h1 className="text-balance text-[clamp(3.25rem,10cqw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">{profile.name}</h1>
      </header>

      <dl className="grid grid-cols-[repeat(auto-fit,minmax(7rem,1fr))] gap-x-[clamp(1rem,3cqw,2rem)] gap-y-[clamp(1.25rem,3cqw,2rem)] rounded-hero bg-ink p-[clamp(1.5rem,4cqw,2.75rem)] text-white">
        <Stat label="Wedstrijden" value={stats.competitions} />
        <Stat label="Gemiddelde" value={stats.average === null ? "–" : stats.average.toLocaleString("nl-BE")} />
        <Stat label="Beste totaal" value={stats.best ?? "–"} />
        <Stat label="Perfecte beurten" value={stats.perfectPasses} />
      </dl>

      <div className="flex flex-wrap items-start gap-[clamp(1rem,2.5cqw,1.5rem)]">
        <section className={`${card} flex-[2_1_30rem] gap-3`}>
          <h2 className="text-[clamp(1.625rem,3cqw,2.25rem)] font-semibold leading-none tracking-[-0.035em]">Resultaten</h2>
          {profile.results.length === 0 ? (
            <p className="text-muted">Nog geen afgewerkte wedstrijden.</p>
          ) : (
            <ul className="flex flex-col">
              {profile.results.map((r) => {
                const { year, day, month } = dateParts(r.date);
                return (
                  <li key={r.slug} className="border-t-2 border-divider first:border-t-0">
                    <Link href={`/wedstrijd/${r.slug}`} className="flex min-h-16 items-center gap-4 py-2.5">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[clamp(1.0625rem,1.5cqw,1.1875rem)] font-semibold tracking-[-0.01em]">{r.competition}</span>
                        <span className="text-[0.9375rem] text-muted max-md:hidden">
                          {formatCompactDate(r.date, true)} · {r.rank}
                        </span>
                        <span className="text-[0.9375rem] text-muted md:hidden">
                          {day} {month} {String(year).slice(2)}
                        </span>
                      </div>
                      <div className="flex flex-none flex-col items-end">
                        <span className="text-[clamp(1.375rem,2cqw,1.625rem)] font-semibold leading-none tracking-[-0.03em]">{r.total}</span>
                        {r.position !== null && <span className="text-sm text-muted">plaats {r.position}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {profile.rankHistory.length > 0 && (
          <section className={`${card} flex-[1_1_18rem] gap-4`}>
            <h2 className="text-[clamp(1.375rem,2.4cqw,1.75rem)] font-semibold leading-[1.05] tracking-[-0.03em]">Klasse per seizoen</h2>
            <ul className="flex flex-wrap gap-2">
              {profile.rankHistory.map((h) => (
                <li key={h.year} className="inline-flex min-h-11 items-center gap-1.5 rounded-pill border-2 border-border px-4 font-semibold">
                  <span className="font-medium text-muted">{h.year}</span>· {h.rank}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col-reverse gap-2.5">
      <dt className="text-[clamp(0.9375rem,1.4cqw,1.125rem)] text-on-ink">{label}</dt>
      <dd className="text-[clamp(2.75rem,6.5cqw,5rem)] font-semibold leading-[0.85] tracking-[-0.05em] text-yellow">{value}</dd>
    </div>
  );
}
