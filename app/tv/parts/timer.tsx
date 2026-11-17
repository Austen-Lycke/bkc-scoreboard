import { useEffect, useRef } from "react";
import { heatKey, timerStep, type CompetitionState, type TimerStep } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import type { Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";
import { playSeriesEnd, playSeriesStart } from "@/components/sound";
import { COND, slantLeft } from "./frame";

/**
 * The series countdown of the WSA board: a yellow box with a slanted left edge, the series (or the
 * recovery) on the left, the clock on the right and a bar along the bottom for the time gone. A pip
 * when a series starts, a low tone when it ends.
 */
export function TvSeriesBox({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat }) {
  const timing = state.format.timing!;
  const timer = live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(250, !!timer);
  const step: TimerStep | null = timer ? timerStep(timing, heat.phases.length, timer, now) : null;
  useStepSounds(step);
  const series = heat.phases.length;

  // Not started, or the 3-2-1 is on: series 1, full length.
  let label = series > 1 ? "Reeks 1" : "Reeks";
  let sub = series > 1 ? `van ${series}` : "";
  let clock = formatClock(timing.seriesSeconds);
  let gone = 0;
  let warn = false;
  if (step?.kind === "series") {
    label = series > 1 ? `Reeks ${step.series}` : "Reeks";
    clock = formatClock(step.left);
    gone = 1 - step.left / step.total;
    warn = step.left <= 10;
  } else if (step?.kind === "recover") {
    label = "Herstel";
    sub = "";
    clock = formatClock(step.left);
    gone = 1 - step.left / step.total;
  } else if (step?.kind === "done") {
    label = series > 1 ? "Reeksen" : "Reeks";
    sub = "gedaan";
    clock = "Klaar";
    gone = 1;
  }

  return (
    <div role="timer" aria-label="Reekstimer" className="relative flex w-[36rem] flex-none items-center justify-end gap-8 bg-yellow pl-20 pr-10 text-ink" style={slantLeft("3rem")}>
      <span className={`${COND} flex flex-col text-[2.5rem] font-bold uppercase leading-[0.95]`}>
        <span>{label}</span>
        {sub && <span>{sub}</span>}
      </span>
      <span className={`${COND} text-[7.5rem] font-bold leading-none tabular-nums ${warn ? "text-alert" : ""}`}>{clock}</span>
      <span className="absolute bottom-0 left-0 h-[0.5rem] bg-ink" style={{ width: `${gone * 100}%` }} />
    </div>
  );
}

/**
 * A pip as a series starts, a low tone as it ends. Not when the TV opens halfway, and not for the
 * first series after the 3-2-1: the start signal of the beurt already plays then.
 */
function useStepSounds(step: TimerStep | null) {
  const key = !step ? "idle" : step.kind === "series" ? `series:${step.series}` : step.kind;
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = key;
    if (was === null || was === key || was === "ready") return;
    if (key.startsWith("series")) playSeriesStart();
    else if (was.startsWith("series") && (key === "recover" || key === "done")) playSeriesEnd();
  }, [key]);
}
