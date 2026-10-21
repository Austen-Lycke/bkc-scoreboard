"use client";

import { useState, useTransition } from "react";
import { fieldClass } from "@/components/styles";
import { Chip, Pill, Switch } from "@/components/ui";
import { useSubmit } from "../use-submit";
import { deleteShooter, saveShooter } from "./actions";

export interface ShooterFormValues {
  id?: string;
  firstName: string;
  lastName: string;
  active: boolean;
  notes: string;
  rankCode: string;
}

export function ShooterForm({
  values,
  ranks,
  seasonYear,
  competitions = 0,
}: {
  values: ShooterFormValues;
  ranks: { code: string; name: string }[];
  seasonYear: number;
  /** Competitions shot so far: a shooter with history can't be deleted, only made inactive. */
  competitions?: number;
}) {
  const { state, pending, onSubmit, clear } = useSubmit(saveShooter);
  const [rankCode, setRankCode] = useState(values.rankCode);
  const [active, setActive] = useState(values.active);
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string>();
  const editing = !!values.id;

  return (
    <form
      onSubmit={onSubmit}
      onChange={clear}
      className="flex max-w-[36rem] flex-col gap-[1.125rem] rounded-[1.5rem] border border-border bg-surface px-[1.625rem] py-6"
    >
      {values.id && <input type="hidden" name="id" value={values.id} />}
      <input type="hidden" name="rankCode" value={rankCode} />
      {active && <input type="hidden" name="active" value="on" />}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex min-w-0 flex-col gap-[0.3125rem] text-[0.8125rem] font-semibold">
          Voornaam
          <input name="firstName" required defaultValue={values.firstName} className={fieldClass} />
        </label>
        <label className="flex min-w-0 flex-col gap-[0.3125rem] text-[0.8125rem] font-semibold">
          Achternaam
          <input name="lastName" required defaultValue={values.lastName} className={fieldClass} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-semibold">Klasse in seizoen {seasonYear}</span>
        <div role="group" aria-label={`Klasse in seizoen ${seasonYear}`} className="flex flex-wrap gap-1">
          {[...ranks, { code: "", name: "Nog niet ingedeeld" }].map((r) => (
            <Chip key={r.code} on={rankCode === r.code} onClick={() => (setRankCode(r.code), clear())}>
              {r.name}
            </Chip>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-[0.3125rem] text-[0.8125rem] font-semibold">
        <span>
          Notities <span className="font-normal text-muted">· enkel zichtbaar voor beheerders</span>
        </span>
        <textarea name="notes" rows={2} defaultValue={values.notes} className={`${fieldClass} resize-y`} />
      </label>
      <Switch on={active} onChange={(on) => (setActive(on), clear())}>
        <span className="font-semibold">Actief lid</span>
        <span className="text-muted"> · verschijnt bij inschrijving</span>
      </Switch>
      {(state.error || deleteError) && (
        <p role="alert" className="text-[0.8125rem] font-semibold text-error">
          {state.error ?? deleteError}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-4">
        <Pill tone="yellow" size="lg" type="submit" disabled={pending}>
          {pending ? "Opslaan…" : editing ? "Opslaan" : "Toevoegen"}
        </Pill>
        {state.message && <span className="text-[0.8125rem] font-semibold text-good">{state.message}</span>}
        {editing && competitions === 0 && !askDelete && (
          <Pill tone="danger-outline" className="ml-auto" onClick={() => setAskDelete(true)}>
            Verwijderen
          </Pill>
        )}
        {askDelete && (
          <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-error-light px-[0.875rem] py-3">
            <span className="min-w-48 flex-1 text-[0.8125rem] font-semibold text-error">Deze schutter definitief verwijderen?</span>
            <Pill
              tone="danger"
              size="sm"
              disabled={deleting}
              onClick={() => startDelete(async () => setDeleteError((await deleteShooter(values.id!)).error))}
            >
              {deleting ? "Verwijderen…" : "Ja, verwijderen"}
            </Pill>
            <Pill tone="ghost" size="sm" onClick={() => setAskDelete(false)}>
              Annuleren
            </Pill>
          </div>
        )}
        {editing && competitions > 0 && (
          <p className="w-full text-pretty text-[0.8125rem] text-muted">
            {values.firstName} schoot al {competitions} {competitions === 1 ? "wedstrijd" : "wedstrijden"} en kan niet verwijderd worden. Zet
            &ldquo;Actief lid&rdquo; uit om hem of haar uit de inschrijving te halen.
          </p>
        )}
      </div>
    </form>
  );
}
