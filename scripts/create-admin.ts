/**
 * Creates (or resets the password of) a login. Public sign-up is disabled, so this is how
 * admins and operators get an account.
 *
 *   npm run create-user -- <email> "<name>" [admin|operator]
 *
 * The password is read from the USER_PASSWORD env var so it never ends up in shell history.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

async function main() {
  const [email, name, role = "admin"] = process.argv.slice(2);
  const password = process.env.USER_PASSWORD;
  if (!email || !name || !password || !["admin", "operator"].includes(role)) {
    console.error('Usage: USER_PASSWORD=… npm run create-user -- <email> "<name>" [admin|operator]');
    process.exit(1);
  }
  if (password.length < 10) throw new Error("Use a password of at least 10 characters.");

  const db = getDb();
  const hash = await hashPassword(password);
  const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email.toLowerCase()) });
  const userId = existing?.id ?? randomUUID();

  if (existing) {
    await db.update(schema.user).set({ name, role }).where(eq(schema.user.id, userId));
    await db
      .update(schema.account)
      .set({ password: hash })
      .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")));
  } else {
    await db.insert(schema.user).values({ id: userId, name, email: email.toLowerCase(), role, emailVerified: true });
    await db.insert(schema.account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hash,
    });
  }
  console.log(`${existing ? "Updated" : "Created"} ${role} ${email}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
