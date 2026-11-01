import Link from "next/link";
import { CompetitionList } from "@/components/public/competition-list";
import { formatLongDate, LIVE, STATUS_LABEL, usualLocation } from "@/components/public/format";
import { getCompetitionList } from "@/lib/server/public-data";

export default async function Home() {
  const all = await getCompetitionList();
  const live = all.filter((c) => LIVE.has(c.status));
  const upcoming = all.filter((c) => c.status === "prepared").reverse();
  const recent = all.filter((c) => c.status === "finished" || c.status === "published").slice(0, 5);
  const usual = usualLocation(all);
  const heading = "m-0 text-[clamp(1.625rem,3cqw,2.25rem)] font-semibold leading-none tracking-[-0.03em]";

  return (
    <div className="flex flex-col gap-[clamp(2rem,5cqw,3.5rem)]">
      <section className="flex flex-col gap-3">
        <span className="text-[clamp(1rem,1.6cqw,1.25rem)] font-medium text-muted max-md:hidden">Brugse Katapultclub</span>
        <h1 className="text-[clamp(3.5rem,10cqw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">Wedstrijden</h1>
        <p className="mt-2 max-w-[34rem] text-pretty text-[clamp(1.125rem,1.8cqw,1.375rem)] leading-[1.35] text-muted max-md:hidden">
          Volg de wedstrijden live, bekijk de uitslagen en het seizoensklassement per klasse.
        </p>
      </section>

      {live.map((c) => (
        <Link key={c.id} href={`/wedstrijd/${c.slug}`} className="flex flex-col gap-[clamp(1.5rem,3.5cqw,2.5rem)] rounded-hero bg-ink p-[clamp(1.5rem,4cqw,3rem)] text-white">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span className="inline-flex items-center gap-2 rounded-pill bg-yellow px-4 py-1.5 text-[clamp(0.9375rem,1.5cqw,1.25rem)] font-bold text-ink">
              <span className="size-2 rounded-full bg-ink" />
              Nu live
            </span>
            <span className="text-[clamp(0.9375rem,1.5cqw,1.25rem)] text-on-ink max-md:hidden">{STATUS_LABEL[c.status]}</span>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-6">
            <div className="flex min-w-0 flex-col gap-2.5">
              <span className="text-[clamp(2.5rem,7cqw,5.5rem)] font-semibold leading-[0.92] tracking-[-0.045em]">{c.name}</span>
              <span className="text-[clamp(1rem,1.7cqw,1.375rem)] text-on-ink max-md:hidden">
                {formatLongDate(c.date)}
                {c.location ? ` · ${c.location}` : ""}
              </span>
            </div>
            <span className="inline-flex min-h-[3.25rem] items-center rounded-pill bg-yellow px-6 text-lg font-bold text-ink">Volg live →</span>
          </div>
        </Link>
      ))}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,28rem),1fr))] items-start gap-[clamp(2rem,4cqw,2.5rem)]">
        <section className="flex min-w-0 flex-col gap-4">
          <h2 className={heading}>Volgende wedstrijden</h2>
          <CompetitionList items={upcoming} usual={usual} empty="Er staan nog geen wedstrijden gepland." />
        </section>
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className={heading}>Recente uitslagen</h2>
            <Link href="/kalender" className="inline-flex min-h-11 items-center font-semibold text-muted hover:text-ink">
              Alle wedstrijden →
            </Link>
          </div>
          <CompetitionList items={recent} usual={usual} narrowLimit={3} empty="Nog geen uitslagen." />
        </section>
      </div>
    </div>
  );
}
