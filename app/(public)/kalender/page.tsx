import type { Metadata } from "next";
import { CompetitionList } from "@/components/public/competition-list";
import { usualLocation } from "@/components/public/format";
import { getCompetitionList } from "@/lib/server/public-data";

export const metadata: Metadata = { title: "Kalender" };

export default async function CalendarPage() {
  const all = await getCompetitionList();
  const years = [...new Set(all.map((c) => c.seasonYear))];
  const usual = usualLocation(all);
  return (
    <div className="flex max-w-[52rem] flex-col gap-[clamp(2rem,5cqw,3.5rem)]">
      <h1 className="text-[clamp(3.5rem,10cqw,7.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">Kalender</h1>
      {years.length === 0 && <p className="text-muted">Nog geen wedstrijden.</p>}
      {years.map((year) => (
        <section key={year} className="flex flex-col gap-4">
          <h2 className="text-[clamp(1.625rem,3cqw,2.25rem)] font-semibold leading-none tracking-[-0.03em]">Seizoen {year}</h2>
          <CompetitionList items={all.filter((c) => c.seasonYear === year)} usual={usual} empty="" />
        </section>
      ))}
    </div>
  );
}
