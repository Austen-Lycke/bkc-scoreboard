import type { FormatTiming } from "@/lib/scoring";

/**
 * The series countdown of a timed (WSA) heat. Only the start is stored; every screen works out where
 * the countdown is from the clock, so the TV and the operator never drift apart.
 */
export interface SeriesTimer {
  heatKey: string;
  startedAt: string;
  /** The series the countdown started at: 1, or a later one after an interruption. */
  fromSeries: number;
}

export type TimerStep =
  /** Started with a 3-2-1: the first series begins at `startedAt`, `left` seconds from now. */
  | { kind: "ready"; left: number }
  | { kind: "series"; series: number; left: number; total: number }
  | { kind: "recover"; next: number; left: number; total: number }
  | { kind: "done" };

/** How long the 3-2-1 before a beurt takes, in seconds. */
export const START_COUNTDOWN_SECONDS = 3;

/** Where the countdown is: the 3-2-1 before it, series 1, the short recovery, series 2, …, done. `left` in whole seconds. */
export function timerStep(timing: FormatTiming, seriesInHeat: number, timer: Pick<SeriesTimer, "startedAt" | "fromSeries">, now: number): TimerStep {
  let t = (now - Date.parse(timer.startedAt)) / 1000;
  if (t < 0) return { kind: "ready", left: Math.ceil(-t) };
  for (let s = timer.fromSeries; s <= seriesInHeat; s++) {
    if (t < timing.seriesSeconds) return { kind: "series", series: s, left: Math.ceil(timing.seriesSeconds - t), total: timing.seriesSeconds };
    t -= timing.seriesSeconds;
    if (s === seriesInHeat) break;
    if (t < timing.recoverSeconds) return { kind: "recover", next: s + 1, left: Math.ceil(timing.recoverSeconds - t), total: timing.recoverSeconds };
    t -= timing.recoverSeconds;
  }
  return { kind: "done" };
}
