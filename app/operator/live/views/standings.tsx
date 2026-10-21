"use client";

import { useEffect, useMemo, useState } from "react";
import {
  competitionProgress,
  competitionSchedule,
  entryName,
  heatKey,
  passOf,
  ranksInShootingOrder,
  setupForRank,
  standingsFor,
} from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { passKey, scorePass, type TieState } from "@/lib/scoring";
import { useComp, useNav } from "../context";
import { OPERATOR_HIT, OPERATOR_OPEN, Plate, plateRows } from "@/components/plates";
import { Empty, Pill, Tag } from "@/components/ui";

const TIE_TAG: Record<TieState, { label: string; tone: "fill" | "error" | "good" } | null> = {
  none: null,
  shared: { label: "gelijk", tone: "fill" },
  pending: { label: "afkamping nodig", tone: "error" },
  resolved: { label: "na afkamping", tone: "good" },
};

/** Standings per rank with every pass; click a pass to correct it. */
export function StandingsView() {
  const { state, live } = useComp();
  const { goTo } = useNav();
  const ranks = ranksInShootingOrder(state).filter((r) => standingsFor(state, r.code).rows.length > 0);
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);

  // The phase on the line now (or the heat the operator jumped to): those cells are live.
  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const phaseIndex = focusIndex >= 0 ? live!.focus!.phaseIndex : progress.phaseIndex;
  const onLine = heat && phaseIndex !== null ? (heat.phases[Math.min(phaseIndex, heat.phases.length - 1)] ?? []) : [];

  const [rankCode, setRankCode] = useState(() => (heat && ranks.some((r) => r.code === heat.rankCode) ? heat.rankCode : ranks[0]?.code));
  const [editing, setEditing] = useState<{ entryId: string; round: number; knockdown: number } | null>(null);
  const { rounds, knockdowns } = state.snapshot.competition;

  if (ranks.length === 0 || !rankCode) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-8 pb-8 pt-2">
        <Empty>Nog geen schutters.</Empty>
      </div>
    );
  }
  const standings = standingsFor(state, rankCode);
  const setup = setupForRank(state.snapshot, rankCode);
  const cols: [number, number][] = [];
  for (let r = 1; r <= rounds; r++) for (let k = 1; k <= knockdowns; k++) cols.push([r, k]);
  const grid = { gridTemplateColumns: `3.5rem minmax(10rem, 1fr) repeat(${cols.length}, 5.75rem) 6rem 9.375rem` };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.875rem] overflow-auto px-8 pb-8 pt-2">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist">
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
        <div style={{ minWidth: `${47.5 + (cols.length - 4) * 5.75}rem` }}>
          <div className="grid items-center py-2.5 text-xs font-semibold text-faint" style={grid}>
            <span className="pl-[0.875rem]">Pl.</span>
            <span>Naam</span>
            {cols.map(([r, k]) => (
              <span key={`${r}${k}`} className="text-center">
                R{r} · KD{k}
              </span>
            ))}
            <span className="text-right">Totaal</span>
            <span />
          </div>
          {standings.rows.map((row) => {
            const tag = row.withdrawn ? ({ label: "afgehaakt", tone: "muted" } as const) : TIE_TAG[row.tie];
            return (
              <div key={row.entryId} className={`grid items-center border-t border-divider ${row.withdrawn ? "text-faint" : ""}`} style={grid}>
                <span className="pl-[0.875rem] text-xl font-semibold tabular-nums">{row.position ?? "–"}</span>
                <span className="truncate pr-2 text-base font-semibold">{entryName(state, row.entryId)}</span>
                {cols.map(([r, k]) => {
                  const pass = passOf(state, row.entryId, r, k);
                  const isLive = !!heat && heat.round === r && onLine.some((s) => s.entryId === row.entryId && s.knockdown === k);
                  const draft = live?.drafts[passKey(row.entryId, r, k)];
                  const tone = isLive ? "bg-yellow text-ink" : pass?.edited ? "bg-ink text-white" : pass ? "text-ink" : "text-plate";
                  return (
                    <button
                      key={`${r}${k}`}
                      type="button"
                      onClick={() => (isLive ? goTo("scoring", k) : setEditing({ entryId: row.entryId, round: r, knockdown: k }))}
                      aria-label={isLive ? `Ronde ${r} knockdown ${k}: wordt nu geschoten` : `Ronde ${r} knockdown ${k} aanpassen`}
                      className={`mx-1 my-1.5 flex h-11 cursor-pointer items-center justify-center gap-[0.3125rem] rounded-xl text-[1.0625rem] font-semibold tabular-nums hover:outline-[0.09375rem] hover:outline-ink ${tone}`}
                    >
                      {isLive ? scorePass(setup, draft ?? pass?.hits ?? []) : pass ? pass.score : "·"}
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
  const setup = setupForRank(state.snapshot, entry.rankCode);
  const existing = passOf(state, entryId, round, knockdown);
  const [hits, setHits] = useState<string[]>(existing?.hits ?? []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    await emit(id, "pass.recorded", { entryId, round, knockdown, hits });
    onClose();
  }
  async function clear() {
    await emit(id, "pass.cleared", { entryId, round, knockdown });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-ink/35 p-5" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Passage aanpassen"
        onClick={(e) => e.stopPropagation()}
        className="box-border flex w-[min(35rem,100%)] flex-col gap-1.5 rounded-[1.75rem] bg-surface px-7 py-[1.625rem]"
      >
        <span className="text-[0.8125rem] text-muted">
          Ronde {round} · Knockdown {knockdown}
        </span>
        <span className="text-[1.75rem] font-semibold tracking-[-0.02em]">{entryName(state, entryId)}</span>
        <div className="flex flex-col gap-4 py-[1.375rem]">
          {plateRows(setup).map((row, r) => (
            <div key={r} className="flex items-end justify-center gap-[0.875rem]">
              {row.map((t) => {
                const hit = hits.includes(t.id);
                const d = Math.max(2.75, (t.sizeMm * 0.62) / 16);
                return (
                  <Plate
                    key={t.id}
                    size={`${d.toFixed(3)}rem`}
                    fontSize={`${Math.max(0.875, d * 0.34).toFixed(3)}rem`}
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
        <div className="flex items-center gap-2 pt-4">
          <button type="button" onClick={save} className="cursor-pointer rounded-[0.875rem] bg-yellow px-5 py-3 text-[0.9375rem] font-bold hover:brightness-95">
            Opslaan
          </button>
          <Pill tone="ghost" className="text-[0.9375rem]" onClick={onClose}>
            Annuleren
          </Pill>
          {existing && (
            <Pill tone="danger-outline" size="sm" className="ml-auto" onClick={clear}>
              Passage wissen
            </Pill>
          )}
        </div>
      </div>
    </div>
  );
}
