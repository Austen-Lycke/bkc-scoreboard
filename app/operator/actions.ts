"use server";

import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";

const newCompetition = z.object({
  name: z.string().trim().min(3, "Geef de wedstrijd een naam").max(120),
  date: z.iso.date("Kies een datum"),
  location: z.string().trim().max(120).optional(),
  fee: z
    .string()
    .trim()
    .transform((v) => (v === "" ? 0 : Math.round(Number(v.replace(",", ".")) * 100)))
    .pipe(z.number().int().min(0, "Ongeldig bedrag").max(100_000, "Ongeldig bedrag")),
  setupId: z.string().min(1),
  countsForSeason: z.boolean(),
});

export interface CreateCompetitionState {
  error?: string;
}

const slugify = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

export async function createCompetition(_prev: CreateCompetitionState, form: FormData): Promise<CreateCompetitionState> {
  await requireRole("admin", "operator");
  const parsed = newCompetition.safeParse({
    name: form.get("name"),
    date: form.get("date"),
    location: form.get("location") || undefined,
    fee: String(form.get("fee") ?? ""),
    setupId: form.get("setupId"),
    countsForSeason: form.get("countsForSeason") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controleer de gegevens" };
  const input = parsed.data;

  const db = getDb();
  const setup = await db.query.setups.findFirst({ where: eq(schema.setups.id, input.setupId) });
  if (!setup) return { error: "Onbekende opstelling" };
  const rankRows = await db.select().from(schema.ranks);

  // A new season inherits the ranking rule of the latest one.
  const seasonYear = Number(input.date.slice(0, 4));
  const latest = await db.query.seasons.findFirst({ orderBy: desc(schema.seasons.year) });
  await db
    .insert(schema.seasons)
    .values({ year: seasonYear, rankingRule: latest?.rankingRule ?? { type: "sum" } })
    .onConflictDoNothing();

  const base = `${input.date}-${slugify(input.name)}`;
  const taken = await db.query.competitions.findFirst({ where: eq(schema.competitions.slug, base) });
  const slug = taken ? `${base}-${crypto.randomUUID().slice(0, 4)}` : base;

  const [created] = await db
    .insert(schema.competitions)
    .values({
      slug,
      seasonYear,
      name: input.name,
      date: input.date,
      location: input.location,
      feeCents: input.fee,
      countsForSeason: input.countsForSeason,
      status: "prepared",
      setupByRank: Object.fromEntries(rankRows.map((r) => [r.code, setup.definition])),
    })
    .returning({ id: schema.competitions.id });

  redirect(`/operator/live?c=${created.id}`);
}
