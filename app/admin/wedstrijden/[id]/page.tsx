import { asc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { CompetitionForm } from "./competition-form";

export const metadata: Metadata = { title: "Wedstrijd bewerken" };

export default async function EditCompetitionPage({ params }: PageProps<"/admin/wedstrijden/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const db = getDb();
  const [comp, ranks, setups, [{ n: events }]] = await Promise.all([
    db.query.competitions.findFirst({ where: eq(schema.competitions.id, id) }),
    rankDefs(),
    db.select({ id: schema.setups.id, name: schema.setups.name }).from(schema.setups).orderBy(asc(schema.setups.name)),
    db.select({ n: count() }).from(schema.events).where(eq(schema.events.competitionId, id)),
  ]);
  if (!comp) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/wedstrijden" className="text-sm text-muted hover:text-foreground">
          ← Wedstrijden
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">{comp.name}</h1>
        <div className="mt-1 flex gap-4 text-sm">
          <Link href={`/wedstrijd/${comp.slug}`} className="underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-ink">
            Publieke pagina
          </Link>
          <Link href={`/operator/live?c=${comp.id}`} className="underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-ink">
            Wedstrijdleiding
          </Link>
        </div>
      </div>
      <CompetitionForm
        competition={{
          id: comp.id,
          name: comp.name,
          date: comp.date,
          location: comp.location ?? "",
          fee: comp.feeCents ? String(comp.feeCents / 100).replace(".", ",") : "",
          countsForSeason: comp.countsForSeason,
          setupIds: Object.fromEntries(Object.entries(comp.setupByRank).map(([rank, s]) => [rank, s.id])),
          operatorDeviceId: comp.operatorDeviceId,
          operatorLeaseAt: comp.operatorLeaseAt?.toISOString() ?? null,
        }}
        ranks={ranks}
        setups={setups}
        started={events > 0}
      />
    </div>
  );
}
