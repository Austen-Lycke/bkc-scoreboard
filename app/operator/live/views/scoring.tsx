"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  competitionProgress,
  competitionSchedule,
  entryName,
  entryShortName,
  entryTotal,
  heatKey,
  passOf,
  rankName,
  sameHits,
  setupForRank,
  standingsFor,
  undoActions,
  undoDrafts,
  type SavedPass,
} from "@/lib/competition";
import { buzz } from "@/lib/haptics";
import { offlineDb } from "@/lib/offline/db";
import { emit, emitMany, updateLive } from "@/lib/offline/store";
import { passKey, scorePass, type Heat, type Setup } from "@/lib/scoring";
import { useComp, useNav } from "../context";
import { OPERATOR_HIT, OPERATOR_OPEN, Plate, plateRows } from "@/components/plates";
import { Empty, Kbd, Panel, Pill } from "@/components/ui";

/**
 * Scoring the heat that's shooting: one panel per knockdown, the shooter assigned to it in this
 * phase, and their plates. Taps are drafts (shown live on the TV); "Opslaan" records the passes.
 */
export function ScoringView({ activeKd, setActiveKd }: { activeKd: number; setActiveKd: (kd: number) => void }) {
  const { id, state, live } = useComp();
  const { goTo } = useNav();
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const [justSaved, setJustSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finished = state.status === "finished";

  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const rawPhase = focusIndex >= 0 ? live!.focus!.phaseIndex : progress.phaseIndex;
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const phaseIndex = heat && rawPhase !== null ? Math.min(rawPhase, heat.phases.length - 1) : null;
  const phase = heat && phaseIndex !== null ? heat.phases[phaseIndex] : null;
  const knockdowns = state.snapshot.competition.knockdowns;
  const drafts = useMemo(() => live?.drafts ?? {}, [live]);
  const setup = heat ? setupForRank(state.snapshot, heat.rankCode) : null;

  const hitsOf = useCallback(
    (entryId: string, kd: number) => {
      const key = passKey(entryId, heat!.round, kd);
      return drafts[key] ?? passOf(state, entryId, heat!.round, kd)?.hits ?? [];
    },
    [drafts, heat, state],
  );

  const toggle = useCallback(
    (kd: number, targetId: string) => {
      const a = phase?.find((s) => s.knockdown === kd);
      if (!a || !heat || finished) return;
      setActiveKd(kd);
      const key = passKey(a.entryId, heat.round, kd);
      const saved = passOf(state, a.entryId, heat.round, kd)?.hits ?? [];
      void updateLive(id, (current) => {
        const hits = current.drafts[key] ?? saved;
        const next = hits.includes(targetId) ? hits.filter((h) => h !== targetId) : [...hits, targetId];
        return { drafts: { ...current.drafts, [key]: next } };
      });
    },
    [finished, heat, id, phase, setActiveKd, state],
  );

  const setAll = useCallback(
    (kd: number, all: boolean) => {
      const a = phase?.find((s) => s.knockdown === kd);
      if (!a || !heat || !setup || finished) return;
      setActiveKd(kd);
      const key = passKey(a.entryId, heat.round, kd);
      void updateLive(id, (current) => ({ drafts: { ...current.drafts, [key]: all ? setup.targets.map((t) => t.id) : [] } }));
    },
    [finished, heat, id, phase, setActiveKd, setup],
  );

  /**
   * Knockdowns of this phase nobody filled in: no plate tapped, no "Niets", nothing saved before.
   * Saving those as 0 needs a confirmation, so a double tap on Opslaan can't record the next pair.
   */
  const untouchedIn = useCallback(
    (drafts: Record<string, string[]>) =>
      heat && phase
        ? phase.filter((a) => drafts[passKey(a.entryId, heat.round, a.knockdown)] === undefined && !passOf(state, a.entryId, heat.round, a.knockdown))
        : [],
    [heat, phase, state],
  );
  const phaseKey = heat && phaseIndex !== null ? `${heatKey(heat)}:${phaseIndex}` : null;
  // The phase whose 0 is being confirmed; a later phase never inherits the question.
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
  const untouched = untouchedIn(drafts);
  const confirming = confirmingFor !== null && confirmingFor === phaseKey && untouched.length > 0;

  const save = useCallback(async ({ allowEmpty = false } = {}) => {
    if (!heat || !phase || phaseIndex === null || finished) return;
    // Read the drafts from storage, not from render state: the last tap may be milliseconds old.
    const storedDrafts = (await offlineDb().live.get(id))?.drafts ?? {};
    if (!allowEmpty && untouchedIn(storedDrafts).length > 0) {
      setConfirmingFor(phaseKey);
      return;
    }
    setConfirmingFor(null);
    const passes: SavedPass[] = phase.map((a) => {
      const existing = passOf(state, a.entryId, heat.round, a.knockdown);
      const hits = storedDrafts[passKey(a.entryId, heat.round, a.knockdown)] ?? existing?.hits ?? [];
      return { entryId: a.entryId, round: heat.round, knockdown: a.knockdown, hits, previous: existing?.hits ?? null };
    });
    const actions = passes
      .filter((p) => !(p.previous && sameHits(p.previous, p.hits)))
      .map(({ entryId, round, knockdown, hits }) => ({ type: "pass.recorded" as const, payload: { entryId, round, knockdown, hits } }));
    if (actions.length) await emitMany(id, actions);
    // Stay on a heat the operator jumped to until its phases are done; otherwise follow the schedule.
    const nextPhase = phaseIndex + 1 < heat.phases.length ? phaseIndex + 1 : null;
    const keys = phase.map((a) => passKey(a.entryId, heat.round, a.knockdown));
    await updateLive(id, (current) => ({
      drafts: Object.fromEntries(Object.entries(current.drafts).filter(([k]) => !keys.includes(k))),
      focus: focusIndex >= 0 && nextPhase !== null ? { heatKey: heatKey(heat), phaseIndex: nextPhase } : null,
      lastSave: { heatKey: heatKey(heat), phaseIndex, focused: focusIndex >= 0, passes, at: new Date().toISOString() },
    }));
    buzz();
    setActiveKd(1);
    setJustSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 1600);
  }, [finished, focusIndex, heat, id, phase, phaseIndex, phaseKey, setActiveKd, state, untouchedIn]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Only while nothing changed those passes since (a correction in Stand, a takeover).
  const lastSave = live?.lastSave ?? null;
  const canUndo = !finished && !!lastSave && undoActions(state, lastSave) !== null;

  /** Takes the last save back: its passes return to how they were, its taps return as drafts. */
  const undo = useCallback(async () => {
    const save = (await offlineDb().live.get(id))?.lastSave;
    if (!save || finished) return;
    const actions = undoActions(state, save);
    if (actions?.length) await emitMany(id, actions);
    await updateLive(id, (current) =>
      actions
        ? {
            lastSave: null,
            drafts: { ...current.drafts, ...undoDrafts(save) },
            // New passes are cleared, so the schedule returns there by itself; otherwise go back to it.
            focus: save.focused || save.passes.some((p) => p.previous) ? { heatKey: save.heatKey, phaseIndex: save.phaseIndex } : null,
          }
        : { lastSave: null },
    );
    if (actions) buzz([20, 60, 20]);
    setActiveKd(1);
    setJustSaved(false);
  }, [finished, id, setActiveKd, state]);

  // Keyboard: 1–n toggles plates on the active knockdown, 0 is "Niets", W switches knockdown, Enter saves,
  // Esc drops the "0 opslaan?" question, Cmd/Ctrl+Z undoes. Enter never answers that question.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, select, textarea, [contenteditable], [role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!heat || !setup || finished) return;
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        setActiveKd((activeKd % knockdowns) + 1);
      } else if (e.key === "Enter" && !el?.closest("button")) {
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        setConfirmingFor(null);
      } else if (e.key === "0") {
        setAll(activeKd, false);
      } else if (/^[1-9]$/.test(e.key)) {
        const target = setup.targets[Number(e.key) - 1];
        if (target) toggle(activeKd, target.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeKd, finished, heat, knockdowns, save, setActiveKd, setAll, setup, toggle, undo]);

  if (state.entries.size === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-8 pt-2 sm:px-8">
        <Empty>Schrijf eerst schutters in.</Empty>
      </div>
    );
  }

  // Live totals of the shooters on the line, for "totaal … · plaats …".
  const liveTotal = (entryId: string, kd: number) => {
    const saved = passOf(state, entryId, heat!.round, kd);
    return entryTotal(state, entryId) - (saved?.score ?? 0) + scorePass(setup!, hitsOf(entryId, kd));
  };
  const placeOf = (entryId: string, total: number) => {
    const rows = standingsFor(state, heat!.rankCode).rows.filter((r) => !r.withdrawn && r.entryId !== entryId);
    const totals = rows.map((r) => {
      const onLine = phase!.find((s) => s.entryId === r.entryId);
      return onLine ? liveTotal(r.entryId, onLine.knockdown) : r.total;
    });
    return 1 + totals.filter((t) => t > total).length;
  };

  const next = heatIndex === null ? [] : schedule.slice(heatIndex + 1, heatIndex + 4);
  const lastPhase = !!heat && phaseIndex !== null && phaseIndex + 1 >= heat.phases.length;
  const saveLabel = finished ? "Op slot" : justSaved ? "Opgeslagen ✓" : lastPhase ? "Opslaan & volgende" : "Opslaan & wisselen";

  return (
    // Landscape from a tablet up: a side column next to the knockdowns. Upright tablet: that column goes
    // under them, so their plates keep their size. Phone: everything stacks and the page scrolls, with
    // undo and save stuck to the bottom of the screen.
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-7 pt-2 sm:px-8 md:landscape:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.875rem]">
        {heat && phase && phaseIndex !== null && setup ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-1">
              <span className="text-[1.375rem] font-semibold">
                {rankName(state, heat.rankCode)} · ronde {heat.round} · beurt {heat.index + 1}
              </span>
              <span className="flex items-baseline gap-3 text-sm text-muted">
                {focusIndex >= 0 && (
                  <button type="button" onClick={() => updateLive(id, { focus: null })} className="cursor-pointer font-semibold text-ink underline underline-offset-2">
                    Terug naar de volgende in de rij
                  </button>
                )}
                Fase {phaseIndex + 1} van {heat.phases.length}
                {phaseIndex > 0 ? " · gewisseld" : ""}
              </span>
            </div>
            {finished && <FinishedBanner />}
            {/* Side by side, except on a narrow phone: there they're stacked, at full width. */}
            <div
              className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-[repeat(var(--knockdowns),minmax(0,1fr))]"
              style={{ "--knockdowns": knockdowns } as CSSProperties}
            >
              {Array.from({ length: knockdowns }, (_, i) => i + 1).map((kd) => {
                const a = phase.find((s) => s.knockdown === kd);
                if (!a) {
                  return (
                    <div key={kd} className="grid place-items-center rounded-[1.5rem] border-[0.09375rem] border-dashed border-plate p-6 text-[0.9375rem] text-muted">
                      Knockdown {kd}: niemand in deze fase
                    </div>
                  );
                }
                const hits = hitsOf(a.entryId, kd);
                const total = liveTotal(a.entryId, kd);
                return (
                  <KnockdownPanel
                    key={kd}
                    kd={kd}
                    name={entryName(state, a.entryId)}
                    setup={setup}
                    hits={hits}
                    total={total}
                    place={placeOf(a.entryId, total)}
                    active={activeKd === kd}
                    locked={finished}
                    nudge={confirming && untouched.some((u) => u.knockdown === kd)}
                    onActivate={() => setActiveKd(kd)}
                    onToggle={(t) => toggle(kd, t)}
                    onAll={(all) => setAll(kd, all)}
                  />
                );
              })}
            </div>
          </>
        ) : (
          <>
            {finished && <FinishedBanner />}
            <Panel className="flex flex-col items-start gap-3 px-7 py-6">
              <span className="text-[1.375rem] font-semibold">Alle beurten zijn geschoten</span>
              <span className="text-[0.9375rem] text-muted">Kijk de stand na en los eventuele gelijke standen op via Afkamping.</span>
              <div className="flex flex-wrap gap-2">
                <Pill tone="ink" onClick={() => goTo("standings")}>
                  Naar de stand
                </Pill>
                <Pill onClick={() => goTo("shootoff")}>Naar afkamping</Pill>
              </div>
            </Panel>
          </>
        )}
      </div>
      {/* Phone: `contents`, so the save block can stick to the bottom over the whole view. */}
      <aside className="flex min-h-0 flex-none flex-col gap-4 max-md:contents md:portrait:flex-row md:portrait:items-end md:landscape:w-[clamp(14.375rem,22vw,18.75rem)] md:landscape:pt-11">
        {/* On a short screen (tablet in landscape) these scroll, so undo and save always stay in view. */}
        <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 p-1 sm:max-md:flex-row sm:max-md:items-start sm:max-md:*:min-w-0 sm:max-md:*:flex-1 md:overflow-y-auto md:overscroll-contain md:portrait:flex-row md:portrait:items-start md:portrait:*:min-w-0 md:portrait:*:flex-1">
          {heat && phaseIndex !== null && heat.phases.length > 1 && <SwapSchedule heat={heat} phaseIndex={phaseIndex} />}
          <Panel size="md" className="flex flex-col gap-3 px-5 py-[1.125rem]">
            <div className="text-[0.9375rem] font-semibold">Daarna</div>
            {next.length === 0 ? (
              <span className="text-sm text-muted">Niemand meer.</span>
            ) : (
              next.map((h, j) => (
                <div key={heatKey(h)} className="flex items-center gap-3">
                  <span className="grid size-[1.625rem] flex-none place-items-center rounded-full border-[0.09375rem] border-border text-xs font-semibold">{j + 1}</span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{h.shooters.map((e) => entryName(state, e)).join(" & ")}</div>
                    <div className="text-xs text-muted">
                      Ronde {h.round} · {rankName(state, h.rankCode)} · beurt {h.index + 1}
                    </div>
                  </div>
                </div>
              ))
            )}
          </Panel>
        </div>
        <div className="flex flex-none flex-col gap-2.5 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mb-4 max-md:bg-background max-md:pb-4 max-md:pt-2 md:portrait:w-[clamp(14.375rem,30vw,18.75rem)]">
          {canUndo && (
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
                <span className="block truncate text-xs text-muted">
                  {lastSave!.passes.map((p) => entryShortName(state, p.entryId)).join(" & ")} terug naar vóór opslaan
                </span>
              </span>
            </button>
          )}
          {confirming && (
            // Above the save button, so a second tap on Opslaan never lands on "0 opslaan".
            <div role="alert" className="flex flex-col gap-2.5 rounded-[1.125rem] border-[0.09375rem] border-yellow bg-yellow-light px-[1.125rem] py-3">
              <span className="text-[0.9375rem] font-bold">
                Nog niets ingevuld voor{" "}
                {untouched.map((a, i) => (
                  <Fragment key={a.entryId}>
                    {i > 0 && " & "}
                    <span className="whitespace-nowrap">{entryShortName(state, a.entryId)}</span>
                  </Fragment>
                ))}
              </span>
              <span className="text-[0.8125rem] text-muted">Alles mis? Kies Niets, of sla 0 op.</span>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="ink" size="sm" onClick={() => save({ allowEmpty: true })}>
                  0 opslaan
                </Pill>
                <Pill tone="ghost" size="sm" onClick={() => setConfirmingFor(null)}>
                  Annuleren
                </Pill>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => save()}
            disabled={finished || !phase}
            className="flex cursor-pointer items-center justify-between rounded-[1.125rem] bg-yellow px-[1.375rem] py-5 text-lg font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>{saveLabel}</span>
            <Kbd className="touch:hidden">Enter</Kbd>
          </button>
        </div>
        <div className="text-center text-xs text-faint touch:hidden">
          1–{setup?.targets.length ?? 7} plaat · 0 niets · W andere kant · Enter opslaan · ⌘/Ctrl Z ongedaan
        </div>
      </aside>
    </div>
  );
}

function FinishedBanner() {
  const { id, state } = useComp();
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ink px-[1.125rem] py-3 text-[0.9375rem] font-semibold text-white">
      <span className="flex-1">Wedstrijd beëindigd. Scoren staat op slot.</span>
      <button
        type="button"
        onClick={() => emit(id, "status.set", { status: state.previousStatus && state.previousStatus !== "finished" ? state.previousStatus : "round2" })}
        className="cursor-pointer rounded-full border-[0.09375rem] border-white px-[0.875rem] py-1.5 text-[0.8125rem]"
      >
        Heropenen
      </button>
    </div>
  );
}

function KnockdownPanel(props: {
  kd: number;
  name: string;
  setup: Setup;
  hits: string[];
  total: number;
  place: number;
  active: boolean;
  locked: boolean;
  /** Saving asked about this knockdown: point at "Niets". */
  nudge: boolean;
  onActivate: () => void;
  onToggle: (targetId: string) => void;
  onAll: (all: boolean) => void;
}) {
  const { kd, name, setup, hits, total, place, active, locked } = props;
  const scale = 0.92;
  return (
    <div
      role="group"
      aria-label={`Knockdown ${kd}: ${name}`}
      onClick={props.onActivate}
      className={`flex min-h-0 min-w-0 cursor-pointer select-none flex-col overflow-hidden rounded-[1.5rem] border-2 bg-surface px-4 py-4 transition-colors sm:px-6 sm:py-[1.375rem] ${
        active ? "border-ink" : "border-border"
      } ${locked ? "opacity-45" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-[0.6875rem] py-1 text-[0.8125rem] font-semibold ${active ? "bg-yellow" : "bg-fill"}`}>KD {kd}</span>
        <span className="text-[0.8125rem] text-faint">
          {active ? (
            "actief"
          ) : (
            <>
              <span className="touch:hidden">klik om te scoren</span>
              <span className="hidden touch:inline">tik een plaat</span>
            </>
          )}
        </span>
      </div>
      <div className="mt-2.5 truncate text-[clamp(1.375rem,2.3vw,2rem)] font-semibold tracking-[-0.02em]">{name}</div>
      <div className="@container flex min-h-0 flex-1 flex-col justify-center gap-5 py-3">
        {plateRows(setup).map((row, r) => (
          <div key={r} className="flex items-end justify-center gap-[3cqw]">
            {row.map((t) => {
              const hit = hits.includes(t.id);
              const c = t.sizeMm * scale * 0.2;
              return (
                <Plate
                  key={t.id}
                  size={`max(2.75rem, min(${c.toFixed(2)}cqw, ${((t.sizeMm * scale * 1.15) / 16).toFixed(3)}rem))`}
                  fontSize={`max(0.75rem, min(${(c * 0.32).toFixed(2)}cqw, ${((t.sizeMm * scale * 0.37) / 16).toFixed(3)}rem))`}
                  look={hit ? OPERATOR_HIT : OPERATOR_OPEN}
                  onClick={() => props.onToggle(t.id)}
                  disabled={locked}
                  label={`${t.label} (${t.points} ptn)${hit ? ", geraakt" : ""}`}
                >
                  {t.points}
                </Plate>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2.5 border-t border-divider pt-[0.875rem]">
        <div>
          <div className="text-[clamp(3rem,5vw,4.5rem)] font-semibold leading-[0.9] tracking-[-0.03em] tabular-nums">{scorePass(setup, hits)}</div>
          <div className="mt-1.5 text-sm text-muted">
            totaal {total} · plaats {place}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Pill size="sm" disabled={locked} onClick={(e) => (e.stopPropagation(), props.onAll(true))}>
            Alles raak
          </Pill>
          <Pill
            size="sm"
            tone={props.nudge ? "outline-ink" : "outline"}
            className={props.nudge ? "bg-yellow" : ""}
            disabled={locked}
            onClick={(e) => (e.stopPropagation(), props.onAll(false))}
          >
            Niets
          </Pill>
        </div>
      </div>
    </div>
  );
}

/** Who shoots which knockdown in every phase of this heat. */
function SwapSchedule({ heat, phaseIndex }: { heat: Heat; phaseIndex: number }) {
  const { state } = useComp();
  const kds = Array.from({ length: state.snapshot.competition.knockdowns }, (_, i) => i + 1);
  return (
    <Panel size="md" className="px-5 py-[1.125rem]">
      <div className="mb-3 text-[0.9375rem] font-semibold">Wisselschema · beurt {heat.index + 1}</div>
      <div className="grid gap-1.5 text-[0.8125rem]" style={{ gridTemplateColumns: `auto repeat(${kds.length}, minmax(0, 1fr))` }}>
        <span />
        {kds.map((k) => (
          <span key={k} className="text-muted">
            KD {k}
          </span>
        ))}
        {heat.phases.map((ph, p) => (
          <Fragment key={p}>
            <span className={`self-center whitespace-nowrap ${p === phaseIndex ? "font-semibold" : "text-muted"}`}>
              Fase {p + 1}
              {p < phaseIndex ? " ✓" : ""}
            </span>
            {kds.map((k) => {
              const s = ph.find((x) => x.knockdown === k);
              return (
                <span
                  key={k}
                  className={`truncate rounded-lg px-2.5 py-2 ${
                    p === phaseIndex ? "bg-ink font-semibold text-white" : p < phaseIndex ? "bg-fill text-muted" : "bg-fill"
                  }`}
                >
                  {s ? entryShortName(state, s.entryId) : "–"}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}
