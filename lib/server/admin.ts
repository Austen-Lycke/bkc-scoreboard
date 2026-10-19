import "server-only";
import { inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

/** Shooters that took part in at least one competition (can't be deleted, only deactivated). */
export async function shooterIdsWithEntries(ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set();
  const rows = await getDb().selectDistinct({ id: schema.entries.shooterId }).from(schema.entries).where(inArray(schema.entries.shooterId, ids));
  return new Set(rows.map((r) => r.id));
}
