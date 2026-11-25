import type { FormatTiming } from "@/lib/scoring";

/**
 * The series countdown of a timed (WSA) heat. Only moments are stored; every screen works out where
 * the countdown is from the clock, so the TV and the operator never drift apart.
 */
export interface SeriesTimer {
  heatKey: string;
  /** When `fromSeries` starts; in the future while the TV counts down to it. */
  startedAt: string;
  /** The series the countdown starts at: 1, or a later one. Past the last one: every series is done. */
  fromSeries: number;
  /** How many seconds the TV counts down to `startedAt`: 3, or the recovery after a series that ended early. */
  lead?: number;
  /** Paused at this moment (ISO): the clock stands still. */
  pausedAt?: string | null;
  /** Resumed: the clock stands still until this moment, the end of a 3-2-1. */
  resumeAt?: string | null;
}

export type TimerStep =
  /** Counting down to `series`, `left` seconds to go. `recover`: the recovery after a series that ended early. */
  | { kind: "ready"; series: number; left: number; recover: boolean }
  | { kind: "series"; series: number; left: number; total: number }
  | { kind: "recover"; next: number; left: number; total: number }
  /** Interrupted: `left` of the `total` seconds of `series` are still to shoot. */
  | { kind: "paused"; series: number; left: number; total: number }
  | { kind: "done" };

/** How long the 3-2-1 before a beurt (or a resumed series) takes, in seconds. */
export const START_COUNTDOWN_SECONDS = 3;

const iso = (ms: number) => new Date(ms).toISOString();
const ms = (at: string | null | undefined) => (at ? Date.parse(at) : -Infinity);

/** Where the countdown is at `now`, as if it was never paused. */
function runningStep(timing: FormatTiming, seriesInHeat: number, timer: Omit<SeriesTimer, "heatKey">, now: number): Exclude<TimerStep, { kind: "paused" }> {
  if (timer.fromSeries > seriesInHeat) return { kind: "done" };
  let t = (now - Date.parse(timer.startedAt)) / 1000;
  if (t < 0) {
    const lead = timer.lead ?? START_COUNTDOWN_SECONDS;
    // Capped: a screen's clock can lag a moment behind the start.
    return { kind: "ready", series: timer.fromSeries, left: Math.min(lead, Math.ceil(-t)), recover: lead > START_COUNTDOWN_SECONDS };
  }
  for (let s = timer.fromSeries; s <= seriesInHeat; s++) {
    if (t < timing.seriesSeconds) return { kind: "series", series: s, left: Math.ceil(timing.seriesSeconds - t), total: timing.seriesSeconds };
    t -= timing.seriesSeconds;
    if (s === seriesInHeat) break;
    if (t < timing.recoverSeconds) return { kind: "recover", next: s + 1, left: Math.ceil(timing.recoverSeconds - t), total: timing.recoverSeconds };
    t -= timing.recoverSeconds;
  }
  return { kind: "done" };
}

/** Where the countdown is: the 3-2-1 before it, series 1, the short recovery, series 2, …, done. `left` in whole seconds. */
export function timerStep(timing: FormatTiming, seriesInHeat: number, timer: Omit<SeriesTimer, "heatKey">, now: number): TimerStep {
  const resumeAt = ms(timer.resumeAt);
  if (timer.pausedAt) {
    const step = runningStep(timing, seriesInHeat, timer, Math.max(ms(timer.pausedAt), resumeAt));
    if (step.kind === "done") return step;
    if (step.kind === "series") return { ...step, kind: "paused" };
    const total = timing.seriesSeconds;
    return { kind: "paused", series: step.kind === "ready" ? step.series : step.next, left: total, total };
  }
  if (now < resumeAt) {
    const step = runningStep(timing, seriesInHeat, timer, resumeAt);
    if (step.kind === "series") return { kind: "ready", series: step.series, left: Math.min(START_COUNTDOWN_SECONDS, Math.ceil((resumeAt - now) / 1000)), recover: false };
    return step;
  }
  return runningStep(timing, seriesInHeat, timer, now);
}

/** Seconds on the clock of the series that is about to go on: all of it, or what a pause left over. */
export function secondsAfterPause(timing: FormatTiming, seriesInHeat: number, timer: Omit<SeriesTimer, "heatKey">): number {
  if (!timer.resumeAt) return timing.seriesSeconds;
  const step = runningStep(timing, seriesInHeat, timer, ms(timer.resumeAt));
  return step.kind === "series" ? step.left : timing.seriesSeconds;
}

/** Starts a series after a countdown of `lead` seconds. */
export const startSeries = (heatKey: string, series: number, now: number, lead = START_COUNTDOWN_SECONDS): SeriesTimer => ({
  heatKey,
  startedAt: iso(now + lead * 1000),
  fromSeries: series,
  lead,
});

/** Everyone is ready before the time is up: on to the recovery and the next series, or done after the last one. */
export function endSeries(timing: FormatTiming, seriesInHeat: number, timer: SeriesTimer, now: number): SeriesTimer {
  const step = timerStep(timing, seriesInHeat, timer, now);
  if (step.kind !== "series" && step.kind !== "paused") return timer;
  return startSeries(timer.heatKey, step.series + 1, now, timing.recoverSeconds);
}

export const pauseTimer = (timer: SeriesTimer, now: number): SeriesTimer => ({ ...timer, pausedAt: iso(now) });

/** Goes on after a 3-2-1: the interrupted series with the time it had left, or the series that was about to start. */
export function resumeTimer(timing: FormatTiming, seriesInHeat: number, timer: SeriesTimer, now: number): SeriesTimer {
  if (!timer.pausedAt) return timer;
  const stoodStillAt = Math.max(ms(timer.pausedAt), ms(timer.resumeAt));
  const step = runningStep(timing, seriesInHeat, timer, stoodStillAt);
  if (step.kind === "done") return { ...timer, pausedAt: null };
  if (step.kind !== "series") return startSeries(timer.heatKey, step.kind === "ready" ? step.series : step.next, now);
  const resumeAt = now + START_COUNTDOWN_SECONDS * 1000;
  return { ...timer, startedAt: iso(Date.parse(timer.startedAt) + resumeAt - stoodStillAt), pausedAt: null, resumeAt: iso(resumeAt) };
}

/** A "Start!" the TV counts down to: the moment (ms), from how many seconds, and which series it starts. */
export interface StartMoment {
  at: number;
  lead: number;
  series: number;
}

/** Every "Start!" of a timer, in order: the first series, a resume after a pause, and each series after a recovery. */
export function startMoments(timing: FormatTiming, seriesInHeat: number, timer: Omit<SeriesTimer, "heatKey">): StartMoment[] {
  if (timer.pausedAt) return [];
  const first = Date.parse(timer.startedAt);
  const resumeAt = ms(timer.resumeAt);
  const moments: StartMoment[] = [];
  for (let s = timer.fromSeries; s <= seriesInHeat; s++) {
    const at = first + (s - timer.fromSeries) * (timing.seriesSeconds + timing.recoverSeconds) * 1000;
    const lead = s === timer.fromSeries ? (timer.lead ?? START_COUNTDOWN_SECONDS) : timing.recoverSeconds;
    if (at > resumeAt) moments.push({ at, lead, series: s });
  }
  if (timer.resumeAt) {
    const step = runningStep(timing, seriesInHeat, timer, resumeAt);
    if (step.kind === "series") moments.unshift({ at: resumeAt, lead: START_COUNTDOWN_SECONDS, series: step.series });
  }
  return moments;
}
