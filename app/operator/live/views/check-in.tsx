"use client";

import { useMemo, useState } from "react";
import { entriesOfRank, rankName, ranksInShootingOrder } from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { fullName, initialRank } from "@/lib/scoring";
import { useComp } from "../context";
import { Badge, Button, Card, Empty, euro } from "@/components/ui";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-gold";

/** Walk-in registration at the table: find or add the shooter, confirm their rank, mark the fee paid. */
export function CheckInView() {
  const { state } = useComp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const checkedIn = useMemo(() => new Set([...state.entries.values()].map((e) => e.shooterId)), [state.entries]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.shooters.values()]
      .filter((s) => !checkedIn.has(s.id))
      .filter((s) => !q || fullName(s).toLowerCase().includes(q) || `${s.lastName} ${s.firstName}`.toLowerCase().includes(q))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .slice(0, 50);
  }, [state.shooters, checkedIn, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Schutter inschrijven</h2>
        {creating ? (
          <NewShooterForm initialName={query} onDone={() => (setCreating(false), setQuery(""))} />
        ) : (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => (setQuery(e.target.value), setSelected(null))}
              placeholder="Zoek op naam…"
              className={`mt-4 ${input}`}
              aria-label="Zoek schutter"
            />
            <ul className="mt-3 max-h-[60vh] divide-y divide-border overflow-y-auto">
              {candidates.map((s) =>
                selected === s.id ? (
                  <li key={s.id} className="py-3">
                    <ConfirmEntry shooterId={s.id} onDone={() => (setSelected(null), setQuery(""))} />
                  </li>
                ) : (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(s.id)}
                      className="flex w-full items-center justify-between gap-3 rounded-md px-2 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5"
                    >
                      <span>
                        <span className="font-medium">{fullName(s)}</span>
                        <span className="ml-2 text-sm text-muted">°{s.birthdate.slice(0, 4)}</span>
                      </span>
                      <Badge>{rankName(state, s.rankCode)}</Badge>
                    </button>
                  </li>
                ),
              )}
              {candidates.length === 0 && <li className="py-3 text-sm text-muted">Niemand gevonden.</li>}
            </ul>
            <Button className="mt-3 w-full" onClick={() => setCreating(true)}>
              + Nieuwe schutter
            </Button>
          </>
        )}
      </Card>
      <EntryList />
    </div>
  );
}

function ConfirmEntry({ shooterId, onDone }: { shooterId: string; onDone: () => void }) {
  const { id, state } = useComp();
  const shooter = state.shooters.get(shooterId)!;
  const [rankCode, setRankCode] = useState(shooter.rankCode);
  const [feePaid, setFeePaid] = useState(true);
  const fee = state.snapshot.competition.feeCents;

  async function confirm() {
    await emit(id, "entry.checked_in", {
      entryId: crypto.randomUUID(),
      shooter: { id: shooter.id, firstName: shooter.firstName, lastName: shooter.lastName, birthdate: shooter.birthdate },
      isNewShooter: false,
      rankCode,
      feePaid,
      feeCents: fee,
    });
    onDone();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-black/[0.03] p-3 dark:bg-white/5">
      <p className="font-medium">{fullName(shooter)}</p>
      <RankSelect value={rankCode} onChange={setRankCode} />
      {fee > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={feePaid} onChange={(e) => setFeePaid(e.target.checked)} className="size-4 accent-[var(--gold)]" />
          Inschrijvingsgeld betaald ({euro(fee)})
        </label>
      )}
      <div className="flex gap-2">
        <Button tone="primary" onClick={confirm} autoFocus>
          Inschrijven
        </Button>
        <Button tone="ghost" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </div>
  );
}

function NewShooterForm({ initialName, onDone }: { initialName: string; onDone: () => void }) {
  const { id, state } = useComp();
  const [first, ...rest] = initialName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(first ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));
  const [birthdate, setBirthdate] = useState("");
  const [rankOverride, setRankOverride] = useState<string | null>(null);
  const [feePaid, setFeePaid] = useState(true);
  const fee = state.snapshot.competition.feeCents;
  const { seasonYear } = state.snapshot.competition;
  const suggested = /^\d{4}-\d{2}-\d{2}$/.test(birthdate) ? initialRank(birthdate, seasonYear, state.snapshot.ranks).code : null;
  const rankCode = rankOverride ?? suggested;
  const valid = firstName.trim() && lastName.trim() && rankCode;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await emit(id, "entry.checked_in", {
      entryId: crypto.randomUUID(),
      shooter: { id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), birthdate },
      isNewShooter: true,
      rankCode: rankCode!,
      feePaid,
      feeCents: fee,
    });
    onDone();
  }

  return (
    <form onSubmit={save} className="mt-4 flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Voornaam
          <input autoFocus required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Achternaam
          <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Geboortedatum
        <input required type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className={input} />
      </label>
      {rankCode && (
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Klasse</span>
          <RankSelect value={rankCode} onChange={setRankOverride} />
          {suggested && !rankOverride && (
            <span className="text-muted">
              {state.snapshot.ranks.find((r) => r.code === suggested)?.isJunior ? "Jonger dan 18: Junior." : "Nieuwe volwassen schutters starten in de laagste klasse."}
            </span>
          )}
        </div>
      )}
      {fee > 0 && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={feePaid} onChange={(e) => setFeePaid(e.target.checked)} className="size-4 accent-[var(--gold)]" />
          Inschrijvingsgeld betaald ({euro(fee)})
        </label>
      )}
      <div className="flex gap-2">
        <Button tone="primary" type="submit" disabled={!valid}>
          Toevoegen en inschrijven
        </Button>
        <Button tone="ghost" onClick={onDone}>
          Annuleren
        </Button>
      </div>
    </form>
  );
}

function RankSelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { state } = useComp();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={input} aria-label="Klasse">
      {ranksInShootingOrder(state).map((r) => (
        <option key={r.code} value={r.code}>
          {r.name}
        </option>
      ))}
    </select>
  );
}

function EntryList() {
  const { id, state } = useComp();
  const entries = [...state.entries.values()];
  const paid = entries.filter((e) => e.feePaid);
  const hasPasses = (entryId: string) => [...state.passes.values()].some((p) => p.entryId === entryId);

  if (entries.length === 0) return <Empty>Nog niemand ingeschreven.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
        <span>
          <strong className="text-foreground">{entries.length}</strong> ingeschreven
        </span>
        {state.snapshot.competition.feeCents > 0 && (
          <span>
            <strong className="text-foreground">{euro(paid.reduce((s, e) => s + e.feeCents, 0))}</strong> ontvangen ·{" "}
            {entries.length - paid.length} nog niet betaald
          </span>
        )}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {ranksInShootingOrder(state).map((rank) => {
          const list = entriesOfRank(state, rank.code, { includeWithdrawn: true });
          return (
            <Card key={rank.code} className="p-4">
              <h3 className="flex items-center justify-between font-semibold">
                {rank.name} <Badge>{list.filter((e) => !e.withdrawn).length}</Badge>
              </h3>
              {list.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Niemand.</p>
              ) : (
                <ul className="mt-2 divide-y divide-border">
                  {list.map((e) => {
                    const shooter = state.shooters.get(e.shooterId)!;
                    return (
                      <li key={e.entryId} className="flex flex-wrap items-center gap-2 py-2">
                        <span className={`mr-auto ${e.withdrawn ? "text-muted line-through" : ""}`}>{fullName(shooter)}</span>
                        {state.snapshot.competition.feeCents > 0 && (
                          <Button size="sm" tone="ghost" onClick={() => emit(id, "entry.updated", { entryId: e.entryId, feePaid: !e.feePaid })}>
                            {e.feePaid ? <Badge tone="green">betaald</Badge> : <Badge tone="red">niet betaald</Badge>}
                          </Button>
                        )}
                        <select
                          value={e.rankCode}
                          disabled={hasPasses(e.entryId)}
                          onChange={(ev) => emit(id, "entry.updated", { entryId: e.entryId, rankCode: ev.target.value })}
                          className="rounded-md border border-border bg-background px-1.5 py-1 text-xs disabled:opacity-60"
                          aria-label={`Klasse van ${fullName(shooter)}`}
                          title={hasPasses(e.entryId) ? "Heeft al scores" : undefined}
                        >
                          {ranksInShootingOrder(state).map((r) => (
                            <option key={r.code} value={r.code}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        {hasPasses(e.entryId) ? (
                          <Button size="sm" tone="ghost" onClick={() => emit(id, "entry.updated", { entryId: e.entryId, withdrawn: !e.withdrawn })}>
                            {e.withdrawn ? "Terug actief" : "Afgehaakt"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            tone="ghost"
                            onClick={() => confirm(`${fullName(shooter)} uitschrijven?`) && emit(id, "entry.removed", { entryId: e.entryId })}
                          >
                            Uitschrijven
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
