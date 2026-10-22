/**
 * Creates (or updates) a login from the command line. The hoofdbeheerder can also do this in
 * /admin/gebruikers, except making someone hoofdbeheerder ("owner"): that only happens here.
 *
 *   read -s "USER_PASSWORD?Password: " && export USER_PASSWORD && npm run create-user -- <email> "<name>" [owner|admin|operator]; unset USER_PASSWORD
 *
 * The password comes from the USER_PASSWORD env var, read with a hidden prompt as above, so it
 * isn't typed on the command line itself. For an existing account it may be left out: then only
 * the name and role change.
 */
import { loadEnv } from "@/lib/load-env";
const target = loadEnv();
console.log(`Database: ${target === "production" ? "LIVE" : "development (bkc_dev)"}`);

import type { Role } from "@/lib/auth";
import { MIN_PASSWORD, upsertUser } from "@/lib/server/users";

const ROLES: Role[] = ["owner", "admin", "operator"];

async function main() {
  const [email, name, role = "admin"] = process.argv.slice(2);
  const password = process.env.USER_PASSWORD;
  if (!email || !name || !ROLES.includes(role as Role)) {
    console.error('Usage: [USER_PASSWORD=…] npm run create-user -- <email> "<name>" [owner|admin|operator]');
    process.exit(1);
  }
  if (password !== undefined && password.length < MIN_PASSWORD) throw new Error(`Use a password of at least ${MIN_PASSWORD} characters.`);
  const { created } = await upsertUser({ email, name, role: role as Role, password: password || undefined });
  console.log(`${created ? "Created" : "Updated"} ${role} ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
