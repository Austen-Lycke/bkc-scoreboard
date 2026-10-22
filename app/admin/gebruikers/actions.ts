"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { MIN_PASSWORD, resetPassword, upsertUser } from "@/lib/server/users";
import { requireRole } from "@/lib/session";

export interface FormState {
  error?: string;
  message?: string;
}

/** The roles you can hand out here; "owner" is set from the command line only. */
const role = z.enum(["admin", "operator"]);
const password = z.string().min(MIN_PASSWORD, `Het wachtwoord moet minstens ${MIN_PASSWORD} tekens hebben`).max(200);

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("owner");
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

/**
 * Accounts are the hoofdbeheerder's alone, so a beheerder can't take over or lock out anyone. Nobody
 * changes their own role or deletes themselves, and owner accounts are only changed from the command
 * line (scripts/create-admin.ts): there is always a hoofdbeheerder left.
 */
async function guard(userId: string, { allowSelf = false } = {}) {
  const session = await requireRole("owner");
  const self = session.user.id === userId;
  if (self && !allowSelf) return "Dat kan je niet voor je eigen account.";
  const target = await getDb().query.user.findFirst({ where: eq(schema.user.id, userId), columns: { role: true } });
  if (!target) return "Account niet gevonden.";
  if (target.role === "owner" && !self) return "Een hoofdbeheerder kan je hier niet aanpassen.";
  return null;
}

export async function setRole(userId: string, newRole: string): Promise<FormState> {
  const blocked = await guard(userId);
  if (blocked) return { error: blocked };
  const parsed = role.safeParse(newRole);
  if (!parsed.success) return { error: "Ongeldige rol" };
  await getDb().update(schema.user).set({ role: parsed.data }).where(eq(schema.user.id, userId));
  refresh();
  return { message: "Rol aangepast." };
}

export async function setPassword(userId: string, newPassword: string): Promise<FormState> {
  const blocked = await guard(userId, { allowSelf: true });
  if (blocked) return { error: blocked };
  const parsed = password.safeParse(newPassword);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await resetPassword(userId, parsed.data);
  return { message: "Nieuw wachtwoord ingesteld. Bestaande sessies van dit account zijn afgemeld." };
}

export async function deleteUser(userId: string): Promise<FormState> {
  const blocked = await guard(userId);
  if (blocked) return { error: blocked };
  await getDb().delete(schema.user).where(eq(schema.user.id, userId));
  refresh();
  return { message: "Account verwijderd." };
}
