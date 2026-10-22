"use client";

import { useState, useTransition } from "react";
import { fieldClass } from "@/components/styles";
import { Pill, Segmented, Tag } from "@/components/ui";
import { useSubmit, type FormState } from "../use-submit";
import { createUser, deleteUser, setPassword, setRole } from "./actions";

const MIN_PASSWORD = 10;
type Role = "admin" | "operator";

export function UserRow({ user, isSelf }: { user: { id: string; name: string; email: string; role: string }; isSelf: boolean }) {
  const [result, setResult] = useState<FormState>({});
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"password" | "delete" | null>(null);
  const [newPassword, setNewPassword] = useState("");
  // Another hoofdbeheerder is read-only here (the server refuses it too).
  const owner = user.role === "owner";
  const locked = owner && !isSelf;
  const run = (fn: () => Promise<FormState>, then?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (!r.error) then?.();
    });

  return (
    <li className="flex flex-col gap-2.5 p-[0.875rem]">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="mr-auto flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[0.9375rem] font-semibold">
            {user.name}
            {isSelf && (
              <Tag tone="yellow" size="sm">
                jij
              </Tag>
            )}
            {owner && (
              <Tag tone="ink" size="sm">
                hoofdbeheerder
              </Tag>
            )}
          </span>
          <span className="truncate text-[0.8125rem] text-muted">{user.email}</span>
        </div>
        {!owner && (
          <Segmented<Role>
            label={`Rol van ${user.name}`}
            size="sm"
            options={[
              { value: "admin", label: "Beheerder" },
              { value: "operator", label: "Wedstrijdleiding" },
            ]}
            value={user.role === "admin" ? "admin" : "operator"}
            disabled={isSelf || pending}
            onChange={(role) => run(() => setRole(user.id, role))}
          />
        )}
        {!locked && (
          <Pill
            size="xs"
            className="py-1.5"
            onClick={() => {
              setOpen(open === "password" ? null : "password");
              setNewPassword("");
              setResult({});
            }}
          >
            Nieuw wachtwoord
          </Pill>
        )}
        {!isSelf && !owner && (
          <Pill size="xs" tone="danger-outline" className="py-1.5" onClick={() => (setOpen("delete"), setResult({}))}>
            Verwijderen
          </Pill>
        )}
      </div>
      {open === "password" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setPassword(user.id, newPassword), () => setOpen(null));
          }}
        >
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={`Minstens ${MIN_PASSWORD} tekens`}
            aria-label={`Nieuw wachtwoord voor ${user.name}`}
            className={`${fieldClass} flex-1 py-2 text-sm`}
          />
          <Pill tone="ink" size="sm" type="submit" disabled={pending || newPassword.length < MIN_PASSWORD}>
            Instellen
          </Pill>
        </form>
      )}
      {open === "delete" && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-error-light px-[0.875rem] py-2.5">
          <span className="flex-1 text-[0.8125rem] font-semibold text-error">Account van {user.name} verwijderen?</span>
          <Pill tone="danger" size="sm" disabled={pending} onClick={() => run(() => deleteUser(user.id), () => setOpen(null))}>
            Ja, verwijderen
          </Pill>
          <Pill tone="ghost" size="sm" onClick={() => setOpen(null)}>
            Annuleren
          </Pill>
        </div>
      )}
      {result.error && <p className="text-[0.8125rem] font-semibold text-error">{result.error}</p>}
      {result.message && <p className="text-[0.8125rem] font-semibold text-good">{result.message}</p>}
    </li>
  );
}

export function NewUserForm() {
  const [role, setRoleValue] = useState<Role>("operator");
  const { state, pending, onSubmit } = useSubmit(createUser, (form) => {
    form.reset();
    setRoleValue("operator");
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 rounded-[1.5rem] border border-border bg-surface px-6 py-[1.375rem]">
      <h2 className="text-[1.0625rem] font-semibold">Account toevoegen</h2>
      <input type="hidden" name="role" value={role} />
      <input name="name" required placeholder="Naam" aria-label="Naam" className={fieldClass} />
      <input name="email" type="email" required placeholder="E-mailadres" aria-label="E-mailadres" className={fieldClass} />
      <Segmented<Role>
        label="Rol"
        options={[
          { value: "operator", label: "Wedstrijdleiding" },
          { value: "admin", label: "Beheerder" },
        ]}
        value={role}
        onChange={setRoleValue}
      />
      <input
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD}
        placeholder={`Wachtwoord · minstens ${MIN_PASSWORD} tekens`}
        aria-label="Wachtwoord"
        className={fieldClass}
      />
      {state.error && <p className="text-[0.8125rem] font-semibold text-error">{state.error}</p>}
      {state.message && <p className="text-pretty text-[0.8125rem] font-semibold text-good">{state.message}</p>}
      <Pill tone="yellow" size="lg" type="submit" disabled={pending}>
        {pending ? "Aanmaken…" : "Account aanmaken"}
      </Pill>
    </form>
  );
}
