"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { MIN_PASSWORD, resetPassword, upsertUser } from "@/lib/server/users";
import { requireRole } from "@/lib/session";

export interface FormState {
  error?: string;
  message?: string;
}

const role = z.enum(["admin", "operator"]);
const password = z.string().min(MIN_PASSWORD, `Het wachtwoord moet minstens ${MIN_PASSWORD} tekens hebben`).max(200);

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const parsed = z
    .object({ name: z.string().trim().min(2, "Geef een naam").max(80), email: z.email("Ongeldig e-mailadres"), role, password })
    .safeParse({ name: form.get("name"), email: form.get("email"), role: form.get("role"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const exists = await getDb().query.user.findFirst({ where: eq(schema.user.email, parsed.data.email.toLowerCase()) });
  if (exists) return { error: "Er bestaat al een account met dit e-mailadres." };
  await upsertUser(parsed.data);
  refresh();
  return { message: `Account aangemaakt voor ${parsed.data.email}. Geef het wachtwoord persoonlijk door.` };
}

/** Guards against locking the club out: you can't demote or delete yourself, and one admin must remain. */
async function guard(userId: string) {
  const session = await requireRole("admin");
  if (session.user.id === userId) return "Dat kan je niet voor je eigen account.";
  return null;
}

async function otherAdmins(userId: string) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(schema.user)
    .where(and(eq(schema.user.role, "admin"), ne(schema.user.id, userId)));
  return n;
}

export async function setRole(userId: string, newRole: string): Promise<FormState> {
  const blocked = await guard(userId);
  if (blocked) return { error: blocked };
  const parsed = role.safeParse(newRole);
  if (!parsed.success) return { error: "Ongeldige rol" };
  if (parsed.data !== "admin" && (await otherAdmins(userId)) === 0) return { error: "Er moet minstens één beheerder overblijven." };
  await getDb().update(schema.user).set({ role: parsed.data }).where(eq(schema.user.id, userId));
  refresh();
  return { message: "Rol aangepast." };
}

export async function setPassword(userId: string, newPassword: string): Promise<FormState> {
  await requireRole("admin");
  const parsed = password.safeParse(newPassword);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await resetPassword(userId, parsed.data);
  return { message: "Nieuw wachtwoord ingesteld. Bestaande sessies van dit account zijn afgemeld." };
}

export async function deleteUser(userId: string): Promise<FormState> {
  const blocked = await guard(userId);
  if (blocked) return { error: blocked };
  if ((await otherAdmins(userId)) === 0) return { error: "Er moet minstens één beheerder overblijven." };
  await getDb().delete(schema.user).where(eq(schema.user.id, userId));
  refresh();
  return { message: "Account verwijderd." };
}
