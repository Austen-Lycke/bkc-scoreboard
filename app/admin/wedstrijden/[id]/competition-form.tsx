"use client";

import { useState, useTransition } from "react";
import { fieldClass } from "@/components/styles";
import { Chip, Panel, Pill, Switch } from "@/components/ui";
import { useSubmit } from "../../use-submit";
import { deleteCompetition, releaseLease, updateCompetition, type FormState } from "../actions";

const label = "flex min-w-0 flex-col gap-[0.3125rem] text-[0.8125rem] font-semibold";

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
    countsForSeason: boolean;
    setupIds: Record<string, string>;
    /** A WSA day: its line, its two round variants and the optional knockout. Null: the Spanish day. */
    wsa: { lanes: number; round1: string; round2: string; semifinal: boolean; final: boolean } | null;
    /** The operator laptop holding this competition: short id and last sync. */
    device: { id: string; lastSeen: string | null } | null;
  };
  ranks: { code: string; name: string }[];
  setups: { id: string; name: string; title: string }[];
  /** Something was synced already (check-ins, scores): the setup is fixed and deleting needs the name. */
  started: boolean;
}) {
  const { state, pending, onSubmit, clear } = useSubmit(updateCompetition);
  const [counts, setCounts] = useState(c.countsForSeason);
  const [setupIds, setSetupIds] = useState(c.setupIds);
  const [wsa, setWsa] = useState(c.wsa);
  const [side, setSide] = useState<FormState>({});
  const [typed, setTyped] = useState("");
  const [releasing, startRelease] = useTransition();
  const [deleting, startDelete] = useTransition();
  const canDelete = !started || typed.trim() === c.name;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <form
        onSubmit={onSubmit}
        onChange={clear}
        className="flex flex-col gap-[1.125rem] rounded-[1.5rem] border border-border bg-surface px-[1.625rem] py-6"
      >
        <input type="hidden" name="id" value={c.id} />
        {counts && <input type="hidden" name="countsForSeason" value="on" />}
        {Object.entries(setupIds).map(([rank, id]) => (
          <input key={rank} type="hidden" name={`setup:${rank}`} value={id} />
        ))}
        {wsa && (
          <>
            <input type="hidden" name="setup:round1" value={wsa.round1} />
            <input type="hidden" name="setup:round2" value={wsa.round2} />
            {wsa.semifinal && <input type="hidden" name="semifinal" value="on" />}
            {wsa.final && <input type="hidden" name="final" value="on" />}
          </>
        )}
        <label className={label}>
          Naam
          <input name="name" required defaultValue={c.name} className={fieldClass} />
        </label>
        <div className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)] gap-3">
          <label className={label}>
            Datum
            <input name="date" type="date" required defaultValue={c.date} className={`${fieldClass} py-[0.5625rem]`} />
          </label>
          <label className={label}>
            Locatie
            <input name="location" defaultValue={c.location} className={fieldClass} />
          </label>
        </div>
        <Switch on={counts} onChange={(on) => (setCounts(on), clear())} className="font-semibold">
          Telt mee voor het seizoensklassement
        </Switch>

        {wsa ? (
          <div className={`flex flex-col gap-3 border-t border-divider pt-4 ${started ? "opacity-55" : ""}`}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.9375rem] font-semibold">WSA knockdown</span>
              {started && <span className="text-[0.8125rem] text-muted">Er zijn al scores: het formaat ligt vast.</span>}
            </div>
            <label className={`${label} max-w-[12rem]`}>
              Schutters tegelijk
              <input name="lanes" type="number" min={1} max={30} inputMode="numeric" disabled={started} defaultValue={wsa.lanes} className={fieldClass} />
            </label>
            {(["round1", "round2"] as const).map((round, i) => (
              <div key={round} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3">
                <span className="text-sm font-semibold">Ronde {i + 1}</span>
                <div role="group" aria-label={`Opstelling ronde ${i + 1}`} className="flex flex-wrap gap-1">
                  {setups
                    .filter((s) => s.id.startsWith("wsa_"))
                    .map((s) => (
                      <Chip key={s.id} on={wsa[round] === s.id} disabled={started} title={s.title} onClick={() => (setWsa({ ...wsa, [round]: s.id }), clear())}>
                        {s.name}
                      </Chip>
                    ))}
                </div>
              </div>
            ))}
            <p className="text-[0.8125rem] text-muted">Halve finale en finale schieten op de opstelling van ronde 2. De wedstrijdleiding kan ze op de dag nog aan- of uitzetten.</p>
            <Switch on={wsa.semifinal} onChange={(on) => !started && (setWsa({ ...wsa, semifinal: on }), clear())} className="font-semibold">
              Halve finale
            </Switch>
            <Switch on={wsa.final} onChange={(on) => !started && (setWsa({ ...wsa, final: on }), clear())} className="font-semibold">
              Finale
            </Switch>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 border-t border-divider pt-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[0.9375rem] font-semibold">Opstelling per klasse</span>
              {started && <span className="text-[0.8125rem] text-muted">Er zijn al scores: de opstelling ligt vast.</span>}
            </div>
            {ranks.map((r) => (
              <div key={r.code} className={`grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 ${started ? "opacity-55" : ""}`}>
                <span className="text-sm font-semibold">{r.name}</span>
                <div role="group" aria-label={`Opstelling ${r.name}`} className="flex flex-wrap gap-1">
                  {setups.map((s) => (
                    <Chip
                      key={s.id}
                      on={setupIds[r.code] === s.id}
                      disabled={started}
                      title={s.title}
                      onClick={() => (setSetupIds((ids) => ({ ...ids, [r.code]: s.id })), clear())}
                    >
                      {s.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {state.error && (
          <p role="alert" className="text-[0.8125rem] font-semibold text-error">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-divider pt-4">
          <Pill tone="yellow" size="lg" type="submit" disabled={pending}>
            {pending ? "Opslaan…" : "Opslaan"}
          </Pill>
          {state.message && (
            <span className="text-[0.8125rem] text-muted">
              <span className="font-semibold text-good">{state.message}</span>
              {c.device && " · download de gegevens opnieuw op de laptop (Voorbereiden)"}
            </span>
          )}
        </div>
      </form>

      <aside className="flex flex-col gap-4">
        <Panel size="md" className="flex flex-col gap-2.5 px-5 py-[1.125rem]">
          <h2 className="text-[0.9375rem] font-semibold">Laptop van de wedstrijdleiding</h2>
          {c.device ? (
            <>
              <p className="text-pretty text-[0.8125rem] text-muted">
                Toestel <span className="font-mono text-xs text-ink">{c.device.id}</span> synchroniseert deze wedstrijd
                {c.device.lastSeen && ` · laatst ${c.device.lastSeen}`}.
              </p>
              <p className="text-pretty text-[0.8125rem] text-muted">Laptop kwijt of kapot? Geef de wedstrijd vrij zodat een ander toestel kan overnemen.</p>
              <Pill tone="outline-ink" size="sm" className="self-start" disabled={releasing} onClick={() => startRelease(async () => setSide(await releaseLease(c.id)))}>
                Vrijgeven
              </Pill>
            </>
          ) : (
            <p className="text-pretty text-[0.8125rem] text-muted">{side.message ?? "Nog geen toestel gekoppeld."}</p>
          )}
        </Panel>

        <Panel size="md" className="flex flex-col gap-2.5 px-5 py-[1.125rem]">
          <h2 className="text-[0.9375rem] font-semibold">Verwijderen</h2>
          <p className="text-pretty text-[0.8125rem] text-muted">
            {started
              ? "Er zijn al inschrijvingen of scores. Verwijderen wist alles van deze wedstrijd, ook op de website en in het klassement."
              : "Er is nog niets ingeschreven of gescoord."}
          </p>
          {started && (
            <label className="flex flex-col gap-[0.3125rem] text-xs font-semibold text-muted">
              Typ de naam van de wedstrijd om te bevestigen
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={c.name}
                autoComplete="off"
                className={`${fieldClass} py-2 text-sm text-ink`}
              />
            </label>
          )}
          <button
            type="button"
            disabled={!canDelete || deleting}
            onClick={() => startDelete(async () => setSide(await deleteCompetition(c.id, typed)))}
            className={`self-start rounded-full px-[0.875rem] py-[0.4375rem] text-[0.8125rem] font-semibold transition ${
              canDelete ? "cursor-pointer bg-error text-white hover:brightness-110" : "cursor-not-allowed bg-error-light text-error"
            }`}
          >
            {deleting ? "Verwijderen…" : "Wedstrijd verwijderen"}
          </button>
          {side.error && <p className="text-[0.8125rem] font-semibold text-error">{side.error}</p>}
        </Panel>
      </aside>
    </div>
  );
}
