import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SeasonRankingView } from "@/components/public/season-ranking";

export async function generateMetadata({ params }: PageProps<"/klassement/[jaar]">): Promise<Metadata> {
  const { jaar } = await params;
  return { title: `Klassement ${jaar}` };
}

export default function SeasonPage(props: PageProps<"/klassement/[jaar]">) {
  return (
    <Suspense fallback={<p className="text-muted">Laden…</p>}>
      <Season params={props.params} />
    </Suspense>
  );
}

async function Season({ params }: Pick<PageProps<"/klassement/[jaar]">, "params">) {
  const { jaar } = await params;
  const year = Number(jaar);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();
  return <SeasonRankingView year={year} />;
}
