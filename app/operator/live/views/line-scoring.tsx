"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import {
  entryName,
  entryShortName,
  entriesOfGroup,
  entryTotal,
  heatKey,
  passOf,
  phaseDone,
  setupFor,
  timerStep,
  undoActions,
  undoScoreDrafts,
  type SavedPass,
} from "@/lib/competition";
import { buzz } from "@/lib/haptics";
import { offlineDb } from "@/lib/offline/db";
import { emitMany, updateLive } from "@/lib/offline/store";
import { achievableScores, passKey, type Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";
import { Kbd, Panel, Pill } from "@/components/ui";
import { useComp } from "../context";
import { useAutoPhase } from "../phase";
import { heatTitle, useLineup } from "./scoring";
import { AllShot, FinishedBanner, NextUp, PhaseDone } from "./scoring-banners";

/**
 * Scoring a WSA line: every shooter on their own frame, the scores typed from the scorecards. One row
 * per frame, one cell per series of this heat. Typed scores are drafts (on the TV right away); "Opslaan"
 * records every filled cell, so cards can come in per series. A score the plates can't make stays red.
 */
export function LineScoring() {
  const { id, state, live } = useComp();
  const { schedule, focusIndex, heatIndex, heat } = useLineup();
  const finished = state.status === "finished";
  const [editing, setEditing] = useState<string | null>(null);
  // What's in a cell while typing: the stored draft follows a few ms later, and a controlled input
  // that waited for it would drop the digits typed in between.
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputs = useRef(new Map<string, HTMLInputElement>());
  useEffect(() => () => clearTimeout(savedTimer.current), []);
  const advance = useAutoPhase();
  // The qualification is shot and the semi-final is next (or round 1 and round 2): first the break or not.
  const waiting = focusIndex < 0 && !!heat && phaseDone(state, heat.round);

  const drafts: Record<string, number> = { ...live?.draftScores };
  for (const [key, text] of Object.entries(typing)) {
    if (text === "") delete drafts[key];
    else drafts[key] = Number(text);
  }
  const setup = heat ? setupFor(state, heat.groupCode, heat.round) : null;
  const allowed = useMemo(() => (setup ? achievableScores(setup) : new Set<number>()), [setup]);
  /** Row-major: frame by frame, series 1 then 2, as on a scorecard. */
  const cells = heat ? heat.phases[0].flatMap((_, row) => heat.phases.map((phase) => phase[row])) : [];
  const keyOf = (s: { entryId: string; knockdown: number }) => passKey(s.entryId, heat!.round, s.knockdown);
  const valueOf = (s: { entryId: string; knockdown: number }) => drafts[keyOf(s)] ?? passOf(state, s.entryId, heat!.round, s.knockdown)?.score;
  const invalid = cells.filter((s) => {
    const v = drafts[keyOf(s)];
    return v !== undefined && !allowed.has(v);
  });
  const pending = cells.filter((s) => {
    const v = drafts[keyOf(s)];
    return v !== undefined && v !== passOf(state, s.entryId, heat!.round, s.knockdown)?.score;
  });
  const allFilled = cells.every((s) => valueOf(s) !== undefined);

  const type = (key: string, text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 3);
    setTyping((t) => ({ ...t, [key]: digits }));
    if (heat) void advance(heat.round);
    void updateLive(id, (current) => {
      const next = { ...(current.draftScores ?? {}) };
      if (digits === "") delete next[key];
      else next[key] = Number(digits);
      return { draftScores: next };
    });
  };

  async function save() {
    if (!heat || !setup || finished) return;
    // Read the drafts from storage, not from render state: the last digit may be milliseconds old.
    const stored = (await offlineDb().live.get(id))?.draftScores ?? {};
    const spots = heat.phases.flat();
    if (spots.some((s) => stored[keyOf(s)] !== undefined && !allowed.has(stored[keyOf(s)]))) return;
    const passes: SavedPass[] = spots.flatMap((s) => {
      const score = stored[keyOf(s)];
      const existing = passOf(state, s.entryId, heat.round, s.knockdown);
      if (score === undefined || existing?.score === score) return [];
      return [{ entryId: s.entryId, round: heat.round, knockdown: s.knockdown, hits: [], previous: existing?.hits ?? null, score, previousScore: existing?.score ?? null }];
    });
    if (passes.length === 0) return;
    await advance(heat.round);
    await emitMany(
      id,
      passes.map(({ entryId, round, knockdown, score }) => ({ type: "pass.recorded" as const, payload: { entryId, round, knockdown, hits: [], score } })),
    );
    const keys = new Set(spots.map(keyOf));
    const complete = spots.every((s) => stored[keyOf(s)] !== undefined || passOf(state, s.entryId, heat.round, s.knockdown));
    await updateLive(id, (current) => ({
      draftScores: Object.fromEntries(Object.entries(current.draftScores ?? {}).filter(([k]) => !keys.has(k))),
      // Stay on a heat the operator jumped to until all of it is in; otherwise follow the schedule.
      focus: focusIndex >= 0 && !complete ? current.focus : null,
      lastSave: { heatKey: heatKey(heat), phaseIndex: heat.phases.length - 1, focused: focusIndex >= 0, passes, at: new Date().toISOString() },
    }));
    buzz();
    setTyping({});
    setJustSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1000);
  }

  const lastSave = live?.lastSave ?? null;
  const canUndo = !finished && !!lastSave && lastSave.passes.some((p) => p.score !== undefined) && undoActions(state, lastSave) !== null;

  /** Takes the last save back: its passes return to how they were, its scores return as drafts. */
  async function undo() {
    const save = (await offlineDb().live.get(id))?.lastSave;
    if (!save || finished) return;
    const actions = undoActions(state, save);
    if (actions?.length) await emitMany(id, actions);
    await updateLive(id, (current) =>
      actions
        ? {
            lastSave: null,
            draftScores: { ...(current.draftScores ?? {}), ...undoScoreDrafts(save) },
            focus: save.focused || save.passes.some((p) => p.previousScore != null) ? { heatKey: save.heatKey, phaseIndex: save.phaseIndex } : null,
          }
        : { lastSave: null },
    );
    if (actions) buzz([20, 60, 20]);
    setTyping({});
    setJustSaved(false);
  }
  const undoRef = useRef(undo);
  useEffect(() => {
    undoRef.current = undo;
  });

  // Cmd/Ctrl+Z undoes the last save (outside a cell: there it undoes typing).
  useEffect(() => {
    function onKey(e: globalThis.KeyboardEvent) {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, select, textarea, [contenteditable], [role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undoRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const undoButton = canUndo && (
    <button
      type="button"
      onClick={undo}
      className="flex cursor-pointer items-center gap-3 rounded-[1.125rem] border-[0.09375rem] border-ink bg-surface px-[1.125rem] py-3 text-left transition hover:bg-hover"
    >
      <span aria-hidden className="text-xl leading-none">
        ↶
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-bold">Ongedaan maken</span>
        <span className="block truncate text-xs text-muted">{lastSave!.passes.length} scores terug naar vóór opslaan</span>
      </span>
    </button>
  );

  // Nobody left on the line: everything is shot, or a tie on a cut line holds up the knockout.
  if (!heat || !setup) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-7 pt-2 sm:px-8 md:landscape:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.875rem]">
          {finished && <FinishedBanner />}
          <AllShot />
        </div>
        {undoButton && <aside className="flex flex-none flex-col gap-2.5 md:landscape:w-[clamp(14.375rem,22vw,18.75rem)]">{undoButton}</aside>}
      </div>
    );
  }
  const series = heat.phases.length;

  /** Enter goes to the next cell (and saves on the last); arrows move up and down a column. */
  const onCellKey = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    const go = (i: number) => {
      const target = cells[i];
      if (!target) return false;
      inputs.current.get(keyOf(target))?.focus();
      return true;
    };
    if (e.key === "Enter") {
      e.preventDefault();
      if (!go(index + 1)) void save();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      go(index + series);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      go(index - series);
    }
  };

  // Live totals and places in the group, with what's typed on the line.
  const lineScore = (entryId: string) =>
    heat.phases.reduce((n, phase) => {
      const s = phase.find((x) => x.entryId === entryId)!;
      const v = valueOf(s);
      return n + (v !== undefined && allowed.has(v) ? v : 0);
    }, 0);
  const savedLine = (entryId: string) => heat.phases.reduce((n, phase) => n + (passOf(state, entryId, heat.round, phase.find((x) => x.entryId === entryId)!.knockdown)?.score ?? 0), 0);
  const liveTotal = (entryId: string) => entryTotal(state, entryId) - savedLine(entryId) + lineScore(entryId);
  const groupTotals = entriesOfGroup(state, heat.groupCode).map((e) => (heat.shooters.includes(e.entryId) ? liveTotal(e.entryId) : entryTotal(state, e.entryId)));
  const placeOf = (entryId: string) => 1 + groupTotals.filter((t) => t > liveTotal(entryId)).length;

  const next = heatIndex === null ? [] : schedule.slice(heatIndex + 1, heatIndex + 4);
  // Phone: narrower cells, so a short name still fits beside them.
  const grid = "grid items-center gap-x-1.5 sm:gap-x-2 grid-cols-[1.5rem_minmax(0,1fr)_repeat(var(--series),3.5rem)_2.5rem] sm:grid-cols-[2.75rem_minmax(0,1fr)_repeat(var(--series),4.25rem)_3.25rem]";
  const saveLabel = finished
    ? "Op slot"
    : justSaved
      ? "Opgeslagen ✓"
      : invalid.length
        ? "Eerst de rode vakjes nakijken"
        : pending.length === 0
          ? "Typ de punten van de kaarten"
          : allFilled
            ? "Opslaan & volgende"
            : "Opslaan";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-7 pt-2 sm:px-8 md:landscape:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.875rem]">
        {!waiting && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-1">
            <span className="text-[1.375rem] font-semibold first-letter:uppercase">{heatTitle(state, heat)}</span>
            <span className="flex items-baseline gap-3 text-sm text-muted">
              {focusIndex >= 0 && (
                <button type="button" onClick={() => updateLive(id, { focus: null })} className="cursor-pointer font-semibold text-ink underline underline-offset-2">
                  Terug naar de volgende in de rij
                </button>
              )}
              {setup.name} · {setup.targets.map((t) => t.points).join("·")}
            </span>
          </div>
        )}
        {finished && <FinishedBanner />}
        {waiting ? (
          <PhaseDone round={heat.round} />
        ) : (
          <>
            {state.format.timing && <SeriesTimerBar heat={heat} />}
            <Panel className="min-h-0 overflow-auto px-2 py-1.5 sm:px-3 md:flex-1">
              <div className={`${grid} border-b border-divider px-1 py-2 text-xs font-semibold text-faint`} style={{ "--series": series } as CSSProperties}>
                <span>KD</span>
                <span>Naam</span>
                {heat.phases.map((_, p) => (
                  <span key={p} className="text-center">
                    {series === 1 ? "Punten" : `Reeks ${p + 1}`}
                  </span>
                ))}
                <span className="text-right">Totaal</span>
              </div>
              {heat.phases[0].map((spot, row) => (
                <div key={spot.entryId} className={`${grid} border-b border-divider px-1 py-1 last:border-b-0`} style={{ "--series": series } as CSSProperties}>
                  <span className="text-sm font-semibold tabular-nums text-faint">{spot.lane}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-semibold max-sm:hidden">{entryName(state, spot.entryId)}</span>
                    <span className="block truncate text-[0.9375rem] font-semibold sm:hidden">{entryShortName(state, spot.entryId)}</span>
                    <span className="block text-xs text-muted">plaats {placeOf(spot.entryId)}</span>
                  </span>
                  {heat.phases.map((phase, p) => {
                    const s = phase[row];
                    const key = keyOf(s);
                    const draft = drafts[key];
                    const saved = passOf(state, s.entryId, heat.round, s.knockdown)?.score;
                    const value = draft ?? saved;
                    const bad = draft !== undefined && !allowed.has(draft) && editing !== key;
                    const unsaved = draft !== undefined && draft !== saved;
                    return (
                      <input
                        key={p}
                        ref={(el) => {
                          if (el) inputs.current.set(key, el);
                          else inputs.current.delete(key);
                        }}
                        inputMode="numeric"
                        enterKeyHint={row === heat.phases[0].length - 1 && p === series - 1 ? "done" : "next"}
                        aria-label={`${entryName(state, s.entryId)}, ${series === 1 ? "punten" : `reeks ${p + 1}`}`}
                        aria-invalid={bad}
                        disabled={finished}
                        value={typing[key] ?? (value === undefined ? "" : String(value))}
                        onChange={(e) => type(key, e.target.value)}
                        onFocus={(e) => (setEditing(key), e.target.select())}
                        onBlur={() => {
                          setEditing((k) => (k === key ? null : k));
                          setTyping((t) => Object.fromEntries(Object.entries(t).filter(([k]) => k !== key)));
                        }}
                        onKeyDown={(e) => onCellKey(e, row * series + p)}
                        className={`h-11 w-full min-w-0 rounded-xl border-2 text-center text-xl font-semibold tabular-nums outline-none transition-colors focus:border-ink disabled:opacity-45 ${
                          bad ? "border-error bg-error-light text-error" : unsaved ? "border-yellow bg-yellow-light" : saved !== undefined ? "border-transparent bg-fill" : "border-border bg-background"
                        }`}
                      />
                    );
                  })}
                  <span className="text-right text-lg font-semibold tabular-nums">{liveTotal(spot.entryId)}</span>
                </div>
              ))}
            </Panel>
          </>
        )}
      </div>
      {/* Phone: `contents`, so the save block can stick to the bottom over the whole view. */}
      <aside className="flex min-h-0 flex-none flex-col gap-4 max-md:contents md:portrait:flex-row md:portrait:items-end md:landscape:w-[clamp(14.375rem,22vw,18.75rem)] md:landscape:pt-11">
        <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 p-1 md:overflow-y-auto md:overscroll-contain md:portrait:flex-row md:portrait:items-start md:portrait:*:min-w-0 md:portrait:*:flex-1">
          <NextUp next={next} />
        </div>
        <div className="flex flex-none flex-col gap-2.5 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mb-4 max-md:bg-background max-md:pb-4 max-md:pt-2 md:portrait:w-[clamp(14.375rem,30vw,18.75rem)]">
          {undoButton}
          {invalid.length > 0 && (
            <div role="alert" className="rounded-[1.125rem] border-[0.09375rem] border-error bg-error-light px-[1.125rem] py-3 text-[0.8125rem] font-semibold text-error">
              {[...new Set(invalid.map((s) => drafts[keyOf(s)]))].join(", ")} kan niet op deze platen ({setup.targets.map((t) => t.points).join("·")}).
            </div>
          )}
          <button
            type="button"
            onClick={() => save()}
            disabled={finished || waiting || invalid.length > 0 || pending.length === 0}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-[1.125rem] bg-yellow px-[1.375rem] py-5 text-left text-lg font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>{saveLabel}</span>
            <Kbd className="touch:hidden">Enter</Kbd>
          </button>
          <div className="text-center text-xs text-faint touch:hidden">Enter volgende vakje · ↑↓ andere schutter · Enter op het laatste vakje slaat op · ⌘/Ctrl Z ongedaan</div>
        </div>
      </aside>
    </div>
  );
}

/**
 * The series countdown of this heat, on the TV: series, a short recovery, the next series. Starting it
 * moves the phase to the round (out of the warmup or the break, which stops that countdown), as the
 * TV only shows the line and its countdown while a round is on.
 */
function SeriesTimerBar({ heat }: { heat: Heat }) {
  const { id, state, live } = useComp();
  const advance = useAutoPhase();
  const timing = state.format.timing!;
  const timer = live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(250, !!timer);
  const step = timer ? timerStep(timing, heat.phases.length, timer, now) : null;
  const series = heat.phases.length;
  const start = async (fromSeries: number) => {
    await advance(heat.round);
    await updateLive(id, { seriesTimer: { heatKey: heatKey(heat), startedAt: new Date().toISOString(), fromSeries } });
  };
  const stop = () => updateLive(id, { seriesTimer: null });

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[1.25rem] border-[0.09375rem] px-4 py-3 ${
        step && step.kind !== "done" ? "border-ink bg-ink text-white" : "border-border bg-surface"
      }`}
    >
      <span className="min-w-0 flex-1 text-sm font-semibold">
        {!step ? (
          <span className="text-muted">
            Timer op TV · {series} × {formatClock(timing.seriesSeconds)}
            {series > 1 ? `, ${timing.recoverSeconds} s herstel` : ""}
          </span>
        ) : step.kind === "done" ? (
          "Reeksen gedaan · typ de kaarten in"
        ) : (
          <span className="flex items-baseline gap-3">
            <span className={step.kind === "recover" ? "text-yellow" : ""}>{step.kind === "series" ? (series === 1 ? "Reeks" : `Reeks ${step.series}`) : "Herstel"}</span>
            <span className="text-[1.75rem] leading-none tabular-nums">{formatClock(step.left)}</span>
          </span>
        )}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {!step || step.kind === "done" ? (
          <>
            <Pill tone="yellow" size="sm" onClick={() => start(1)} disabled={state.status === "finished"}>
              {series === 1 ? "Start reeks" : "Start reeks 1"}
            </Pill>
            {series > 1 && (
              <Pill tone="outline" size="sm" onClick={() => start(2)} disabled={state.status === "finished"}>
                Vanaf reeks 2
              </Pill>
            )}
          </>
        ) : (
          <Pill tone="surface" size="sm" onClick={stop}>
            Stop
          </Pill>
        )}
      </div>
    </div>
  );
}
