"use client";

import { useMemo, useState } from "react";
import { entriesOfRank, rankName, rankShortName, ranksInShootingOrder } from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { entryAdultRank, fullName } from "@/lib/scoring";
import { useComp } from "../context";
import { Panel, Pill, Tag } from "@/components/ui";

const input = "w-full min-w-0 rounded-xl border-[1.5px] border-border bg-background px-3 py-2.5 text-[0.9375rem] outline-none focus:border-ink";

/**
 * Walk-in registration at the table: find or add the shooter and confirm their rank. Whoever shoots
 * has paid, so the fee isn't tracked here, and the operator picks the rank (no birthdate asked).
 */
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

  const done = () => {
    setSelected(null);
    setCreating(false);
    setQuery("");
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,23.75rem)_minmax(0,1fr)] items-start gap-5 overflow-auto px-8 pb-8 pt-2">
      <Panel className="flex flex-col gap-[0.875rem] p-[1.375rem]">
        <h2 className="text-[1.0625rem] font-semibold">Schutter inschrijven</h2>
        {creating ? (
          <NewShooterForm initialName={query} onDone={done} onCancel={() => setCreating(false)} />
        ) : (
          <>
            <input
              autoFocus
              value={query}
              onChange={(e) => (setQuery(e.target.value), setSelected(null))}
              placeholder="Zoek op naam…"
              className={`${input} rounded-[0.875rem] px-[0.875rem] py-3`}
              aria-label="Zoek schutter"
            />
            <div className="-mx-1 flex max-h-[55vh] flex-col gap-0.5 overflow-y-auto px-1">
              {candidates.map((s) =>
                selected === s.id ? (
                  <ConfirmEntry key={s.id} shooterId={s.id} onDone={done} onCancel={() => setSelected(null)} />
                ) : (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s.id)}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-hover"
                  >
                    <span className="text-[0.9375rem] font-semibold">{fullName(s)}</span>
                    <Tag className="ml-auto">{rankShortName(rankName(state, s.rankCode))}</Tag>
                  </button>
                ),
              )}
              {candidates.length === 0 && <span className="p-2.5 text-sm text-faint">Niemand gevonden.</span>}
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="cursor-pointer rounded-[0.875rem] border-[1.5px] border-dashed border-plate p-3 text-center text-sm font-semibold hover:border-ink"
            >
              + Nieuwe schutter
            </button>
          </>
        )}
      </Panel>
      <EntryList />
    </div>
  );
}

function RankChips({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const { state } = useComp();
  return (
    <div role="radiogroup" aria-label="Klasse" className="flex flex-wrap gap-1">
      {ranksInShootingOrder(state).map((r) => {
        const on = r.code === value;
        return (
          <button
            key={r.code}
            type="button"
            role="radio"
            aria-checked={on}
            title={r.name}
            onClick={() => onChange(r.code)}
            className={`cursor-pointer rounded-full border-[1.5px] px-[0.6875rem] py-1.5 text-[0.8125rem] font-semibold ${
              on ? "border-ink bg-ink text-white" : "border-border bg-surface hover:border-ink"
            }`}
          >
            {rankShortName(r.name)}
          </button>
        );
      })}
    </div>
  );
}

function ConfirmEntry({ shooterId, onDone, onCancel }: { shooterId: string; onDone: () => void; onCancel: () => void }) {
  const { id, state } = useComp();
  const shooter = state.shooters.get(shooterId)!;
  const [rankCode, setRankCode] = useState(shooter.rankCode);

  async function confirm() {
    await emit(id, "entry.checked_in", {
      entryId: crypto.randomUUID(),
      shooter: { id: shooter.id, firstName: shooter.firstName, lastName: shooter.lastName, birthdate: shooter.birthdate },
      isNewShooter: false,
      rankCode,
      feePaid: true,
      feeCents: state.snapshot.competition.feeCents,
    });
    onDone();
  }

  return (
    <div className="my-1 flex flex-col gap-3 rounded-2xl bg-hover p-[0.875rem]">
      <span className="text-base font-semibold">{fullName(shooter)}</span>
      <RankChips value={rankCode} onChange={setRankCode} />
      <div className="flex gap-1.5">
        <Pill tone="yellow" size="lg" onClick={confirm} autoFocus>
          Inschrijven
        </Pill>
        <Pill tone="ghost" size="lg" onClick={onCancel}>
          Annuleren
        </Pill>
      </div>
    </div>
  );
}

function NewShooterForm({ initialName, onDone, onCancel }: { initialName: string; onDone: () => void; onCancel: () => void }) {
  const { id, state } = useComp();
  const [first, ...rest] = initialName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(first ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));
  const [rankCode, setRankCode] = useState(() => entryAdultRank(state.snapshot.ranks).code);

  const full = `${firstName.trim()} ${lastName.trim()}`.toLowerCase();
  const enteredNames = new Set([...state.entries.values()].map((e) => fullName(state.shooters.get(e.shooterId)!).toLowerCase()));
  const duplicate =
    firstName.trim() && lastName.trim()
      ? enteredNames.has(full)
        ? "Deze schutter is al ingeschreven."
        : [...state.shooters.values()].some((s) => fullName(s).toLowerCase() === full)
          ? "Deze schutter bestaat al. Zoek op naam om in te schrijven."
          : null
      : null;
  const valid = !!firstName.trim() && !!lastName.trim() && !duplicate;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await emit(id, "entry.checked_in", {
      entryId: crypto.randomUUID(),
      shooter: { id: crypto.randomUUID(), firstName: firstName.trim(), lastName: lastName.trim(), birthdate: null },
      isNewShooter: true,
      rankCode,
      feePaid: true,
      feeCents: state.snapshot.competition.feeCents,
    });
    onDone();
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <label className="flex min-w-0 flex-col gap-[0.3125rem] text-[0.8125rem] font-semibold">
          Voornaam
          <input autoFocus required maxLength={80} value={firstName} onChange={(e) => setFirstName(e.target.value)} className={input} />
        </label>
        <label className="flex min-w-0 flex-col gap-[0.3125rem] text-[0.8125rem] font-semibold">
          Achternaam
          <input required maxLength={80} value={lastName} onChange={(e) => setLastName(e.target.value)} className={input} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-semibold">Klasse</span>
        <RankChips value={rankCode} onChange={setRankCode} />
      </div>
      {duplicate && <span className="text-[0.8125rem] font-semibold text-error">{duplicate}</span>}
      <div className="flex gap-1.5">
        <Pill tone="yellow" size="lg" type="submit" disabled={!valid}>
          Toevoegen en inschrijven
        </Pill>
        <Pill tone="ghost" size="lg" onClick={onCancel}>
          Annuleren
        </Pill>
      </div>
    </form>
  );
}

function EntryList() {
  const { id, state } = useComp();
  const active = [...state.entries.values()].filter((e) => !e.withdrawn).length;
  const hasPasses = (entryId: string) => [...state.passes.values()].some((p) => p.entryId === entryId);

  return (
    <div className="flex min-w-0 flex-col gap-[0.875rem]">
      <h2 className="px-1 pt-1 text-[1.375rem] font-semibold">{active} ingeschreven</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,21.25rem),1fr))] items-start gap-[0.875rem]">
        {ranksInShootingOrder(state).map((rank) => {
          const list = entriesOfRank(state, rank.code, { includeWithdrawn: true });
          return (
            <Panel key={rank.code} size="md" className="flex flex-col gap-1 px-[1.125rem] py-4">
              <div className="flex items-center justify-between pb-1.5">
                <span className="text-[0.9375rem] font-semibold">{rank.name}</span>
                <Tag>{list.filter((e) => !e.withdrawn).length}</Tag>
              </div>
              {list.length === 0 && <span className="border-t border-divider py-[0.4375rem] text-sm text-faint">Nog niemand.</span>}
              {list.map((e) => {
                const shooter = state.shooters.get(e.shooterId)!;
                const shot = hasPasses(e.entryId);
                return (
                  <div key={e.entryId} className="flex items-center gap-2 border-t border-divider py-[0.4375rem]">
                    <span className={`min-w-0 flex-1 truncate text-sm font-medium ${e.withdrawn ? "text-faint line-through" : ""}`}>{fullName(shooter)}</span>
                    <button
                      type="button"
                      onClick={() =>
                        shot ? emit(id, "entry.updated", { entryId: e.entryId, withdrawn: !e.withdrawn }) : emit(id, "entry.removed", { entryId: e.entryId })
                      }
                      className="cursor-pointer whitespace-nowrap rounded-full border-[1.5px] border-border px-2.5 py-[0.1875rem] text-xs font-semibold text-muted hover:border-ink hover:text-ink"
                    >
                      {!shot ? "Uitschrijven" : e.withdrawn ? "Terug actief" : "Afgehaakt"}
                    </button>
                  </div>
                );
              })}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
