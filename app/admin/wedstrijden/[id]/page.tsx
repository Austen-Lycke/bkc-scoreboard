import { asc, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CLUB_TIME_ZONE } from "@/components/public/format";
import { textLinkClass } from "@/components/styles";
import { getDb, schema } from "@/lib/db";
import { rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { PageHead, setupShortName } from "../../kit";
import { CompetitionForm } from "./competition-form";

export const metadata: Metadata = { title: "Wedstrijd bewerken" };

const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: CLUB_TIME_ZONE });
const time = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });
const shortDay = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", timeZone: CLUB_TIME_ZONE });

/** "vandaag 14:32", "gisteren 09:10" or "14 okt. 14:32", in Belgian time. */
function lastSeen(at: Date) {
  const now = Date.now();
  const day = dayKey.format(at);
  const when = day === dayKey.format(now) ? "vandaag" : day === dayKey.format(now - 86_400_000) ? "gisteren" : shortDay.format(at);
  return `${when} ${time.format(at)}`;
}

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
    <>
      <PageHead back={{ href: "/admin/wedstrijden", label: "Wedstrijden" }} title={comp.name}>
        <div className="flex gap-4">
          <Link href={`/wedstrijd/${comp.slug}`} className={textLinkClass}>
            Publieke pagina
          </Link>
          <Link href={`/operator/live?c=${comp.id}`} className={textLinkClass}>
            Wedstrijdleiding
          </Link>
        </div>
      </PageHead>
      <CompetitionForm
        competition={{
          id: comp.id,
          name: comp.name,
          date: comp.date,
          location: comp.location ?? "",
          countsForSeason: comp.countsForSeason,
          setupIds: Object.fromEntries(Object.entries(comp.setupByRank).map(([rank, s]) => [rank, s.id])),
          wsa: comp.format
            ? {
                lanes: comp.format.lanes,
                round1: comp.format.setupByRound?.["1"]?.id ?? "wsa_v1",
                round2: comp.format.setupByRound?.["2"]?.id ?? "wsa_v2",
                semifinal: comp.format.knockout?.semifinal ?? false,
                final: comp.format.knockout?.final ?? false,
              }
            : null,
          device: comp.operatorDeviceId
            ? { id: comp.operatorDeviceId.replace(/^dev-/, "").slice(0, 8), lastSeen: comp.operatorLeaseAt ? lastSeen(comp.operatorLeaseAt) : null }
            : null,
        }}
        ranks={ranks.map(({ code, name }) => ({ code, name }))}
        setups={setups.map((s) => ({ id: s.id, name: setupShortName(s.name), title: s.name }))}
        started={events > 0}
      />
    </>
  );
}
