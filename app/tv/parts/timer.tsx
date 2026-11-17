import { useEffect, useRef } from "react";
import { heatKey, timerStep, type CompetitionState, type TimerStep } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import type { Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";
import { playSeriesEnd, playSeriesStart } from "@/components/sound";

/** The series countdown on the TV, with a pip when a series starts and a low tone when it ends. */
export function TvSeriesTimer({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat }) {
  const timing = state.format.timing!;
  const timer = live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(250, !!timer);
  const step: TimerStep | null = timer ? timerStep(timing, heat.phases.length, timer, now) : null;
  useStepSounds(step);
  const series = heat.phases.length;

  if (!step || step.kind === "ready") {
    return (
      <span className="whitespace-nowrap text-[2rem] text-white/60">
        {series} × {formatClock(timing.seriesSeconds)}
      </span>
    );
  }
  if (step.kind === "done") return <span className="whitespace-nowrap text-[2.5rem] font-semibold text-white/70">Reeksen gedaan</span>;
  return (
    <span className="flex items-baseline gap-6 whitespace-nowrap">
      <span className={`text-[2.5rem] font-semibold ${step.kind === "recover" ? "text-yellow" : "text-white/70"}`}>
        {step.kind === "recover" ? "Herstel" : series === 1 ? "Reeks" : `Reeks ${step.series}`}
      </span>
      <span className={`text-[6rem] font-semibold leading-[0.8] tracking-[-0.04em] tabular-nums ${step.kind === "series" && step.left <= 10 ? "text-yellow" : ""}`}>
        {formatClock(step.left)}
      </span>
    </span>
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
