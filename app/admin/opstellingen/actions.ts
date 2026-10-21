"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";

const targets = z.array(z.object({ id: z.string(), label: z.string().trim().min(1, "Elk doel heeft een naam nodig").max(40), points: z.number().int().min(0).max(100) })).min(1);

/** Changes names and points of a setup's targets. Existing competitions keep their own copy. */
export async function updateSetup(id: string, input: unknown): Promise<{ error?: string; message?: string }> {
  await requireRole("admin");
  const parsed = targets.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ongeldige invoer" };
  const db = getDb();
  const setup = await db.query.setups.findFirst({ where: eq(schema.setups.id, id) });
  if (!setup) return { error: "Opstelling niet gevonden" };
  const byId = new Map(parsed.data.map((t) => [t.id, t]));
  const definition = {
    ...setup.definition,
    targets: setup.definition.targets.map((t) => ({ ...t, label: byId.get(t.id)?.label ?? t.label, points: byId.get(t.id)?.points ?? t.points })),
  };
  await db.update(schema.setups).set({ definition }).where(eq(schema.setups.id, id));
  refresh();
  return { message: "Opgeslagen" };
}
