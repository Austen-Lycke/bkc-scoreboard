import "server-only";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { Role } from "@/lib/auth";

export const MIN_PASSWORD = 10;

/** Creates a login, or updates name/role/password of an existing one (matched on email). */
export async function upsertUser(input: { email: string; name: string; role: Role; password?: string }) {
  const db = getDb();
  const email = input.email.trim().toLowerCase();
  const existing = await db.query.user.findFirst({ where: eq(schema.user.email, email) });
  const userId = existing?.id ?? crypto.randomUUID();
  const hash = input.password ? await hashPassword(input.password) : null;

  if (existing) {
    await db.update(schema.user).set({ name: input.name, role: input.role }).where(eq(schema.user.id, userId));
    if (hash) await setPassword(userId, hash);
  } else {
    if (!hash) throw new Error("Een nieuw account heeft een wachtwoord nodig.");
    await db.insert(schema.user).values({ id: userId, name: input.name, email, role: input.role, emailVerified: true });
    await db.insert(schema.account).values({ id: crypto.randomUUID(), accountId: userId, providerId: "credential", userId, password: hash });
  }
  return { userId, created: !existing };
}

async function setPassword(userId: string, hash: string) {
  const db = getDb();
  const updated = await db
    .update(schema.account)
    .set({ password: hash })
    .where(and(eq(schema.account.userId, userId), eq(schema.account.providerId, "credential")))
    .returning({ id: schema.account.id });
  if (!updated.length) {
    await db.insert(schema.account).values({ id: crypto.randomUUID(), accountId: userId, providerId: "credential", userId, password: hash });
  }
}

export async function resetPassword(userId: string, password: string) {
  await setPassword(userId, await hashPassword(password));
  // Sign out everywhere: the old password's sessions end.
  await getDb().delete(schema.session).where(eq(schema.session.userId, userId));
}
