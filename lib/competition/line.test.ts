import { describe, expect, it } from "vitest";
import {
  buildDemoSnapshot,
  buildState,
  cardsDay,
  competitionProgress,
  competitionSchedule,
  heatKey,
  lineHeatIndex,
  onTheLine,
  openHeats,
  phaseDone,
  publicView,
  type CompetitionEvent,
  type CompetitionSnapshot,
  type EventPayload,
  type EventType,
} from ".";
import type { Heat } from "@/lib/scoring";

function makeLog(snapshot: CompetitionSnapshot) {
  let t = Date.parse("2026-11-07T10:00:00Z");
  const events: CompetitionEvent[] = [];
  const emit = <T extends EventType>(type: T, payload: EventPayload<T>) => {
    t += 1000;
    events.push({ id: crypto.randomUUID(), competitionId: snapshot.competition.id, deviceId: "test", at: new Date(t).toISOString(), type, payload } as CompetitionEvent);
  };
  return { events, emit, state: () => buildState(snapshot, events) };
}

const wsa = () => buildDemoSnapshot(new Date("2026-11-07T09:00:00Z"), "wsa");
const spanish = () => buildDemoSnapshot(new Date("2026-11-07T09:00:00Z"));

/** Types every card of a heat (round 1: 10 of 2·4·6·8·10, later rounds: 20 of 5 × 10). */
function typeCards(log: ReturnType<typeof makeLog>, heat: Heat) {
  for (const s of heat.phases.flat()) log.emit("pass.recorded", { entryId: s.entryId, round: heat.round, knockdown: s.knockdown, hits: [], score: heat.round === 1 ? 10 : 20 });
}

describe("the line on a cards day (WSA)", () => {
  it("is a cards day for WSA, not for the Spanish knockdown", () => {
    expect(cardsDay(buildState(wsa()))).toBe(true);
    expect(cardsDay(buildState(spanish()))).toBe(false);
  });

  it("follows the scores without a pointer, and runs ahead of them with one", () => {
    const state = buildState(wsa());
    const schedule = competitionSchedule(state);
    const progress = competitionProgress(state, schedule);
    expect(lineHeatIndex(schedule, progress, null)).toBe(0);
    expect(lineHeatIndex(schedule, progress, { heatKey: heatKey(schedule[1]), index: 1 })).toBe(1);
    // Never behind the first beurt with open cards, never past the schedule.
    expect(lineHeatIndex(schedule, progress, { heatKey: "gone", index: 99 })).toBe(schedule.length - 1);
    expect(lineHeatIndex(schedule, progress, { heatKey: "gone" })).toBe(0);
  });

  it("finds the beurt back by index when a withdrawal changed its key", () => {
    const log = makeLog(wsa());
    const before = competitionSchedule(log.state());
    const line = { heatKey: heatKey(before[1]), index: 1 };
    const entry = [...log.state().entries.values()].find((e) => before[1].shooters.includes(e.entryId))!;
    log.emit("entry.updated", { entryId: entry.entryId, withdrawn: true });
    const state = log.state();
    const schedule = competitionSchedule(state);
    expect(heatKey(schedule[1])).not.toBe(line.heatKey);
    expect(lineHeatIndex(schedule, competitionProgress(state, schedule), line)).toBe(1);
  });

  it("lists the beurten with open cards up to the line, and catches up once they're typed", () => {
    const log = makeLog(wsa());
    const schedule = competitionSchedule(log.state());
    const line = { heatKey: heatKey(schedule[1]), index: 1 };
    let state = log.state();
    let progress = competitionProgress(state, schedule);
    expect(openHeats(state, schedule, progress, 1).map((h) => [h.heat.index, h.open])).toEqual([
      [0, schedule[0].shooters.length],
      [0, schedule[1].shooters.length],
    ]);

    typeCards(log, schedule[0]);
    state = log.state();
    progress = competitionProgress(state, schedule);
    expect(lineHeatIndex(schedule, progress, line)).toBe(1);
    expect(openHeats(state, schedule, progress, 1).map((h) => h.heat)).toEqual([schedule[1]]);

    // The cards of the beurt on the line are in too: the line follows the scores again.
    typeCards(log, schedule[1]);
    state = log.state();
    progress = competitionProgress(state, schedule);
    expect(lineHeatIndex(schedule, progress, line)).toBe(2);
  });

  it("puts round 1 as done once the line is on round 2, with cards of round 1 still open", () => {
    const log = makeLog(wsa());
    log.emit("status.set", { status: "round1" });
    const state = log.state();
    const schedule = competitionSchedule(state);
    const { heatIndex } = onTheLine(state, schedule, competitionProgress(state, schedule), { line: { heatKey: heatKey(schedule[2]), index: 2 } });
    expect(heatIndex).toBe(2);
    expect(phaseDone(state, schedule[2].round)).toBe(true);
  });

  it("ignores the pointer on a Spanish day, and the jump (focus) on a cards day", () => {
    const sp = buildState(spanish());
    const spSchedule = competitionSchedule(sp);
    const pointer = { heatKey: heatKey(spSchedule[2]), index: 2 };
    expect(onTheLine(sp, spSchedule, competitionProgress(sp, spSchedule), { line: pointer }).heatIndex).toBe(0);

    const w = buildState(wsa());
    const schedule = competitionSchedule(w);
    const focus = { heatKey: heatKey(schedule[1]), phaseIndex: 0 };
    expect(onTheLine(w, schedule, competitionProgress(w, schedule), { focus }).heatIndex).toBe(0);
  });

  it("shows the website the beurt on the line, with saved scores only", () => {
    const log = makeLog(wsa());
    log.emit("status.set", { status: "round1" });
    const state = log.state();
    const schedule = competitionSchedule(state);
    const typed = schedule[1].phases[0][0];
    const live = {
      drafts: {},
      draftScores: { [`${typed.entryId}:1:${typed.knockdown}`]: 28 },
      lineHeat: heatKey(schedule[1]),
      pauseEndsAt: null,
      at: "2026-11-07T10:30:00.000Z",
    };
    const view = publicView(state, live);
    expect(view.current?.heatNumber).toBe(schedule[1].index + 1);
    expect(view.current?.shooters.length).toBe(schedule[1].shooters.length);
    expect(view.current?.shooters.every((s) => s.pass.score === 0)).toBe(true);
    expect(view.progress.heatIndex).toBe(1);
    expect(view.next.map((n) => n.heatNumber)).toEqual(schedule.slice(2, 5).map((h) => h.index + 1));
  });
});
