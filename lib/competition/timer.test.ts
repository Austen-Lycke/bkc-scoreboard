import { describe, expect, it } from "vitest";
import { timerStep } from "./timer";

const timing = { seriesSeconds: 150, recoverSeconds: 10, warmupSeconds: 300 };
const start = "2026-11-07T10:00:00.000Z";
const at = (seconds: number) => Date.parse(start) + seconds * 1000;

describe("timerStep", () => {
  it("runs series 1, 10 s recovery, series 2, then done", () => {
    const timer = { startedAt: start, fromSeries: 1 };
    expect(timerStep(timing, 2, timer, at(0))).toEqual({ kind: "series", series: 1, left: 150, total: 150 });
    expect(timerStep(timing, 2, timer, at(149.2))).toEqual({ kind: "series", series: 1, left: 1, total: 150 });
    expect(timerStep(timing, 2, timer, at(150))).toEqual({ kind: "recover", next: 2, left: 10, total: 10 });
    expect(timerStep(timing, 2, timer, at(160))).toEqual({ kind: "series", series: 2, left: 150, total: 150 });
    expect(timerStep(timing, 2, timer, at(310))).toEqual({ kind: "done" });
  });

  it("restarts at series 2 without a recovery first", () => {
    expect(timerStep(timing, 2, { startedAt: start, fromSeries: 2 }, at(5))).toEqual({ kind: "series", series: 2, left: 145, total: 150 });
  });

  it("has no recovery in a one-series final step", () => {
    const timer = { startedAt: start, fromSeries: 1 };
    expect(timerStep(timing, 1, timer, at(150))).toEqual({ kind: "done" });
  });
});
