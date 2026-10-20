"use client";

import { useActionState, useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import { createUser, deleteUser, setPassword, setRole, type FormState } from "./actions";

const field = "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ink";

export function UserRow({ user, isSelf }: { user: { id: string; name: string; email: string; role: string }; isSelf: boolean }) {
  const [result, setResult] = useState<FormState>({});
  const [pending, start] = useTransition();
  const [newPassword, setNewPassword] = useState<string | null>(null);

  return (
    <li className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto min-w-0">
          <p className="font-medium">
            {user.name} {isSelf && <Badge>jij</Badge>}
          </p>
          <p className="truncate text-sm text-muted">{user.email}</p>
        </div>
        <select
          value={user.role}
          disabled={isSelf || pending}
          onChange={(e) => start(async () => setResult(await setRole(user.id, e.target.value)))}
          className={field}
          aria-label={`Rol van ${user.name}`}
        >
          <option value="admin">Beheerder</option>
          <option value="operator">Wedstrijdleiding</option>
        </select>
        <Button size="sm" onClick={() => setNewPassword(newPassword === null ? "" : null)}>
          Nieuw wachtwoord
        </Button>
        {!isSelf && (
          <Button size="sm" tone="danger" disabled={pending} onClick={() => confirm(`Account van ${user.name} verwijderen?`) && start(async () => setResult(await deleteUser(user.id)))}>
            Verwijderen
          </Button>
        )}
      </div>
      {newPassword !== null && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await setPassword(user.id, newPassword);
              setResult(r);
              if (!r.error) setNewPassword(null);
            });
          }}
        >
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Minstens 10 tekens"
            className={`${field} flex-1`}
            aria-label={`Nieuw wachtwoord voor ${user.name}`}
          />
          <Button type="submit" tone="primary" size="sm" disabled={pending}>
            Instellen
          </Button>
        </form>
      )}
      {result.error && <p className="text-sm text-red-600">{result.error}</p>}
      {result.message && <p className="text-sm text-[#15803d] dark:text-[#4ade80]">{result.message}</p>}
    </li>
  );
}

export function NewUserForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createUser, {});
  return (
    <form action={action} className="flex flex-col gap-3 self-start rounded-xl border border-border bg-surface p-5">
      <h2 className="font-semibold">Account toevoegen</h2>
      <input name="name" required placeholder="Naam" className={field} aria-label="Naam" />
      <input name="email" type="email" required placeholder="E-mailadres" className={field} aria-label="E-mailadres" />
      <select name="role" defaultValue="operator" className={field} aria-label="Rol">
        <option value="operator">Wedstrijdleiding</option>
        <option value="admin">Beheerder</option>
      </select>
      <input name="password" type="password" autoComplete="new-password" required placeholder="Wachtwoord (minstens 10 tekens)" className={field} aria-label="Wachtwoord" />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-[#15803d] dark:text-[#4ade80]">{state.message}</p>}
      <Button tone="primary" type="submit" disabled={pending}>
        {pending ? "Aanmaken…" : "Account aanmaken"}
      </Button>
    </form>
  );
}
