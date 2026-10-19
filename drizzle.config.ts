import { defineConfig } from "drizzle-kit";
import { loadEnv } from "./lib/load-env";

const target = loadEnv();
console.log(`Database: ${target === "production" ? "LIVE (neondb)" : "development (bkc_dev)"}`);

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  // Migrations use the direct (unpooled) connection; the app uses the pooled DATABASE_URL.
  dbCredentials: { url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)! },
});
