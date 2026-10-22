"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  competitionProgress,
  competitionSchedule,
  entryName,
  groupOfRank,
  groupsInShootingOrder,
  heatKey,
  passColumns,
  passLabel,
  passOf,
  setupFor,
  shootsPass,
  standingsFor,
} from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { achievableScores, passKey, scorePass, type TieState } from "@/lib/scoring";
import { useComp, useNav } from "../context";
import { OPERATOR_HIT, OPERATOR_OPEN, Plate, plateRows } from "@/components/plates";
import { Empty, Pill, Tag } from "@/components/ui";

const TIE_TAG: Record<TieState, { label: string; tone: "fill" | "error" | "good" } | null> = {
  none: null,
  shared: { label: "gelijk", tone: "fill" },
  pending: { label: "afkamping nodig", tone: "error" },
  resolved: { label: "na afkamping", tone: "good" },
  waived: { label: "gedeelde plaats", tone: "fill" },
};

/** Standings per group (rank) with every pass; click a pass to correct it. */
export function StandingsView() {
  const { state, live } = useComp();
  const { goTo } = useNav();
  const ranks = groupsInShootingOrder(state).filter((r) => standingsFor(state, r.code).rows.length > 0);
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);

  // The phase on the line now (or the heat the operator jumped to): those cells are live.
  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const phaseIndex = focusIndex >= 0 ? live!.focus!.phaseIndex : progress.phaseIndex;
  const onLine = heat && phaseIndex !== null ? (heat.phases[Math.min(phaseIndex, heat.phases.length - 1)] ?? []) : [];

  const [rankCode, setRankCode] = useState(() => (heat && ranks.some((r) => r.code === heat.groupCode) ? heat.groupCode : ranks[0]?.code));
  const [editing, setEditing] = useState<{ entryId: string; round: number; knockdown: number } | null>(null);

  if (ranks.length === 0 || !rankCode) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 pt-2 sm:px-8">
        <Empty>Nog geen schutters.</Empty>
      </div>
    );
  }
  const standings = standingsFor(state, rankCode);
  const cols = passColumns(state, rankCode);
  const grid = { gridTemplateColumns: `3.5rem minmax(var(--name-col), 1fr) repeat(${cols.length}, 5.75rem) 6rem 9.375rem` };
  // Place and name stay put while the passes scroll sideways (phone, upright tablet).
  const pinned = "sticky z-[1] self-stretch flex items-center bg-surface";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.875rem] overflow-auto px-4 pb-8 pt-2 sm:px-8">
      <div className="flex flex-wrap items-center gap-1.5 max-sm:gap-y-2" role="tablist">
        {ranks.map((r) => {
          const on = r.code === rankCode;
          return (
            <button
              key={r.code}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setRankCode(r.code)}
              className={`cursor-pointer rounded-full border-[0.09375rem] px-4 py-2 text-[0.9375rem] font-semibold ${
                on ? "border-ink bg-ink text-white" : "border-border bg-surface hover:border-ink"
              }`}
            >
              {r.name}
            </button>
          );
        })}
        <span className="ml-auto text-[0.8125rem] text-faint">
          <span className="touch:hidden">Klik</span>
          <span className="hidden touch:inline">Tik</span> op een score om ze aan te passen
        </span>
      </div>
      <div className="overflow-x-auto rounded-[1.5rem] border border-border bg-surface px-2.5 py-2">
        {/* A narrower name column on a phone leaves room for a pass or two beside it. */}
        <div className="[--name-col:7.5rem] sm:[--name-col:10rem]" style={{ minWidth: `${47.5 + (cols.length - 4) * 5.75}rem` }}>
          <div className="grid items-center text-xs font-semibold text-faint" style={grid}>
            <span className={`${pinned} left-0 py-2.5 pl-[0.875rem]`}>Pl.</span>
            <span className={`${pinned} left-[3.5rem] py-2.5`}>Naam</span>
            {cols.map((c) => (
              <span key={`${c.round}${c.knockdown}`} className="text-center">
                {passLabel(c, " · ")}
              </span>
            ))}
            <span className="text-right">Totaal</span>
            <span />
          </div>
          {standings.rows.map((row) => {
            const tag = row.withdrawn ? ({ label: "afgehaakt", tone: "muted" } as const) : TIE_TAG[row.tie];
            return (
              <div key={row.entryId} className={`grid items-center border-t border-divider ${row.withdrawn ? "text-faint" : ""}`} style={grid}>
                <span className={`${pinned} left-0 pl-[0.875rem] text-xl font-semibold tabular-nums`}>{row.position ?? "–"}</span>
                <span className={`${pinned} left-[3.5rem] min-w-0 pr-2 text-base font-semibold`}>
                  <span className="truncate">{entryName(state, row.entryId)}</span>
                </span>
                {cols.map(({ round: r, knockdown: k, ...c }) => {
                  const key = `${r}${k}`;
                  // Knockout rounds are only for those who went on.
                  if (!shootsPass(state, row.entryId, r)) {
                    return (
                      <span key={key} className="text-center text-plate">
                        –
                      </span>
                    );
                  }
                  const pass = passOf(state, row.entryId, r, k);
                  const setup = setupFor(state, rankCode, r);
                  const isLive = !!heat && heat.round === r && onLine.some((s) => s.entryId === row.entryId && s.knockdown === k);
                  const liveScore =
                    setup.entry === "points"
                      ? (live?.draftScores?.[passKey(row.entryId, r, k)] ?? pass?.score ?? "·")
                      : scorePass(setup, live?.drafts[passKey(row.entryId, r, k)] ?? pass?.hits ?? []);
                  const tone = isLive ? "bg-yellow text-ink" : pass?.edited ? "bg-ink text-white" : pass ? "text-ink" : "text-plate";
                  const name = passLabel({ round: r, knockdown: k, ...c });
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => (isLive ? goTo("scoring", k) : setEditing({ entryId: row.entryId, round: r, knockdown: k }))}
                      aria-label={isLive ? `${name}: wordt nu geschoten` : `${name} aanpassen`}
                      title={pass?.note ? `Aangepast: ${pass.note}` : undefined}
                      className={`mx-1 my-1.5 flex h-11 cursor-pointer items-center justify-center gap-[0.3125rem] rounded-xl text-[1.0625rem] font-semibold tabular-nums hover:outline-[0.09375rem] hover:outline-ink ${tone}`}
                    >
                      {isLive ? liveScore : pass ? pass.score : "·"}
                      {isLive && <span className="text-[0.625rem] font-bold tracking-[0.04em]">NU</span>}
                    </button>
                  );
                })}
                <span className="text-right text-2xl font-semibold tracking-[-0.02em] tabular-nums">{row.total}</span>
                <span className="flex justify-end pr-3">{tag && <Tag tone={tag.tone} className="py-1">{tag.label}</Tag>}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-[1.125rem] px-1 text-[0.8125rem] text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-yellow" />
          wordt nu geschoten
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-ink" />
          aangepast
        </span>
        <span>· nog niet geschoten</span>
      </div>
      {editing && <PassEditor key={`${editing.entryId}${editing.round}${editing.knockdown}`} {...editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PassEditor({ entryId, round, knockdown, onClose }: { entryId: string; round: number; knockdown: number; onClose: () => void }) {
  const { id, state } = useComp();
  const entry = state.entries.get(entryId)!;
  const setup = setupFor(state, groupOfRank(state, entry.rankCode), round);
  const points = setup.entry === "points";
  const existing = passOf(state, entryId, round, knockdown);
  const [hits, setHits] = useState<string[]>(existing?.hits ?? []);
  // A setup scored in points (WSA): the score as typed from the scorecard.
  const [typed, setTyped] = useState(existing ? String(existing.score) : "");
  const typedScore = typed.trim() === "" ? null : Number(typed);
  const typedOk = typedScore !== null && achievableScores(setup).has(typedScore);
  // Why it was corrected: optional, kept with the pass for questions afterwards.
  const [note, setNote] = useState(existing?.note ?? "");

  async function save() {
    if (points && !typedOk) return;
    const reason = note.trim() ? { note: note.trim() } : {};
    await emit(id, "pass.recorded", points ? { entryId, round, knockdown, hits: [], score: typedScore!, ...reason } : { entryId, round, knockdown, hits, ...reason });
    onClose();
  }

  // Esc closes. Enter saves, also right after clicking a plate (the click leaves the focus on it, and
  // Enter would toggle that plate back); on Annuleren or Passage wissen it presses that button.
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && !(e.target instanceof Element && e.target.closest("[data-keep-enter], textarea"))) {
        e.preventDefault();
        void saveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  async function clear() {
    await emit(id, "pass.cleared", { entryId, round, knockdown });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 grid overflow-y-auto bg-ink/35 p-3 [place-items:safe_center] sm:p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Passage aanpassen"
        onClick={(e) => e.stopPropagation()}
        className="box-border flex w-[min(35rem,100%)] flex-col gap-1.5 rounded-[1.75rem] bg-surface px-5 py-[1.375rem] sm:px-7 sm:py-[1.625rem]"
      >
        <span className="text-[0.8125rem] text-muted">
          Ronde {round} · {state.format.rotate ? `Knockdown ${knockdown}` : `reeks ${knockdown}`}
        </span>
        <span className="text-[1.75rem] font-semibold tracking-[-0.02em]">{entryName(state, entryId)}</span>
        {points ? (
          <label className="flex flex-col gap-2 py-[1.375rem] text-sm font-semibold">
            Punten van de reeks
            <input
              autoFocus
              inputMode="numeric"
              value={typed}
              onChange={(e) => setTyped(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
              aria-invalid={typed !== "" && !typedOk}
              className={`w-32 rounded-xl border-2 bg-background px-4 py-2.5 text-[2rem] font-semibold tabular-nums outline-none ${
                typed !== "" && !typedOk ? "border-error" : "border-border focus:border-ink"
              }`}
            />
            <span className={`text-[0.8125rem] font-normal ${typed !== "" && !typedOk ? "font-semibold text-error" : "text-muted"}`}>
              {typed !== "" && !typedOk ? `${typed} kan niet op ${setup.name}` : `${setup.targets.map((t) => t.points).join("·")}`}
              {existing ? ` · was ${existing.score}` : " · nog niet geschoten"}
            </span>
          </label>
        ) : (
          <>
          {/* Plates at their size, smaller only when the dialog is narrower (phone). */}
          <div className="@container flex flex-col gap-4 py-[1.375rem]">
            {plateRows(setup).map((row, r) => (
              <div key={r} className="flex items-end justify-center gap-[min(0.875rem,3cqw)]">
                {row.map((t) => {
                  const hit = hits.includes(t.id);
                  const d = Math.max(2.75, (t.sizeMm * 0.62) / 16);
                  const c = t.sizeMm * 0.2;
                  return (
                    <Plate
                      key={t.id}
                      size={`max(2.75rem, min(${d.toFixed(3)}rem, ${c.toFixed(2)}cqw))`}
                      fontSize={`max(0.875rem, min(${(d * 0.34).toFixed(3)}rem, ${(c * 0.34).toFixed(2)}cqw))`}
                      look={hit ? OPERATOR_HIT : OPERATOR_OPEN}
                      label={`${t.label} (${t.points} ptn)${hit ? ", geraakt" : ""}`}
                      onClick={() => setHits((h) => (h.includes(t.id) ? h.filter((x) => x !== t.id) : [...h, t.id]))}
                    >
                      {t.points}
                    </Plate>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-baseline gap-[0.875rem] border-t border-divider pt-[0.875rem]">
            <span className="text-[3.5rem] font-semibold leading-[0.9] tracking-[-0.03em] tabular-nums">{scorePass(setup, hits)}</span>
            <span className="text-[0.9375rem] text-muted">{existing ? `was ${existing.score}` : "nog niet geschoten"}</span>
          </div>
          </>
        )}
        <label className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold">
          Reden <span className="sr-only">van de aanpassing</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 200))}
            placeholder="optioneel, bv. scorekaart nagekeken"
            className="rounded-xl border-[0.09375rem] border-border bg-background px-3 py-2.5 text-[0.9375rem] font-normal outline-none focus:border-ink"
          />
        </label>
        <div className="flex flex-wrap items-center gap-2 pt-4">
          <button
            type="button"
            onClick={save}
            disabled={points && !typedOk}
            className="cursor-pointer rounded-[0.875rem] bg-yellow px-5 py-3 text-[0.9375rem] font-bold hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            Opslaan
          </button>
          <Pill tone="ghost" data-keep-enter className="text-[0.9375rem]" onClick={onClose}>
            Annuleren
          </Pill>
          {existing && (
            <Pill tone="danger-outline" data-keep-enter size="sm" className="ml-auto" onClick={clear}>
              Passage wissen
            </Pill>
          )}
        </div>
      </div>
    </div>
  );
}
