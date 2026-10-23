"use server";

import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { readWsaForm, wsaCompetitionFormat } from "@/lib/server/competition-format";
import { requireRole } from "@/lib/session";

const newCompetition = z.object({
  name: z.string().trim().min(3, "Geef de wedstrijd een naam").max(120),
  date: z.iso.date("Kies een datum"),
  location: z.string().trim().max(120).optional(),
  kind: z.enum(["spanish", "wsa"]).default("spanish"),
  setupId: z.string().min(1).optional(),
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
  const session = await requireRole("admin", "operator");
  const parsed = newCompetition.safeParse({
    name: form.get("name"),
    date: form.get("date"),
    location: form.get("location") || undefined,
    kind: form.get("kind") || undefined,
    setupId: form.get("setupId") || undefined,
    countsForSeason: form.get("countsForSeason") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Controleer de gegevens" };
  const input = parsed.data;
  const seasonYear = Number(input.date.slice(0, 4));

  const db = getDb();
  // Every sync to a closed season's competition is refused for operators, so don't let them create one.
  const season = await db.query.seasons.findFirst({ where: eq(schema.seasons.year, seasonYear), columns: { status: true } });
  if (season?.status === "closed" && !hasRole(session.user.role, "admin")) {
    return { error: `Seizoen ${seasonYear} is afgesloten. Kies een datum in een open seizoen of vraag het aan een beheerder.` };
  }
  // A WSA day: its own format (lanes, series, groups, timer, knockout). A Spanish day: one setup for every rank.
  let shape: Pick<typeof schema.competitions.$inferInsert, "setupByRank" | "format">;
  if (input.kind === "wsa") {
    const wsa = readWsaForm(form);
    if (!wsa.success) return { error: wsa.error.issues[0]?.message ?? "Controleer de gegevens" };
    shape = await wsaCompetitionFormat(wsa.data);
  } else {
    const setup = input.setupId ? await db.query.setups.findFirst({ where: eq(schema.setups.id, input.setupId) }) : undefined;
    if (!setup) return { error: "Onbekende opstelling" };
    const rankRows = await db.select().from(schema.ranks);
    shape = { setupByRank: Object.fromEntries(rankRows.map((r) => [r.code, setup.definition])), format: null };
  }

  // A new season inherits the ranking rule of the latest one.
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
      // The club asks no entry fee (decided 2026-10-22); the column stays for older competitions.
      feeCents: 0,
      countsForSeason: input.countsForSeason,
      status: "prepared",
      ...shape,
    })
    .returning({ id: schema.competitions.id });

  redirect(`/operator/live?c=${created.id}`);
}
