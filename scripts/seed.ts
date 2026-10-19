/** Idempotent base data: ranks, knockdown setups and the current season. Run: npm run db:seed */
import { config } from "dotenv";
config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_RANKS, SETUP_PRESETS } from "@/lib/scoring";

async function main() {
  const db = getDb();
  const year = Number(process.argv[2] ?? new Date().getFullYear());

  await db
    .insert(schema.ranks)
    .values(DEFAULT_RANKS.map((r) => ({ code: r.code, name: r.name, order: r.order, isJunior: !!r.isJunior })))
    .onConflictDoUpdate({
      target: schema.ranks.code,
      set: { name: sql`excluded.name`, order: sql`excluded.order`, isJunior: sql`excluded.is_junior` },
    });

  await db
    .insert(schema.setups)
    .values(SETUP_PRESETS.map((s) => ({ id: s.id, name: s.name, definition: s })))
    .onConflictDoUpdate({
      target: schema.setups.id,
      set: { name: sql`excluded.name`, definition: sql`excluded.definition` },
    });

  await db.insert(schema.seasons).values({ year, rankingRule: { type: "sum" } }).onConflictDoNothing();

  console.log(`Seeded ${DEFAULT_RANKS.length} ranks, ${SETUP_PRESETS.length} setups, season ${year}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
