import type { Metadata } from "next";
import { SeasonRankingView } from "@/components/public/season-ranking";
import { getSeasonYears } from "@/lib/server/public-data";

export const metadata: Metadata = { title: "Klassement" };

/** The current season: the most recent year with competitions. */
export default async function RankingPage() {
  const [latest] = await getSeasonYears();
  if (!latest) {
    return (
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Klassement</h1>
        <p className="mt-4 text-muted">Nog geen wedstrijden.</p>
      </div>
    );
  }
  return <SeasonRankingView year={latest} />;
}
