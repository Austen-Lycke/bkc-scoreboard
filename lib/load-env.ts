import { config } from "dotenv";

/**
 * Env for local scripts (seed, users, migrations). The development database by default; the live one
 * only when explicitly asked with DB_ENV=production (the `:prod` npm scripts). Next.js itself does the
 * same in `next dev`: .env.development.local takes precedence over .env.local.
 */
export function loadEnv(): "development" | "production" {
  const target = process.env.DB_ENV === "production" ? "production" : "development";
  const files = target === "production" ? [".env.local"] : [".env.development.local", ".env.local"];
  config({ path: files, quiet: true });
  return target;
}
