import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FINISHED } from "@/components/public/format";
import { getCompetitionList, getCompetitionView, getLiveView } from "@/lib/server/public-data";
import { CompetitionView } from "./competition-view";

export async function generateMetadata({ params }: PageProps<"/wedstrijd/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const comp = (await getCompetitionList()).find((c) => c.slug === slug);
  return { title: comp?.name ?? "Wedstrijd" };
}

export default function CompetitionPage(props: PageProps<"/wedstrijd/[slug]">) {
  return (
    <Suspense fallback={<p className="text-muted">Laden…</p>}>
      <Competition params={props.params} />
    </Suspense>
  );
}

async function Competition({ params }: Pick<PageProps<"/wedstrijd/[slug]">, "params">) {
  const { slug } = await params;
  const listed = (await getCompetitionList()).find((c) => c.slug === slug);
  if (!listed) notFound();
  // Finished: cached results. Otherwise: the live view, refreshed by the client every few seconds.
  const finished = FINISHED.has(listed.status);
  const view = finished ? await getCompetitionView(slug) : await getLiveView(slug);
  if (!view) notFound();
  return <CompetitionView initial={view} live={!finished} />;
}
