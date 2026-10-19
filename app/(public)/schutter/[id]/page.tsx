import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { formatShortDate } from "@/components/public/format";
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

  return (
    <div className="flex flex-col gap-8">
      <header>
        {profile.currentRank && <p className="text-sm font-semibold uppercase tracking-widest text-gold">{profile.currentRank}</p>}
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{profile.name}</h1>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Wedstrijden" value={stats.competitions} />
        <Stat label="Gemiddelde" value={stats.average ?? "–"} />
        <Stat label="Beste totaal" value={stats.best ?? "–"} />
        <Stat label="Perfecte beurten" value={stats.perfectPasses} />
      </dl>

      <section>
        <h2 className="text-lg font-semibold">Resultaten</h2>
        {profile.results.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-border p-6 text-muted">Nog geen afgewerkte wedstrijden.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5">Wedstrijd</th>
                  <th className="hidden px-4 py-2.5 sm:table-cell">Klasse</th>
                  <th className="px-4 py-2.5 text-right">Plaats</th>
                  <th className="px-4 py-2.5 text-right">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {profile.results.map((r) => (
                  <tr key={r.slug} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5">
                      <Link href={`/wedstrijd/${r.slug}`} className="font-medium hover:underline">
                        {r.competition}
                      </Link>
                      <span className="block text-xs text-muted">{formatShortDate(r.date)}</span>
                    </td>
                    <td className="hidden px-4 py-2.5 text-muted sm:table-cell">{r.rank}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{r.position ?? "–"}</td>
                    <td className="px-4 py-2.5 text-right text-base font-semibold tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {profile.rankHistory.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Klasse per seizoen</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profile.rankHistory.map((h) => (
              <li key={h.year} className="rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm">
                <span className="text-muted">{h.year}</span> · {h.rank}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
