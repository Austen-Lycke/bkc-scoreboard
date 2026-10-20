"use client";

import { useActionState, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import type { RankDef } from "@/lib/scoring";
import { deleteCompetition, releaseLease, updateCompetition, type FormState } from "../actions";
import { CLUB_TIME_ZONE } from "@/components/public/format";

const field = "rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-ink disabled:opacity-60";
const when = new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short", timeZone: CLUB_TIME_ZONE });

export function CompetitionForm({
  competition: c,
  ranks,
  setups,
  started,
}: {
  competition: {
    id: string;
    name: string;
    date: string;
    location: string;
    fee: string;
    countsForSeason: boolean;
    setupIds: Record<string, string>;
    operatorDeviceId: string | null;
    operatorLeaseAt: string | null;
  };
  ranks: RankDef[];
  setups: { id: string; name: string }[];
  started: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateCompetition, {});
  const [side, setSide] = useState<FormState>({});
  const [busy, start] = useTransition();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <form action={action} className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6">
        <input type="hidden" name="id" value={c.id} />
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Naam
          <input name="name" required defaultValue={c.name} className={field} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Datum
            <input name="date" type="date" required defaultValue={c.date} className={field} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Inschrijvingsgeld (€)
            <input name="fee" inputMode="decimal" defaultValue={c.fee} className={field} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Locatie
          <input name="location" defaultValue={c.location} className={field} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input name="countsForSeason" type="checkbox" defaultChecked={c.countsForSeason} className="size-4 accent-[var(--ink)]" />
          Telt mee voor het seizoensklassement
        </label>

        <fieldset className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <legend className="px-1 text-sm font-medium">Opstelling per klasse</legend>
          {started && <p className="text-sm text-muted">Er zijn al scores: de opstelling ligt vast.</p>}
          {ranks.map((r) => (
            <label key={r.code} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm">
              {r.name}
              <select name={`setup:${r.code}`} defaultValue={c.setupIds[r.code]} disabled={started} className={field}>
                {setups.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>

        {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
        {state.message && <p className="text-sm text-[#15803d] dark:text-[#4ade80]">{state.message}</p>}
        <Button tone="primary" type="submit" disabled={pending} className="self-start">
          {pending ? "Opslaan…" : "Opslaan"}
        </Button>
      </form>

      <aside className="flex flex-col gap-4">
        <Card className="p-5">
          <h2 className="font-semibold">Laptop van de wedstrijdleiding</h2>
          {c.operatorDeviceId ? (
            <>
              <p className="mt-2 text-sm text-muted">
                Toestel <span className="font-mono">{c.operatorDeviceId.slice(0, 12)}…</span> synchroniseert deze wedstrijd
                {c.operatorLeaseAt ? ` (laatst ${when.format(new Date(c.operatorLeaseAt))})` : ""}.
              </p>
              <p className="mt-2 text-sm text-muted">Laptop kwijt of kapot? Geef de wedstrijd vrij zodat een ander toestel kan overnemen.</p>
              <Button size="sm" className="mt-3" disabled={busy} onClick={() => start(async () => setSide(await releaseLease(c.id)))}>
                Vrijgeven
              </Button>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Nog geen toestel gekoppeld.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-semibold">Verwijderen</h2>
          <p className="mt-2 text-sm text-muted">
            {started
              ? "Er zijn al inschrijvingen of scores. Verwijderen wist alles van deze wedstrijd, ook op de website en in het klassement."
              : "Er is nog niets ingeschreven of gescoord."}
          </p>
          <Button
            size="sm"
            tone="danger"
            className="mt-3"
            disabled={busy}
            onClick={() => {
              if (started) {
                const typed = prompt(`Typ de naam van de wedstrijd om te bevestigen:\n${c.name}`);
                if (typed === null) return;
                start(async () => setSide(await deleteCompetition(c.id, typed)));
              } else if (confirm(`"${c.name}" definitief verwijderen?`)) {
                start(async () => setSide(await deleteCompetition(c.id)));
              }
            }}
          >
            Wedstrijd verwijderen
          </Button>
        </Card>
        {side.error && <p className="text-sm text-red-600">{side.error}</p>}
        {side.message && <p className="text-sm text-[#15803d] dark:text-[#4ade80]">{side.message}</p>}
      </aside>
    </div>
  );
}
