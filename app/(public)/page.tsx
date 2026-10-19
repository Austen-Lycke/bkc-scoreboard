import Link from "next/link";
import { CompetitionList } from "@/components/public/competition-list";
import { formatLongDate, LIVE } from "@/components/public/format";
import { getCompetitionList } from "@/lib/server/public-data";

export default async function Home() {
  const all = await getCompetitionList();
  const live = all.filter((c) => LIVE.has(c.status));
  const upcoming = all.filter((c) => c.status === "prepared").reverse();
  const recent = all.filter((c) => c.status === "finished" || c.status === "published").slice(0, 5);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <p className="text-sm font-semibold uppercase tracking-widest text-gold">Brugse Katapultclub</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">Wedstrijden</h1>
        <p className="mt-3 max-w-xl text-lg text-muted">Volg de wedstrijden live, bekijk de uitslagen en het seizoensklassement per klasse.</p>
      </section>

      {live.map((c) => (
        <Link
          key={c.id}
          href={`/wedstrijd/${c.slug}`}
          className="group flex flex-col gap-3 rounded-2xl bg-navy p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-red-300">
              <span className="size-2 animate-pulse rounded-full bg-red-500" /> Nu live
            </span>
            <p className="mt-2 text-2xl font-semibold">{c.name}</p>
            <p className="text-white/70">
              {formatLongDate(c.date)}
              {c.location ? ` · ${c.location}` : ""}
            </p>
          </div>
          <span className="self-start rounded-lg bg-gold px-5 py-2.5 font-semibold text-navy group-hover:opacity-90 sm:self-auto">Volg live →</span>
        </Link>
      ))}

      <section>
        <h2 className="text-xl font-semibold">Volgende wedstrijden</h2>
        <div className="mt-4">
          <CompetitionList items={upcoming} empty="Er staan nog geen wedstrijden gepland." />
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Recente uitslagen</h2>
          <Link href="/kalender" className="text-sm text-muted hover:text-foreground">
            Alle wedstrijden →
          </Link>
        </div>
        <div className="mt-4">
          <CompetitionList items={recent} empty="Nog geen uitslagen." />
        </div>
      </section>
    </div>
  );
}
