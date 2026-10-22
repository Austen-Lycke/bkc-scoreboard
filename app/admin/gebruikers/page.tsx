import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Lead, PageHead } from "../kit";
import { NewUserForm, UserRow } from "./user-forms";

export const metadata: Metadata = { title: "Gebruikers" };

export default async function UsersPage() {
  const session = await requireRole("owner");
  const users = await getDb()
    .select({ id: schema.user.id, name: schema.user.name, email: schema.user.email, role: schema.user.role })
    .from(schema.user)
    .orderBy(asc(schema.user.name));
  return (
    <>
      <PageHead title="Gebruikers">
        <Lead>
          <strong className="font-semibold text-ink">Beheerders</strong> kunnen alles behalve accounts beheren; dat doet enkel de{" "}
          <strong className="font-semibold text-ink">hoofdbeheerder</strong>. <strong className="font-semibold text-ink">Wedstrijdleiding</strong> kan
          wedstrijden aanmaken en leiden, maar niet aan schutters, seizoenen of accounts.
        </Lead>
      </PageHead>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ul className="divide-y divide-divider rounded-[1.5rem] border border-border bg-surface px-2.5 py-1.5">
          {users.map((u) => (
            <UserRow key={u.id} user={u} isSelf={u.id === session?.user.id} />
          ))}
        </ul>
        <NewUserForm />
      </div>
    </>
  );
}
