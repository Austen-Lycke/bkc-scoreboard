import { describe, expect, it } from "vitest";
import { endSeries, pauseTimer, resumeTimer, secondsAfterPause, startMoments, startSeries, timerStep } from "./timer";

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

  it("waits for a start in the future (the 3-2-1), never above its length", () => {
    const timer = { startedAt: start, fromSeries: 1 };
    expect(timerStep(timing, 2, timer, at(-3))).toEqual({ kind: "ready", series: 1, left: 3, recover: false });
    expect(timerStep(timing, 2, timer, at(-0.4))).toEqual({ kind: "ready", series: 1, left: 1, recover: false });
    expect(timerStep(timing, 2, timer, at(-60))).toEqual({ kind: "ready", series: 1, left: 3, recover: false });
    expect(timerStep(timing, 2, timer, at(0))).toEqual({ kind: "series", series: 1, left: 150, total: 150 });
  });
});

describe("ending a series early", () => {
  const timer = startSeries("h", 1, at(-3));

  it("goes to a 10 s recovery, then series 2 for its full time", () => {
    const ended = endSeries(timing, 2, timer, at(40));
    expect(timerStep(timing, 2, ended, at(40))).toEqual({ kind: "ready", series: 2, left: 10, recover: true });
    expect(timerStep(timing, 2, ended, at(47))).toEqual({ kind: "ready", series: 2, left: 3, recover: true });
    expect(timerStep(timing, 2, ended, at(50))).toEqual({ kind: "series", series: 2, left: 150, total: 150 });
    expect(startMoments(timing, 2, ended)).toEqual([{ at: at(50), lead: 10, series: 2 }]);
  });

  it("is done at once after the last series", () => {
    expect(timerStep(timing, 1, endSeries(timing, 1, timer, at(40)), at(40))).toEqual({ kind: "done" });
    expect(startMoments(timing, 1, endSeries(timing, 1, timer, at(40)))).toEqual([]);
  });

  it("does nothing during the 3-2-1 or the recovery", () => {
    expect(endSeries(timing, 2, timer, at(-1))).toBe(timer);
    expect(endSeries(timing, 2, timer, at(155))).toBe(timer);
  });
});

describe("pause and resume", () => {
  const timer = startSeries("h", 1, at(-3));

  it("freezes the clock, then goes on with the time left after a 3-2-1", () => {
    const paused = pauseTimer(timer, at(40));
    expect(timerStep(timing, 2, paused, at(40))).toEqual({ kind: "paused", series: 1, left: 110, total: 150 });
    expect(timerStep(timing, 2, paused, at(400))).toEqual({ kind: "paused", series: 1, left: 110, total: 150 });
    expect(startMoments(timing, 2, paused)).toEqual([]);

    const resumed = resumeTimer(timing, 2, paused, at(400));
    expect(timerStep(timing, 2, resumed, at(400))).toEqual({ kind: "ready", series: 1, left: 3, recover: false });
    expect(secondsAfterPause(timing, 2, resumed)).toBe(110);
    expect(timerStep(timing, 2, resumed, at(403))).toEqual({ kind: "series", series: 1, left: 110, total: 150 });
    expect(timerStep(timing, 2, resumed, at(513))).toEqual({ kind: "recover", next: 2, left: 10, total: 10 });
    expect(timerStep(timing, 2, resumed, at(523))).toEqual({ kind: "series", series: 2, left: 150, total: 150 });
    expect(startMoments(timing, 2, resumed)).toEqual([
      { at: at(403), lead: 3, series: 1 },
      { at: at(523), lead: 10, series: 2 },
    ]);
  });

  it("can be paused again, also during the 3-2-1 of a resume", () => {
    const resumed = resumeTimer(timing, 2, pauseTimer(timer, at(40)), at(100));
    const again = pauseTimer(resumed, at(101));
    expect(timerStep(timing, 2, again, at(120))).toEqual({ kind: "paused", series: 1, left: 110, total: 150 });
    const on = resumeTimer(timing, 2, again, at(200));
    expect(timerStep(timing, 2, on, at(203))).toEqual({ kind: "series", series: 1, left: 110, total: 150 });
  });

  it("starts the next series in full when paused in a 3-2-1 or a recovery", () => {
    const early = resumeTimer(timing, 2, pauseTimer(timer, at(-1)), at(20));
    expect(timerStep(timing, 2, early, at(23))).toEqual({ kind: "series", series: 1, left: 150, total: 150 });
    const inRecovery = pauseTimer(timer, at(155));
    expect(timerStep(timing, 2, inRecovery, at(170))).toEqual({ kind: "paused", series: 2, left: 150, total: 150 });
    const late = resumeTimer(timing, 2, inRecovery, at(200));
    expect(timerStep(timing, 2, late, at(203))).toEqual({ kind: "series", series: 2, left: 150, total: 150 });
  });
});
