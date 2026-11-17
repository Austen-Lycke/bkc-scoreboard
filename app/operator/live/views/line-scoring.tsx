"use client";

import { type CSSProperties } from "react";
import {
  entriesOfGroup,
  entryName,
  entryShortName,
  entryTotal,
  heatKey,
  openHeats,
  passOf,
  phaseDone,
  setupFor,
  timerStep,
  type CompetitionState,
} from "@/lib/competition";
import { updateLive } from "@/lib/offline/store";
import type { Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";
import { Panel, Pill } from "@/components/ui";
import { useComp, useNav } from "../context";
import { useAutoPhase, useStartBeurt } from "../phase";
import { heatTitle, useLineup } from "./scoring";
import { AllShot, FinishedBanner, NextUp, PhaseDone } from "./scoring-banners";

/**
 * Running a WSA line: the beurt on the line, its series timer on the TV, and "Volgende beurt" whenever
 * the next shooters can go to their frames. The cards are typed in Kaarten, so the line never waits
 * for them (except where the next stage depends on the standings: the semi-final, a final series).
 */
export function LineView() {
  const { id, state } = useComp();
  const { goTo } = useNav();
  const { schedule, progress, focusIndex, heatIndex, heat } = useLineup();
  const finished = state.status === "finished";
  const open = openHeats(state, schedule, progress, heatIndex);
  // Beurten that left the line with cards still to type.
  const behind = open.filter((h) => h.heat !== heat);
  // The qualification is shot and the semi-final is next (or round 1 and round 2): first the break or not.
  const waiting = focusIndex < 0 && !!heat && phaseDone(state, heat.round);

  // Nobody left on the line: every card is in (or a tie on a cut line holds up the knockout).
  if (heatIndex === null || !heat) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-[0.875rem] px-4 pb-7 pt-2 sm:px-8">
        {finished && <FinishedBanner />}
        <AllShot />
      </div>
    );
  }

  const setup = setupFor(state, heat.groupCode, heat.round);
  const next = schedule[heatIndex + 1] ?? null;
  const prev = heatIndex > (progress.heatIndex ?? heatIndex) ? schedule[heatIndex - 1] : null;
  const putOnLine = (h: Heat, index: number) => updateLive(id, { line: { heatKey: heatKey(h), index }, seriesTimer: null, lineStart: null });
  const goNext = next && !finished ? () => putOnLine(next, heatIndex + 1) : null;
  const goBack = prev && !finished ? () => putOnLine(prev, heatIndex - 1) : null;
  // No next beurt yet while cards are open: the next stage of a knockout follows from the standings.
  const knockoutWaits = !next && open.length > 0 && !!state.format.knockout;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 pb-7 pt-2 sm:px-8 md:landscape:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-[0.875rem]">
        {!waiting && (
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-1">
            <span className="text-[1.375rem] font-semibold first-letter:uppercase">{heatTitle(state, heat)}</span>
            <span className="flex items-baseline gap-3 text-sm text-muted">
              {goBack && (
                <button type="button" onClick={goBack} className="cursor-pointer font-semibold text-ink underline underline-offset-2">
                  ← Terug naar de vorige beurt
                </button>
              )}
              {setup.name} · {setup.targets.map((t) => t.points).join("·")}
            </span>
          </div>
        )}
        {finished && <FinishedBanner />}
        {behind.length > 0 && <OpenCards behind={behind.map((h) => ({ heat: h.heat, open: h.open }))} onOpen={() => goTo("cards")} />}
        {waiting ? (
          <>
            <PhaseDone round={heat.round} />
            {goBack && (
              <div>
                <Pill size="sm" tone="ghost" onClick={goBack}>
                  ← Terug naar de vorige beurt
                </Pill>
              </div>
            )}
          </>
        ) : (
          <>
            <LineControls heat={heat} onNext={goNext} />
            {!next && (
              <div className="rounded-[1.125rem] border-[0.09375rem] border-border bg-surface px-[1.125rem] py-3 text-[0.9375rem]">
                {knockoutWaits ? (
                  <>
                    <span className="font-semibold">Typ eerst alle open kaarten in.</span>{" "}
                    <span className="text-muted">Wie daarna schiet, volgt uit de stand.</span>
                  </>
                ) : (
                  <span className="font-semibold">Dit is de laatste beurt.</span>
                )}
              </div>
            )}
            <LineRoster state={state} heat={heat} />
          </>
        )}
      </div>
      <aside className="flex min-h-0 flex-none flex-col gap-4 md:portrait:flex-row md:landscape:w-[clamp(14.375rem,22vw,18.75rem)] md:landscape:pt-11">
        <div className="-m-1 flex min-h-0 flex-1 flex-col gap-4 p-1 md:overflow-y-auto md:overscroll-contain md:portrait:flex-row md:portrait:items-start md:portrait:*:min-w-0 md:portrait:*:flex-1">
          <NextUp next={schedule.slice(heatIndex + 1, heatIndex + 4)} />
        </div>
      </aside>
    </div>
  );
}

/** "Nog kaarten in te typen": the beurten that left the line with open cards, and the way to Kaarten. */
function OpenCards({ behind, onOpen }: { behind: { heat: Heat; open: number }[]; onOpen: () => void }) {
  const { state } = useComp();
  const total = behind.reduce((n, h) => n + h.open, 0);
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[1.125rem] border-[0.09375rem] border-yellow bg-yellow-light px-[1.125rem] py-3">
      <span className="min-w-0 flex-1 text-[0.9375rem]">
        <span className="font-semibold">
          {total} {total === 1 ? "kaart" : "kaarten"} nog in te typen
        </span>
        <span className="text-muted"> · {behind.map((h) => `beurt ${h.heat.index + 1}${h.heat.round !== behind[0].heat.round || behind.some((b) => b.heat.groupCode !== h.heat.groupCode) ? ` (${heatTitle(state, h.heat)})` : ""}`).join(", ")}</span>
      </span>
      <Pill tone="ink" size="sm" onClick={onOpen}>
        Naar Kaarten
      </Pill>
    </div>
  );
}

/** Who's on the line, frame by frame: their series as far as the cards are in, total and place. */
function LineRoster({ state, heat }: { state: CompetitionState; heat: Heat }) {
  const series = heat.phases.length;
  const groupTotals = entriesOfGroup(state, heat.groupCode).map((e) => entryTotal(state, e.entryId));
  const placeOf = (entryId: string) => 1 + groupTotals.filter((t) => t > entryTotal(state, entryId)).length;
  const grid = "grid items-center gap-x-1.5 sm:gap-x-2 grid-cols-[1.5rem_minmax(0,1fr)_repeat(var(--series),3.5rem)_2.5rem] sm:grid-cols-[2.75rem_minmax(0,1fr)_repeat(var(--series),4.25rem)_3.25rem]";
  return (
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
        <div key={spot.entryId} className={`${grid} min-h-[3.25rem] border-b border-divider px-1 py-1 last:border-b-0`} style={{ "--series": series } as CSSProperties}>
          <span className="text-sm font-semibold tabular-nums text-faint">{spot.lane}</span>
          <span className="min-w-0">
            <span className="block truncate text-[0.9375rem] font-semibold max-sm:hidden">{entryName(state, spot.entryId)}</span>
            <span className="block truncate text-[0.9375rem] font-semibold sm:hidden">{entryShortName(state, spot.entryId)}</span>
            <span className="block text-xs text-muted">plaats {placeOf(spot.entryId)}</span>
          </span>
          {heat.phases.map((phase, p) => {
            const score = passOf(state, phase[row].entryId, heat.round, phase[row].knockdown)?.score;
            return (
              <span key={p} className={`text-center text-xl font-semibold tabular-nums ${score === undefined ? "text-plate" : ""}`}>
                {score ?? "–"}
              </span>
            );
          })}
          <span className="text-right text-lg font-semibold tabular-nums">{entryTotal(state, spot.entryId)}</span>
        </div>
      ))}
    </Panel>
  );
}

/**
 * The series countdown of the beurt on the line, on the TV (series, a short recovery, the next
 * series), and "Volgende beurt". Starting the timer moves the phase to the round (out of the warmup or
 * the break, which stops that countdown), as the TV only shows the line and its countdown while a
 * round is on. Once the series are done, "Volgende beurt" is the main button.
 */
function LineControls({ heat, onNext }: { heat: Heat; onNext: (() => void) | null }) {
  const { id, state, live } = useComp();
  const advance = useAutoPhase();
  const timing = state.format.timing;
  const timer = live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(250, !!timer);
  const step = timer && timing ? timerStep(timing, heat.phases.length, timer, now) : null;
  const series = heat.phases.length;
  const from = Math.max(1, heat.phases.findIndex((phase) => phase.some((s) => !passOf(state, s.entryId, heat.round, s.knockdown))) + 1);
  const startBeurt = useStartBeurt();
  // The first series of a beurt starts with a 3-2-1 on the TV; a restart after an interruption right away.
  const start = async (fromSeries: number) => {
    if (fromSeries === 1) return startBeurt(heat, { timed: true });
    await advance(heat.round);
    await updateLive(id, { seriesTimer: { heatKey: heatKey(heat), startedAt: new Date().toISOString(), fromSeries } });
  };
  const stop = () => updateLive(id, { seriesTimer: null, lineStart: null });
  const running = !!step && step.kind !== "done";
  const done = step?.kind === "done";
  const nextButton = onNext && (
    <Pill tone={done || !timing ? "yellow" : running ? "surface" : "outline"} size="sm" onClick={onNext}>
      Volgende beurt →
    </Pill>
  );

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[1.25rem] border-[0.09375rem] px-4 py-3 ${running ? "border-ink bg-ink text-white" : "border-border bg-surface"}`}
    >
      {/* The buttons wrap under the text on a phone, instead of squeezing it into a column. */}
      <span className="min-w-0 flex-1 basis-[14rem] text-sm font-semibold">
        {!timing ? (
          <span className="text-muted">Volgende beurt zet de volgende schutters op de TV</span>
        ) : !step ? (
          <span className="text-muted">
            Timer op TV · {series} × {formatClock(timing.seriesSeconds)}
            {series > 1 ? `, ${timing.recoverSeconds} s herstel` : ""}
          </span>
        ) : step.kind === "done" ? (
          "Reeksen gedaan · de kaarten typ je in Kaarten"
        ) : step.kind === "ready" ? (
          <span className="flex items-baseline gap-3">
            <span className="text-yellow">Aftellen op TV</span>
            <span className="text-[1.75rem] leading-none tabular-nums">{step.left}</span>
          </span>
        ) : (
          <span className="flex items-baseline gap-3">
            <span className={step.kind === "recover" ? "text-yellow" : ""}>{step.kind === "series" ? (series === 1 ? "Reeks" : `Reeks ${step.series}`) : "Herstel"}</span>
            <span className="text-[1.75rem] leading-none tabular-nums">{formatClock(step.left)}</span>
          </span>
        )}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {timing &&
          (running ? (
            <Pill tone="surface" size="sm" onClick={stop}>
              Stop
            </Pill>
          ) : (
            // One button: it starts at the first series whose cards aren't all in yet.
            <Pill tone={done ? "ghost" : "yellow"} size="sm" onClick={() => start(done ? 1 : from)} disabled={state.status === "finished"}>
              {done ? "Opnieuw" : series === 1 ? "Start reeks" : `Start reeks ${from}`}
            </Pill>
          ))}
        {nextButton}
      </div>
    </div>
  );
}
