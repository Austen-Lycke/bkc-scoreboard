import { describe, expect, it } from "vitest";
import { passKey } from "@/lib/scoring";
import {
  buildDemoSnapshot,
  buildState,
  competitionProgress,
  competitionSchedule,
  heatKey,
  passOf,
  undoActions,
  undoDrafts,
  type CompetitionEvent,
  type EventPayload,
  type EventType,
  type LastSave,
} from ".";

const snapshot = buildDemoSnapshot();

function log() {
  let t = Date.parse("2026-11-07T10:00:00Z");
  const events: CompetitionEvent[] = [];
  const emit = <T extends EventType>(type: T, payload: EventPayload<T>) => {
    t += 1000;
    events.push({ id: crypto.randomUUID(), competitionId: "demo", deviceId: "test", at: new Date(t).toISOString(), type, payload } as CompetitionEvent);
  };
  return { events, emit, state: () => buildState(snapshot, events) };
}

/** Saves the first phase of the first heat the way the scoring screen does, and returns its LastSave. */
function saveFirstPhase(l: ReturnType<typeof log>, hitsFor: (kd: number) => string[]): LastSave {
  const state = l.state();
  const heat = competitionSchedule(state)[0];
  const passes = heat.phases[0].map((a) => ({
    entryId: a.entryId,
    round: heat.round,
    knockdown: a.knockdown,
    hits: hitsFor(a.knockdown),
    previous: passOf(state, a.entryId, heat.round, a.knockdown)?.hits ?? null,
  }));
  for (const p of passes) l.emit("pass.recorded", { entryId: p.entryId, round: p.round, knockdown: p.knockdown, hits: p.hits });
  return { heatKey: heatKey(heat), phaseIndex: 0, focused: false, passes, at: "2026-11-07T10:05:00.000Z" };
}

const apply = (l: ReturnType<typeof log>, actions: NonNullable<ReturnType<typeof undoActions>>) => {
  for (const a of actions) l.emit(a.type, a.payload as never);
};

describe("undo the last save", () => {
  it("clears passes that were new, so the schedule goes back to that phase", () => {
    const l = log();
    const save = saveFirstPhase(l, () => ["top-left-3", "top-10"]);
    expect(competitionProgress(l.state())).toMatchObject({ heatIndex: 0, phaseIndex: 1 });

    const actions = undoActions(l.state(), save)!;
    expect(actions.map((a) => a.type)).toEqual(["pass.cleared", "pass.cleared"]);
    apply(l, actions);

    const state = l.state();
    expect(state.rejected).toEqual([]);
    expect(competitionProgress(state)).toMatchObject({ heatIndex: 0, phaseIndex: 0 });
    for (const p of save.passes) expect(passOf(state, p.entryId, p.round, p.knockdown)).toBeUndefined();
  });

  it("puts a corrected pass back to what it was", () => {
    const l = log();
    saveFirstPhase(l, () => ["top-left-3"]);
    const correction = saveFirstPhase(l, (kd) => (kd === 1 ? ["top-left-3", "top-6"] : ["top-left-3"]));

    const actions = undoActions(l.state(), correction)!;
    // Only knockdown 1 changed; knockdown 2 was saved with the same hits and stays.
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "pass.recorded", payload: { knockdown: 1, hits: ["top-left-3"] } });
    apply(l, actions);
    const p = correction.passes[0];
    expect(passOf(l.state(), p.entryId, p.round, p.knockdown)?.hits).toEqual(["top-left-3"]);
  });

  it("refuses when a pass changed after the save", () => {
    const l = log();
    const save = saveFirstPhase(l, () => ["top-left-3"]);
    const p = save.passes[0];
    l.emit("pass.recorded", { entryId: p.entryId, round: p.round, knockdown: p.knockdown, hits: ["bottom-4"] });
    expect(undoActions(l.state(), save)).toBeNull();
    l.emit("pass.cleared", { entryId: p.entryId, round: p.round, knockdown: p.knockdown });
    expect(undoActions(l.state(), save)).toBeNull();
  });

  it("gives the saved taps back as drafts", () => {
    const l = log();
    const save = saveFirstPhase(l, (kd) => (kd === 1 ? ["top-6"] : []));
    const drafts = undoDrafts(save);
    const [a, b] = save.passes;
    expect(drafts[passKey(a.entryId, a.round, a.knockdown)]).toEqual(["top-6"]);
    expect(drafts[passKey(b.entryId, b.round, b.knockdown)]).toEqual([]);
  });
});
