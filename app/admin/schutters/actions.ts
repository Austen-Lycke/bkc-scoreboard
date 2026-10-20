"use server";

import { and, count, eq, isNull, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { shooterKey } from "@/lib/admin/import";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear } from "@/lib/server/season";
import { tags } from "@/lib/server/tags";
import { requireRole } from "@/lib/session";

const { entries, shooterSeasonRanks, shooters } = schema;

export interface FormState {
  error?: string;
  message?: string;
}

const shooterInput = z.object({
  id: z.uuid().optional(),
  firstName: z.string().trim().min(1, "Voornaam is verplicht").max(80),
  lastName: z.string().trim().min(1, "Achternaam is verplicht").max(80),
  birthdate: z.iso.date("Ongeldige geboortedatum").nullable(),
  active: z.boolean(),
  notes: z.string().trim().max(500).optional(),
  rankCode: z.string().optional(),
});

function invalidatePublic(year: number) {
  updateTag(tags.shooters);
  updateTag(tags.season(year));
}

export async function saveShooter(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = shooterInput.safeParse({
    id: form.get("id") || undefined,
    firstName: form.get("firstName"),
    lastName: form.get("lastName"),
    birthdate: form.get("birthdate") || null,
    active: form.get("active") === "on",
    notes: form.get("notes") || undefined,
    rankCode: form.get("rankCode") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const input = parsed.data;
  const db = getDb();
  const year = await currentSeasonYear();

  const sameKey = (
    await db
      .select()
      .from(shooters)
      .where(and(sql`lower(${shooters.firstName}) = lower(${input.firstName})`, sql`lower(${shooters.lastName}) = lower(${input.lastName})`, input.birthdate ? eq(shooters.birthdate, input.birthdate) : isNull(shooters.birthdate)))
  ).filter((s) => s.id !== input.id);
  if (sameKey.length) return { error: "Er bestaat al een schutter met deze naam en geboortedatum." };

  const id = input.id ?? crypto.randomUUID();
  const values = { firstName: input.firstName, lastName: input.lastName, birthdate: input.birthdate, active: input.active, notes: input.notes ?? null };
  if (input.id) await db.update(shooters).set(values).where(eq(shooters.id, id));
  else await db.insert(shooters).values({ id, ...values });

  if (input.rankCode) {
    await db
      .insert(shooterSeasonRanks)
      .values({ shooterId: id, seasonYear: year, rankCode: input.rankCode, reason: "manual" })
      .onConflictDoUpdate({ target: [shooterSeasonRanks.shooterId, shooterSeasonRanks.seasonYear], set: { rankCode: input.rankCode, reason: "manual" } });
  } else {
    await db.delete(shooterSeasonRanks).where(and(eq(shooterSeasonRanks.shooterId, id), eq(shooterSeasonRanks.seasonYear, year)));
  }
  invalidatePublic(year);
  redirect("/admin/schutters");
}

export async function deleteShooter(id: string): Promise<FormState> {
  await requireRole("admin");
  const db = getDb();
  const [{ n }] = await db.select({ n: count() }).from(entries).where(eq(entries.shooterId, id));
  if (n > 0) return { error: "Deze schutter heeft al wedstrijden geschoten. Zet hem of haar op inactief in plaats van te verwijderen." };
  await db.delete(shooters).where(eq(shooters.id, id));
  invalidatePublic(await currentSeasonYear());
  redirect("/admin/schutters");
}

const importRows = z
  .array(
    z.object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      birthdate: z.iso.date(),
      rankCode: z.string().min(1),
    }),
  )
  .min(1)
  .max(2000);

/** Imports the validated rows; anything that already exists is skipped (checked again here). */
export async function importShooters(rows: unknown): Promise<FormState & { created?: number; skipped?: number }> {
  await requireRole("admin");
  const parsed = importRows.safeParse(rows);
  if (!parsed.success) return { error: "De gegevens zijn ongeldig. Controleer het bestand opnieuw." };
  const db = getDb();
  const year = await currentSeasonYear();
  const rankCodes = new Set((await db.select({ code: schema.ranks.code }).from(schema.ranks)).map((r) => r.code));
  const existing = new Set((await db.select().from(shooters)).map(shooterKey));

  const fresh = [];
  for (const row of parsed.data) {
    const key = shooterKey(row);
    if (existing.has(key) || !rankCodes.has(row.rankCode)) continue;
    existing.add(key);
    fresh.push({ ...row, id: crypto.randomUUID() });
  }
  if (fresh.length) {
    const juniors = new Set((await db.select().from(schema.ranks).where(eq(schema.ranks.isJunior, true))).map((r) => r.code));
    for (let i = 0; i < fresh.length; i += 500) {
      const chunk = fresh.slice(i, i + 500);
      await db.batch([
        db.insert(shooters).values(chunk.map(({ id, firstName, lastName, birthdate }) => ({ id, firstName, lastName, birthdate }))),
        db.insert(shooterSeasonRanks).values(
          chunk.map((s) => ({ shooterId: s.id, seasonYear: year, rankCode: s.rankCode, reason: juniors.has(s.rankCode) ? ("junior" as const) : ("start" as const) })),
        ),
      ]);
    }
  }
  invalidatePublic(year);
  refresh();
  return { created: fresh.length, skipped: parsed.data.length - fresh.length };
}
