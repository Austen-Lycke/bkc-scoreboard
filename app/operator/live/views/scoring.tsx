"use client";

import { Fragment, useMemo, type CSSProperties } from "react";
import {
  competitionProgress,
  competitionSchedule,
  entryName,
  entryShortName,
  entryTotal,
  groupName,
  heatKey,
  passOf,
  roundName,
  setupFor,
  standingsFor,
  type CompetitionState,
} from "@/lib/competition";
import { updateLive } from "@/lib/offline/store";
import { scorePass, type Heat } from "@/lib/scoring";
import { useComp } from "../context";
import { LineScoring } from "./line-scoring";
import { KnockdownPanel, SwapSchedule } from "./knockdown-panel";
import { AllShot, FinishedBanner, NextUp, PhaseDone } from "./scoring-banners";
import { usePlateScoring } from "./use-plate-scoring";
import { Empty, Kbd, Pill } from "@/components/ui";

/** The heat on the line: the next one in the schedule, or the one the operator jumped to. */
export function useLineup() {
  const { state, live } = useComp();
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const rawPhase = focusIndex >= 0 ? live!.focus!.phaseIndex : progress.phaseIndex;
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const phaseIndex = heat && rawPhase !== null ? Math.min(rawPhase, heat.phases.length - 1) : null;
  return { schedule, focusIndex, heatIndex, heat, phaseIndex };
}

/** "Volwassenen · ronde 1 · beurt 2". */
export const heatTitle = (state: CompetitionState, heat: Heat) => `${groupName(state, heat.groupCode)} · ${roundName(state, heat.round)} · beurt ${heat.index + 1}`;

/**
 * Scoring the heat that's shooting. Plates (Spanish): one panel per knockdown to tap. Points (WSA):
 * one table for the whole line, typed from the scorecards.
 */
export function ScoringView(props: { activeKd: number; setActiveKd: (kd: number) => void }) {
  const { state } = useComp();
  const { heat } = useLineup();
  if (heat && setupFor(state, heat.groupCode, heat.round).entry === "points") return <LineScoring />;
  return <PlateScoring {...props} />;
}

/**
 * One panel per knockdown, the shooter assigned to it in this phase, and their plates. Taps are
 * drafts (shown live on the TV); "Opslaan" records the passes.
 */
function PlateScoring({ activeKd, setActiveKd }: { activeKd: number; setActiveKd: (kd: number) => void }) {
  const { id, state } = useComp();
  const lineup = useLineup();
  const { schedule, focusIndex, heatIndex, heat, phaseIndex } = lineup;
  const { finished, waiting, phase, currentKd, knockdowns, setup, hitsOf, toggle, setAll, untouched, confirming, setConfirmingFor, save, savedNote, lastSave, canUndo, undo } =
    usePlateScoring({ activeKd, setActiveKd, lineup });

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
    const rows = standingsFor(state, heat!.groupCode).rows.filter((r) => !r.withdrawn && r.entryId !== entryId);
    const totals = rows.map((r) => {
      const onLine = phase!.find((s) => s.entryId === r.entryId);
      return onLine ? liveTotal(r.entryId, onLine.knockdown) : r.total;
    });
    return 1 + totals.filter((t) => t > total).length;
  };

  const next = heatIndex === null ? [] : schedule.slice(heatIndex + 1, heatIndex + 4);
  const lastPhase = !!heat && phaseIndex !== null && phaseIndex + 1 >= heat.phases.length;
  const saveLabel = finished ? "Op slot" : (savedNote ?? (lastPhase ? "Opslaan & volgende" : "Opslaan & wisselen"));

  return (
    // Landscape from a tablet up: a side column next to the knockdowns. Upright tablet: that column goes
    // under them, so their plates keep their size. Phone: everything stacks and the page scrolls, with
    // undo and save stuck to the bottom of the screen.
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-7 pt-2 sm:px-8 md:landscape:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.875rem]">
        {waiting && heat ? (
          <PhaseDone round={heat.round} />
        ) : heat && phase && phaseIndex !== null && setup ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-1">
              <span className="text-[1.375rem] font-semibold">{heatTitle(state, heat)}</span>
              <span className="flex items-baseline gap-3 text-sm text-muted">
                {focusIndex >= 0 && (
                  <button
                    type="button"
                    data-keep-enter
                    onClick={() => updateLive(id, { focus: null })}
                    className="cursor-pointer font-semibold text-ink underline underline-offset-2"
                  >
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
                    active={currentKd === kd}
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
            <AllShot />
          </>
        )}
      </div>
      {/* Phone: `contents`, so the save block can stick to the bottom over the whole view. */}
      <aside className="flex min-h-0 flex-none flex-col gap-4 max-md:contents md:portrait:flex-row md:portrait:items-end md:landscape:w-[clamp(14.375rem,22vw,18.75rem)] md:landscape:pt-11">
        {/* On a short screen (tablet in landscape) these scroll, so undo and save always stay in view. */}
        <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 p-1 sm:max-md:flex-row sm:max-md:items-start sm:max-md:*:min-w-0 sm:max-md:*:flex-1 md:overflow-y-auto md:overscroll-contain md:portrait:flex-row md:portrait:items-start md:portrait:*:min-w-0 md:portrait:*:flex-1">
          {heat && phaseIndex !== null && heat.phases.length > 1 && state.format.rotate && <SwapSchedule heat={heat} phaseIndex={phaseIndex} />}
          <NextUp next={next} />
        </div>
        <div className="flex flex-none flex-col gap-2.5 max-md:sticky max-md:bottom-0 max-md:z-10 max-md:-mb-4 max-md:bg-background max-md:pb-4 max-md:pt-2 md:portrait:w-[clamp(14.375rem,30vw,18.75rem)]">
          {canUndo && (
            <button
              type="button"
              data-keep-enter
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
            <div role="alert" data-keep-enter className="flex flex-col gap-2.5 rounded-[1.125rem] border-[0.09375rem] border-yellow bg-yellow-light px-[1.125rem] py-3">
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
            disabled={finished || !phase || waiting}
            className="flex cursor-pointer items-center justify-between rounded-[1.125rem] bg-yellow px-[1.375rem] py-5 text-lg font-bold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <span>{saveLabel}</span>
            <Kbd className="touch:hidden">Enter</Kbd>
          </button>
          {/* In the save block: as a row of its own it would squeeze the upright-tablet layout. */}
          <div className="text-center text-xs text-faint touch:hidden">
            1–{setup?.targets.length ?? 7} plaat · 0 niets · W andere kant · Enter opslaan · ⌘/Ctrl Z ongedaan
          </div>
        </div>
      </aside>
    </div>
  );
}
