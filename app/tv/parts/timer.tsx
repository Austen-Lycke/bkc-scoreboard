import { useEffect, useRef } from "react";
import { heatKey, secondsAfterPause, timerStep, type CompetitionState, type TimerStep } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import type { Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";
import { playSeriesEnd } from "@/components/sound";
import { COND, slantLeft } from "./frame";

/**
 * The series countdown of the WSA board: a yellow box with a slanted left edge, the series (or the
 * recovery) on the left, the clock on the right and a bar along the bottom for the time gone.
 */
export function TvSeriesBox({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat }) {
  const timing = state.format.timing!;
  const timer = live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(250, !!timer && !timer.pausedAt);
  const step: TimerStep | null = timer ? timerStep(timing, heat.phases.length, timer, now) : null;
  const series = heat.phases.length;

  // Not started, or the 3-2-1 is on: series 1, full length.
  let label = series > 1 ? "Reeks 1" : "Reeks";
  let sub = series > 1 ? `van ${series}` : "";
  let clock = formatClock(timing.seriesSeconds);
  let gone = 0;
  let warn = false;
  if (step?.kind === "ready") {
    // Counting down to it: the series with the time it will have.
    label = series > 1 ? `Reeks ${step.series}` : "Reeks";
    const left = secondsAfterPause(timing, series, timer!);
    clock = formatClock(left);
    gone = 1 - left / timing.seriesSeconds;
  } else if (step?.kind === "paused") {
    label = "Pauze";
    sub = series > 1 ? `Reeks ${step.series}` : "";
    clock = formatClock(step.left);
    gone = 1 - step.left / step.total;
  } else if (step?.kind === "series") {
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
 * The sounds of the series of the heat on the line: three low tones when one ends (also early, or when
 * the operator leaves it) or is paused. Every start is the countdown's
 * (StartCountdown). Mounted for as long as the TV is open, so no screen change swallows a sound; silent
 * for what was already going on when the TV opened.
 */
export function SeriesSounds({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat | null }) {
  const timing = state.format.timing;
  const timer = heat && timing && live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  const now = useNow(100, !!timer && !timer.pausedAt);
  const step = timer && timing && heat ? timerStep(timing, heat.phases.length, timer, now) : null;
  const key = !step ? "idle" : step.kind === "series" ? `series:${step.series}` : step.kind;
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = key;
    if (was === null || was === key) return;
    // A pause during a countdown sounds too: nobody should start.
    if (was.startsWith("series") || (key === "paused" && (was === "ready" || was === "recover"))) playSeriesEnd();
  }, [key]);
  return null;
}

/** "Gepauzeerd" over the whole TV while a series is interrupted, with the time it has left. */
export function SeriesPaused({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat | null }) {
  const timing = state.format.timing;
  const timer = heat && timing && live?.seriesTimer?.heatKey === heatKey(heat) ? live.seriesTimer : null;
  if (!heat || !timing || !timer?.pausedAt) return null;
  const step = timerStep(timing, heat.phases.length, timer, 0);
  if (step.kind !== "paused") return null;
  return (
    <div role="status" aria-label="Gepauzeerd" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-12 bg-ink/95">
      <span className="text-[14rem] font-bold leading-[0.9] tracking-[-0.04em] text-yellow">Gepauzeerd</span>
      <span className="text-[5rem] font-semibold leading-none text-white tabular-nums">
        {heat.phases.length > 1 ? `Reeks ${step.series} · ` : ""}nog {formatClock(step.left)}
      </span>
    </div>
  );
}
