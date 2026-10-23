"use server";

import { count, desc, eq } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { readWsaForm, wsaCompetitionFormat } from "@/lib/server/competition-format";
import { setFlash } from "@/lib/server/flash";
import { tags } from "@/lib/server/tags";
import { requireRole } from "@/lib/session";

const { competitions, events, setups } = schema;
const uuid = z.uuid();

export interface FormState {
  error?: string;
  message?: string;
}

const input = z.object({
  id: z.uuid(),
  name: z.string().trim().min(3, "Geef de wedstrijd een naam").max(120),
  date: z.iso.date("Kies een datum"),
  location: z.string().trim().max(120).optional(),
  countsForSeason: z.boolean(),
});

async function hasEvents(id: string) {
  const [{ n }] = await getDb().select({ n: count() }).from(events).where(eq(events.competitionId, id));
  return n > 0;
}

export async function updateCompetition(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = input.safeParse({
    id: form.get("id"),
    name: form.get("name"),
    date: form.get("date"),
    location: form.get("location") || undefined,
    countsForSeason: form.get("countsForSeason") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const data = parsed.data;
  const db = getDb();
  const comp = await db.query.competitions.findFirst({ where: eq(competitions.id, data.id) });
  if (!comp) return { error: "Wedstrijd niet gevonden" };
  const started = await hasEvents(comp.id);
  const seasonYear = Number(data.date.slice(0, 4));
  if (started && seasonYear !== comp.seasonYear) return { error: "Er zijn al scores: de wedstrijd kan niet meer naar een ander seizoen verhuizen." };

  // Setup per rank (or the WSA format): only before the first score, since scores depend on the plates.
  let setupByRank = comp.setupByRank;
  let format = comp.format;
  if (!started && comp.format) {
    const wsa = readWsaForm(form);
    if (!wsa.success) return { error: wsa.error.issues[0]?.message };
    ({ setupByRank, format } = await wsaCompetitionFormat(wsa.data));
  } else if (!started) {
    const all = await db.select().from(setups);
    setupByRank = Object.fromEntries(
      Object.keys(comp.setupByRank).map((rank) => {
        const chosen = all.find((s) => s.id === form.get(`setup:${rank}`));
        return [rank, chosen?.definition ?? comp.setupByRank[rank]];
      }),
    );
  }

  if (seasonYear !== comp.seasonYear) {
    const latest = await db.query.seasons.findFirst({ orderBy: desc(schema.seasons.year) });
    await db.insert(schema.seasons).values({ year: seasonYear, rankingRule: latest?.rankingRule ?? { type: "sum" } }).onConflictDoNothing();
  }
  await db
    .update(competitions)
    .set({ name: data.name, date: data.date, location: data.location ?? null, countsForSeason: data.countsForSeason, seasonYear, setupByRank, format })
    .where(eq(competitions.id, comp.id));

  for (const tag of [tags.competitions, tags.competition(comp.id), tags.season(comp.seasonYear), tags.season(seasonYear)]) updateTag(tag);
  refresh();
  return { message: "Opgeslagen" };
}

export async function releaseLease(id: string): Promise<FormState> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Wedstrijd niet gevonden" };
  await getDb().update(competitions).set({ operatorDeviceId: null, operatorLeaseAt: null }).where(eq(competitions.id, id));
  refresh();
  return { message: "Vrijgegeven: het volgende toestel dat synchroniseert, neemt de wedstrijd over." };
}

/**
 * Deletes a competition. Once anything was synced (check-ins, scores) the admin must type the
 * competition's name: everything of it disappears, also from the website and the season ranking.
 */
export async function deleteCompetition(id: string, typedName?: string): Promise<FormState> {
  await requireRole("admin");
  if (!uuid.safeParse(id).success) return { error: "Wedstrijd niet gevonden" };
  const db = getDb();
  const comp = await db.query.competitions.findFirst({ where: eq(competitions.id, id) });
  if (!comp) return { error: "Wedstrijd niet gevonden" };
  if ((await hasEvents(id)) && typedName?.trim() !== comp.name) {
    return { error: "Er zijn al inschrijvingen of scores. Typ de naam van de wedstrijd exact over om te bevestigen." };
  }
  await db.delete(competitions).where(eq(competitions.id, id)); // cascades to entries, passes, events…
  for (const tag of [tags.competitions, tags.competition(id), tags.season(comp.seasonYear), tags.shooters]) updateTag(tag);
  await setFlash(`"${comp.name}" is verwijderd.`);
  redirect("/admin/wedstrijden");
}
