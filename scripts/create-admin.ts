/**
 * Creates (or updates) a login from the command line. Admins can also do this in /admin/gebruikers.
 *
 *   read -s "USER_PASSWORD?Password: " && export USER_PASSWORD && npm run create-user -- <email> "<name>" [admin|operator]; unset USER_PASSWORD
 *
 * The password comes from the USER_PASSWORD env var, read with a hidden prompt as above, so it
 * isn't typed on the command line itself.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { MIN_PASSWORD, upsertUser } from "@/lib/server/users";

async function main() {
  const [email, name, role = "admin"] = process.argv.slice(2);
  const password = process.env.USER_PASSWORD;
  if (!email || !name || !password || (role !== "admin" && role !== "operator")) {
    console.error('Usage: USER_PASSWORD=… npm run create-user -- <email> "<name>" [admin|operator]');
    process.exit(1);
  }
  if (password.length < MIN_PASSWORD) throw new Error(`Use a password of at least ${MIN_PASSWORD} characters.`);
  const { created } = await upsertUser({ email, name, role, password });
  console.log(`${created ? "Created" : "Updated"} ${role} ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
