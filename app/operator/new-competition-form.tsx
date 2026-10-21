"use client";

import { useActionState } from "react";
import { createCompetition, type CreateCompetitionState } from "./actions";

const field =
  "rounded-lg border border-border bg-background px-3 py-2 text-base outline-none focus:border-ink";

/** Filled in from the latest competition, so a regular club day only needs a name and a date. */
export interface CompetitionDefaults {
  from: string;
  location: string;
  fee: string;
  setupId?: string;
  countsForSeason: boolean;
}

export function NewCompetitionForm({ setups, defaults }: { setups: { id: string; name: string }[]; defaults?: CompetitionDefaults }) {
  const [state, action, pending] = useActionState<CreateCompetitionState, FormData>(createCompetition, {});
  return (
    <form action={action} className="mt-3 flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      {defaults && (
        <p className="text-sm text-muted">
          Locatie, inschrijvingsgeld en opstelling komen van <span className="font-medium text-ink">{defaults.from}</span>. Pas aan waar nodig.
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Naam
        <input name="name" required placeholder="Clubwedstrijd november" className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Datum
        <input name="date" type="date" required className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Locatie <span className="font-normal text-muted">(optioneel)</span>
        <input name="location" placeholder="Clublokaal" defaultValue={defaults?.location} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Inschrijvingsgeld (€)
        <input name="fee" inputMode="decimal" placeholder="5" defaultValue={defaults?.fee} className={field} />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        Opstelling
        <select name="setupId" defaultValue={defaults?.setupId ?? "spanish_knockdown"} className={field}>
          {setups.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="countsForSeason" type="checkbox" defaultChecked={defaults?.countsForSeason ?? true} className="size-4 accent-[var(--ink)]" />
        Telt mee voor het seizoensklassement
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-lg bg-navy px-4 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60 dark:bg-gold dark:text-navy"
      >
        {pending ? "Aanmaken…" : "Wedstrijd aanmaken"}
      </button>
    </form>
  );
}
