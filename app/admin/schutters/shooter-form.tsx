"use client";

import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { deleteShooter, saveShooter, type FormState } from "./actions";

const field = "rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-gold";

export interface ShooterFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  birthdate: string;
  active: boolean;
  notes: string;
  rankCode: string;
}

export function ShooterForm({
  values,
  ranks,
  seasonYear,
  canDelete,
}: {
  values: ShooterFormValues;
  ranks: { code: string; name: string }[];
  seasonYear: number;
  canDelete: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveShooter, {});
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();

  return (
    <form action={action} className="flex max-w-xl flex-col gap-4 rounded-xl border border-border bg-surface p-6">
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Voornaam
          <input name="firstName" required defaultValue={values.firstName} className={field} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Achternaam
          <input name="lastName" required defaultValue={values.lastName} className={field} />
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Geboortedatum
        <input name="birthdate" type="date" required defaultValue={values.birthdate} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Klasse in seizoen {seasonYear}
        <select name="rankCode" defaultValue={values.rankCode} className={field}>
          <option value="">Nog niet ingedeeld (wordt bij inschrijving voorgesteld)</option>
          {ranks.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Notities <span className="font-normal text-muted">(enkel zichtbaar voor beheerders)</span>
        <textarea name="notes" rows={2} defaultValue={values.notes} className={field} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={values.active} className="size-4 accent-[var(--gold)]" />
        Actief lid (verschijnt bij inschrijving)
      </label>
      {(state.error || deleteError) && (
        <p role="alert" className="text-sm text-red-600">
          {state.error ?? deleteError}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button tone="primary" type="submit" disabled={pending}>
          {pending ? "Opslaan…" : "Opslaan"}
        </Button>
        {values.id && canDelete && (
          <Button
            tone="danger"
            className="ml-auto"
            disabled={deleting}
            onClick={() =>
              confirm("Deze schutter definitief verwijderen?") &&
              startDelete(async () => setDeleteError((await deleteShooter(values.id!)).error))
            }
          >
            Verwijderen
          </Button>
        )}
      </div>
    </form>
  );
}
