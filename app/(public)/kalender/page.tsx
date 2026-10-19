import type { Metadata } from "next";
import { CompetitionList } from "@/components/public/competition-list";
import { getCompetitionList } from "@/lib/server/public-data";

export const metadata: Metadata = { title: "Kalender" };

export default async function CalendarPage() {
  const all = await getCompetitionList();
  const years = [...new Set(all.map((c) => c.seasonYear))];
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-3xl font-semibold tracking-tight">Kalender</h1>
      {years.length === 0 && <p className="text-muted">Nog geen wedstrijden.</p>}
      {years.map((year) => (
        <section key={year}>
          <h2 className="text-lg font-semibold">Seizoen {year}</h2>
          <div className="mt-3">
            <CompetitionList items={all.filter((c) => c.seasonYear === year)} empty="" />
          </div>
        </section>
      ))}
    </div>
  );
}
