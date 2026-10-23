import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

/** Database tests (npm run test:db): only against the bkc_test database from .env.test.local. */
export default defineConfig({
  resolve: { alias: { "@": here("./"), "server-only": here("./test/empty.ts") } },
  test: { include: ["lib/**/*.db.test.ts"], setupFiles: ["./test/load-test-env.ts"], fileParallelism: false },
});
