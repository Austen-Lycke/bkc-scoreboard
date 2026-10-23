import { config } from "dotenv";

config({ path: ".env.test.local", quiet: true, override: true });
// The tests truncate tables: never against the live or dev database.
if (!process.env.DATABASE_URL?.includes("/bkc_test")) throw new Error("DB tests only run against the bkc_test database");
