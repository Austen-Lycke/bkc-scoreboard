/**
 * Copies every table to backups/<database>-<time>.json before something risky (a migration).
 * Runs on its own as `npm run db:backup` / `db:backup:prod`, and before every `db:migrate:prod`,
 * which stops when the backup fails. Neon's own restore window is the second safety net.
 *
 * The file holds members, results and password hashes: it stays on this machine (gitignored,
 * readable by you only). Login sessions are left out; restoring only means signing in again.
 */
import { loadEnv } from "@/lib/load-env";
const target = loadEnv();

import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";

const SKIP = new Set(["session", "verification"]);

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = neon(url);
  const database = new URL(url).pathname.slice(1);
  console.log(`Backup of ${target === "production" ? "LIVE" : "development"} database ${database}…`);

  const tables = (
    await sql.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name")
  )
    .map((r) => r.table_name as string)
    .filter((t) => !SKIP.has(t));

  // One read-only transaction: all tables from the same moment, even if a sync comes in meanwhile.
  const results = await sql.transaction(
    [
      ...tables.map((t) => sql.query(`SELECT * FROM "${t.replaceAll('"', '""')}"`)),
      sql.query(`SELECT * FROM drizzle.__drizzle_migrations ORDER BY id`),
    ],
    { isolationLevel: "RepeatableRead", readOnly: true },
  );

  const data: Record<string, unknown[]> = Object.fromEntries(tables.map((t, i) => [t, results[i]]));
  const migrations = results.at(-1);
  const at = new Date();
  const dir = "backups";
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${database}-${at.toISOString().replaceAll(":", "-").slice(0, 19)}.json`);
  writeFileSync(file, JSON.stringify({ database, createdAt: at.toISOString(), migrations, tables: data }), { mode: 0o600 });
  chmodSync(file, 0o600);

  for (const t of tables) console.log(`  ${t.padEnd(22)} ${data[t].length}`);
  console.log(`Saved ${file}`);
}

main().catch((err) => {
  console.error("Backup failed:", err);
  process.exit(1);
});
