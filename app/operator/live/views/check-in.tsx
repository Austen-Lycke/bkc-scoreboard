"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { entriesOfRank, rankName, rankShortName, ranksInShootingOrder } from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { entryAdultRank, fullName, similarNames, tidyName } from "@/lib/scoring";
import { useComp, useNav } from "../context";
import { Panel, Pill, Tag } from "@/components/ui";

const input = "w-full min-w-0 rounded-xl border-[0.09375rem] border-border bg-background px-3 py-2.5 text-[0.9375rem] outline-none focus:border-ink";

/** Right after an entry the list moves up: a double tap must not enter the next one too. */
const DOUBLE_TAP_MS = 500;

/**
 * Walk-in registration at the table: one tap on a name enters the shooter, in the rank they have this
 * season (changed under Beheer, not here). Whoever shoots has paid, so the fee isn't tracked here.
 */
export function CheckInView() {
  const { id, state } = useComp();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [entered, setEntered] = useState<{ entryId: string; name: string } | null>(null);
  const lastAt = useRef(-Infinity);
  const search = useRef<HTMLInputElement>(null);

  const checkedIn = useMemo(() => new Set([...state.entries.values()].map((e) => e.shooterId)), [state.entries]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...state.shooters.values()]
      .filter((s) => !checkedIn.has(s.id))
      .filter((s) => !q || fullName(s).toLowerCase().includes(q) || `${s.lastName} ${s.firstName}`.toLowerCase().includes(q))
      .sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))
      .slice(0, 50);
  }, [state.shooters, checkedIn, query]);

  useEffect(() => {
    if (!entered) return;
    const timer = setTimeout(() => setEntered(null), 6000);
    return () => clearTimeout(timer);
  }, [entered]);

  async function enter(shooterId: string) {
    const shooter = state.shooters.get(shooterId);
    const now = performance.now();
    if (!shooter || checkedIn.has(shooterId) || now - lastAt.current < DOUBLE_TAP_MS) return;
    lastAt.current = now;
    const entryId = crypto.randomUUID();
    setCreating(false);
    setQuery("");
    setEntered({ entryId, name: fullName(shooter) });
    // With a keyboard: straight on to the next name. On a touchscreen that would pop up the keyboard.
    if (!window.matchMedia("(pointer: coarse)").matches) search.current?.focus();
    await emit(id, "entry.checked_in", {
      entryId,
      shooter: { id: shooter.id, firstName: shooter.firstName, lastName: shooter.lastName, birthdate: shooter.birthdate },
      isNewShooter: false,
      rankCode: shooter.rankCode,
      feePaid: true,
      feeCents: state.snapshot.competition.feeCents,
    });
  }

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 items-start gap-5 overflow-auto px-4 pb-8 pt-2 sm:px-8 md:grid-cols-[minmax(0,23.75rem)_minmax(0,1fr)]">
      <EntrySections current="checkin" className="md:col-span-2" />
      <Panel className="flex flex-col gap-[0.875rem] p-4 sm:p-[1.375rem]">
        <h2 className="text-[1.0625rem] font-semibold">Schutter inschrijven</h2>
        {creating ? (
          <NewShooterForm
            initialName={query}
            onDone={() => (setCreating(false), setQuery(""))}
            onCancel={() => setCreating(false)}
            onPick={(shooterId) => void enter(shooterId)}
          />
        ) : (
          <>
            <input
              ref={search}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              // Enter enters the first match, or adds a new shooter.
              onKeyDown={(e) => {
                if (e.key !== "Enter" || e.repeat || !query.trim()) return;
                e.preventDefault();
                if (candidates.length) void enter(candidates[0].id);
                else setCreating(true);
              }}
              placeholder="Zoek op naam…"
              className={`${input} rounded-[0.875rem] px-[0.875rem] py-3`}
              aria-label="Zoek schutter"
            />
            <div className="-mx-1 flex max-h-[55vh] flex-col gap-0.5 overflow-y-auto px-1">
              {candidates.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => void enter(s.id)}
                  title={`${fullName(s)} inschrijven`}
                  className="group flex cursor-pointer items-center gap-2.5 rounded-xl p-2.5 text-left hover:bg-hover active:bg-yellow-light"
                >
                  <span className="min-w-0 truncate text-[0.9375rem] font-semibold">{fullName(s)}</span>
                  <Tag className="ml-auto">{rankShortName(rankName(state, s.rankCode))}</Tag>
                  <span aria-hidden className="grid size-6 flex-none place-items-center rounded-full border-[0.09375rem] border-border text-base leading-none text-muted group-hover:border-ink group-hover:bg-yellow group-hover:text-ink">
                    +
                  </span>
                </button>
              ))}
              {candidates.length === 0 && <span className="p-2.5 text-sm text-faint">Niemand gevonden.</span>}
            </div>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="cursor-pointer rounded-[0.875rem] border-[0.09375rem] border-dashed border-plate p-3 text-center text-sm font-semibold hover:border-ink"
            >
              + Nieuwe schutter
            </button>
            {/* Under the list: above it, it would move the names under the finger. */}
            <div role="status" className="empty:hidden">
              {entered && state.entries.has(entered.entryId) && (
                <span className="flex items-center gap-2 rounded-xl bg-good-light py-1.5 pl-3 pr-1.5 text-sm font-semibold text-good">
                  <span className="min-w-0 flex-1 text-balance">✓ {entered.name} ingeschreven</span>
                  <Pill size="xs" onClick={() => {
                      if (performance.now() - lastAt.current < DOUBLE_TAP_MS) return;
                      setEntered(null);
                      void emit(id, "entry.removed", { entryId: entered.entryId });
                    }}>
                    Ongedaan maken
                  </Pill>
                </span>
              )}
            </div>
          </>
        )}
      </Panel>
      <EntryList />
    </div>
  );
}

/** Inschrijving holds two screens: who's in, and the order they shoot in. `children` sit at the right. */
export function EntrySections({ current, className = "", children }: { current: "checkin" | "order"; className?: string; children?: React.ReactNode }) {
  const { goTo } = useNav();
  const sections = [
    { id: "checkin", label: "Schutters" },
    { id: "order", label: "Volgorde" },
  ] as const;
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 ${className}`}>
      <div role="tablist" aria-label="Inschrijving" className="flex gap-0.5 rounded-full border-[0.09375rem] border-border bg-surface p-[0.1875rem] text-sm font-semibold">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={current === s.id}
            onClick={() => goTo(s.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 ${current === s.id ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {children}
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
            className={`cursor-pointer rounded-full border-[0.09375rem] px-[0.6875rem] py-1.5 text-[0.8125rem] font-semibold ${
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

function NewShooterForm({
  initialName,
  onDone,
  onCancel,
  onPick,
}: {
  initialName: string;
  onDone: () => void;
  onCancel: () => void;
  /** "Bedoel je …?": check in that known shooter instead. */
  onPick: (shooterId: string) => void;
}) {
  const { id, state } = useComp();
  const [first, ...rest] = initialName.trim().split(/\s+/);
  const [firstName, setFirstName] = useState(first ?? "");
  const [lastName, setLastName] = useState(rest.join(" "));
  const [rankCode, setRankCode] = useState(() => entryAdultRank(state.snapshot.ranks).code);

  const typed = { firstName: tidyName(firstName), lastName: tidyName(lastName) };
  const full = `${typed.firstName} ${typed.lastName}`.toLowerCase();
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
  // A typo of someone the club already knows: suggest them before a second record is made.
  const entered = new Set([...state.entries.values()].map((e) => e.shooterId));
  const alike = !duplicate && typed.firstName && typed.lastName ? similarNames(typed, [...state.shooters.values()]).slice(0, 2) : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    await emit(id, "entry.checked_in", {
      entryId: crypto.randomUUID(),
      shooter: { id: crypto.randomUUID(), firstName: typed.firstName, lastName: typed.lastName, birthdate: null },
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
      {alike.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-yellow-light px-3 py-2 text-[0.8125rem] font-semibold">
          <span className="flex-1">
            Bedoel je {fullName(s)}?{entered.has(s.id) && <span className="font-normal text-muted"> Staat al ingeschreven.</span>}
          </span>
          {!entered.has(s.id) && (
            <Pill tone="ink" size="sm" onClick={() => onPick(s.id)}>
              Ja, die inschrijven
            </Pill>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
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
                      className="cursor-pointer whitespace-nowrap rounded-full border-[0.09375rem] border-border px-2.5 py-[0.1875rem] text-xs font-semibold text-muted hover:border-ink hover:text-ink"
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
