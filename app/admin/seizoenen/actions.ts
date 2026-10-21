"use server";

import { eq, sql } from "drizzle-orm";
import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { finalizeProposal } from "@/lib/admin/promotion";
import { getDb, schema } from "@/lib/db";
import { setFlash } from "@/lib/server/flash";
import { promotionProposal } from "@/lib/server/promotion";
import { RULE_LABEL } from "@/lib/server/season";
import { tags } from "@/lib/server/tags";
import { requireRole } from "@/lib/session";

export interface FormState {
  error?: string;
  message?: string;
}

const rule = z.discriminatedUnion("type", [
  z.object({ type: z.literal("sum") }),
  z.object({ type: z.literal("best_n"), n: z.coerce.number().int().min(1).max(50) }),
  z.object({ type: z.literal("average"), minParticipations: z.coerce.number().int().min(1).max(50) }),
]);

export async function updateRule(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const year = Number(form.get("year"));
  const type = form.get("type");
  const parsed = rule.safeParse(
    type === "best_n" ? { type, n: form.get("n") } : type === "average" ? { type, minParticipations: form.get("min") } : { type },
  );
  if (!parsed.success || !Number.isInteger(year)) return { error: "Ongeldige regel" };
  await getDb().update(schema.seasons).set({ rankingRule: parsed.data }).where(eq(schema.seasons.year, year));
  updateTag(tags.season(year));
  refresh();
  const label = RULE_LABEL(parsed.data);
  return { message: `Opgeslagen · nu: ${label.charAt(0).toLowerCase()}${label.slice(1)}` };
}

/**
 * Saves next season's ranks. The proposal is recomputed here (never trusted from the browser);
 * only the board's decisions come from the form.
 */
export async function savePromotion(year: number, decisions: Record<string, string>): Promise<FormState> {
  await requireRole("admin");
  if (!Number.isInteger(year)) return { error: "Ongeldig seizoen" };
  const db = getDb();
  const { ranks, rows, proposals } = await promotionProposal(year);
  const valid = new Set(ranks.map((r) => r.code));
  const clean = Object.fromEntries(Object.entries(decisions).filter(([id, code]) => valid.has(code) && rows.some((r) => r.shooterId === id)));
  const result = finalizeProposal(proposals, clean, new Set(ranks.filter((r) => r.isJunior).map((r) => r.code)));
  if (!result.ok) {
    const names = rows.filter((r) => result.undecided.includes(r.shooterId)).map((r) => r.name);
    return { error: `Beslis eerst over de gelijke stand op de promotiegrens: ${names.join(", ")}.` };
  }

  const current = await db.query.seasons.findFirst({ where: eq(schema.seasons.year, year) });
  await db.insert(schema.seasons).values({ year: year + 1, rankingRule: current?.rankingRule ?? { type: "sum" } }).onConflictDoNothing();
  if (result.ranks.length) {
    await db
      .insert(schema.shooterSeasonRanks)
      .values(result.ranks.map((r) => ({ shooterId: r.shooterId, seasonYear: year + 1, rankCode: r.rankCode, reason: r.reason })))
      .onConflictDoUpdate({
        target: [schema.shooterSeasonRanks.shooterId, schema.shooterSeasonRanks.seasonYear],
        set: { rankCode: sql`excluded.rank_code`, reason: sql`excluded.reason` },
      });
  }
  await db.update(schema.seasons).set({ status: "closed" }).where(eq(schema.seasons.year, year));

  for (const tag of [tags.season(year), tags.season(year + 1), tags.shooters, tags.competitions]) updateTag(tag);
  await setFlash(`Klassen ${year + 1} opgeslagen. Seizoen ${year} is afgesloten.`);
  redirect("/admin/seizoenen");
}
