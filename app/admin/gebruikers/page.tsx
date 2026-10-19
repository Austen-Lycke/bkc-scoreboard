import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb, schema } from "@/lib/db";
import { getSession } from "@/lib/session";
import { NewUserForm, UserRow } from "./user-forms";

export const metadata: Metadata = { title: "Gebruikers" };

export default async function UsersPage() {
  const [session, users] = await Promise.all([
    getSession(),
    getDb().select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role }).from(schema.user).orderBy(asc(schema.user.name)),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Gebruikers</h1>
      <p className="max-w-2xl text-muted">
        <strong>Beheerders</strong> kunnen alles. <strong>Wedstrijdleiding</strong> kan wedstrijden aanmaken en leiden, maar niet aan
        schutters, seizoenen of accounts.
      </p>
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ul className="divide-y divide-border self-start rounded-xl border border-border bg-surface">
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === session?.user.id} />
          ))}
        </ul>
        <NewUserForm />
      </div>
    </div>
  );
}
