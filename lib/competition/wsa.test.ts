import { describe, expect, it } from "vitest";
import {
  buildDemoSnapshot,
  buildState,
  competitionProgress,
  competitionSchedule,
  entriesOfGroup,
  knockoutPlan,
  passColumns,
  passLabel,
  pendingShootoffs,
  standingsFor,
  undoActions,
  type CompetitionEvent,
  type CompetitionSnapshot,
  type CompetitionState,
  type EventPayload,
  type EventType,
} from ".";

/** Event log with a strictly increasing clock. */
function makeLog(snapshot: CompetitionSnapshot) {
  let t = Date.parse("2026-11-07T10:00:00Z");
  const events: CompetitionEvent[] = [];
  const emit = <T extends EventType>(type: T, payload: EventPayload<T>) => {
    t += 1000;
    events.push({ id: crypto.randomUUID(), competitionId: snapshot.competition.id, deviceId: "test", at: new Date(t).toISOString(), type, payload } as CompetitionEvent);
  };
  return { events, emit, state: () => buildState(snapshot, events) };
}

/**
 * Scores the schedule heat by heat until `stop` says so or nothing is left. `score` gives the typed
 * score of a series (it must be possible on that round's variant).
 */
function play(log: ReturnType<typeof makeLog>, score: (entryId: string, round: number) => number, stop: (s: CompetitionState) => boolean = () => false) {
  for (let guard = 0; guard < 200; guard++) {
    const state = log.state();
    if (stop(state)) return state;
    const progress = competitionProgress(state);
    if (progress.heatIndex === null) return state;
    const heat = competitionSchedule(state)[progress.heatIndex];
    for (const s of heat.phases[progress.phaseIndex!]) {
      log.emit("pass.recorded", { entryId: s.entryId, round: heat.round, knockdown: s.knockdown, hits: [], score: score(s.entryId, heat.round) });
    }
  }
  throw new Error("schedule never ended");
}

const wsa = () => buildDemoSnapshot(new Date("2026-11-07T09:00:00Z"), "wsa");
const adultIds = (state: CompetitionState) => entriesOfGroup(state, "volwassenen").map((e) => e.entryId);

/** Distinct totals within each group: round 1 (2·4·6·8·10, max 30) differs per shooter, everything after is equal. */
function distinctScores(state: CompetitionState) {
  const index = new Map(["junior", "volwassenen"].flatMap((g) => entriesOfGroup(state, g).map((e, i) => [e.entryId, i] as const)));
  return (id: string, round: number) => (round === 1 ? 2 + 2 * index.get(id)! : 30);
}

describe("a WSA day", () => {
  it("puts Junior and all adults on the line as two groups, everyone on their own frame", () => {
    const state = buildState(wsa());
    expect(state.rejected).toEqual([]);
    const schedule = competitionSchedule(state);
    expect(schedule.map((h) => `${h.round}:${h.groupCode}:${h.shooters.length}`)).toEqual(["1:junior:3", "1:volwassenen:14", "2:junior:3", "2:volwassenen:14"]);
    expect(schedule[1].phases.map((ph) => ph.map((s) => s.lane))).toEqual([
      Array.from({ length: 14 }, (_, i) => i + 1),
      Array.from({ length: 14 }, (_, i) => i + 1),
    ]);
    expect(passColumns(state).slice(0, 4).map((c) => passLabel(c))).toEqual(["R1 reeks 1", "R1 reeks 2", "R2 reeks 1", "R2 reeks 2"]);
  });

  it("takes typed points that the round's variant can make, and refuses typos", () => {
    const log = makeLog(wsa());
    const [a] = adultIds(log.state());
    log.emit("pass.recorded", { entryId: a, round: 1, knockdown: 1, hits: [], score: 28 }); // 2·4·6·8·10
    log.emit("pass.recorded", { entryId: a, round: 1, knockdown: 2, hits: [], score: 25 }); // impossible
    log.emit("pass.recorded", { entryId: a, round: 2, knockdown: 1, hits: [], score: 40 }); // 5 × 10
    log.emit("pass.recorded", { entryId: a, round: 2, knockdown: 2, hits: [], score: 35 }); // impossible
    log.emit("pass.recorded", { entryId: a, round: 1, knockdown: 3, hits: [], score: 10 }); // no third series
    log.emit("pass.recorded", { entryId: a, round: 1, knockdown: 2, hits: ["plate-1"] }); // no score typed
    const state = log.state();
    expect([...state.passes.values()].map((p) => p.score)).toEqual([28, 40]);
    expect(state.rejected.map((r) => r.reason)).toEqual([
      "25 punten kan niet op WSA variant 1 · groot naar klein",
      "35 punten kan niet op WSA variant 2 · allemaal klein",
      "Ronde of knockdown bestaat niet",
      "Score ontbreekt",
    ]);
  });

  it("sets the order of a group, not of a rank inside it", () => {
    const log = makeLog(wsa());
    const ids = adultIds(log.state()).reverse();
    log.emit("order.set", { rankCode: "volwassenen", entryIds: ids, source: "manual" });
    log.emit("order.set", { rankCode: "klasse3", entryIds: ids, source: "manual" });
    const state = log.state();
    expect(competitionSchedule(state)[1].shooters).toEqual(ids);
    expect(state.rejected.map((r) => r.reason)).toEqual(["Onbekende klasse klasse3"]);
  });

  it("runs semi-final and final: best half on, frames by total, podium of 3", () => {
    const log = makeLog(wsa());
    const state = play(log, distinctScores(log.state()));
    expect(competitionProgress(state).heatIndex).toBeNull();
    const adults = knockoutPlan(state, "volwassenen");
    // 14 adults → 7 in the semi-final (round 3) → 3 in the final, who shoot one podium series (round 4).
    expect(adults.heats.map((h) => `${h.round}:${h.shooters.length}`)).toEqual(["3:7", "4:3"]);
    expect(adults.done).toBe(true);
    const ranking = standingsFor(state, "volwassenen").rows;
    // The leader after qualification stands on KD 1 and wins.
    expect(adults.heats[0].shooters[0]).toBe(ranking[0].entryId);
    expect(ranking.slice(0, 3).map((r) => r.position)).toEqual([1, 2, 3]);
    expect(ranking.map((r) => r.tie).every((t) => t === "none")).toBe(true);
    // Juniors: 3 go through every stage.
    expect(knockoutPlan(state, "junior").heats.map((h) => `${h.round}:${h.shooters.length}`)).toEqual(["3:3", "4:3"]);
    expect(passColumns(state, "volwassenen").map((c) => passLabel(c))).toEqual(["R1 reeks 1", "R1 reeks 2", "R2 reeks 1", "R2 reeks 2", "HF reeks 1", "HF reeks 2", "F1"]);
  });

  it("drops the last 2 after every final series when there's no semi-final", () => {
    const log = makeLog(wsa());
    log.emit("knockout.set", { semifinal: false, final: true });
    const state = play(log, distinctScores(log.state()));
    // 14 → 7 in the final: 7 → 5 → 3, then the podium series.
    expect(knockoutPlan(state, "volwassenen").heats.map((h) => `${h.round}:${h.shooters.length}`)).toEqual(["3:7", "4:5", "5:3"]);
  });

  it("ends after qualification when both are switched off", () => {
    const log = makeLog(wsa());
    log.emit("knockout.set", { semifinal: false, final: false });
    const state = play(log, distinctScores(log.state()));
    expect(competitionSchedule(state)).toHaveLength(4);
    expect(standingsFor(state, "volwassenen").complete).toBe(true);
    expect(passColumns(state)).toHaveLength(4);
  });

  it("ranks a later drop-out below the podium, even on the same total", () => {
    const log = makeLog(wsa());
    log.emit("knockout.set", { semifinal: false, final: true });
    const scores = distinctScores(log.state());
    // Final series all 0: totals don't move, but surviving a step still ranks higher.
    const state = play(log, (id, round) => (round > 2 ? 0 : scores(id, round)));
    const rows = standingsFor(state, "volwassenen").rows;
    expect(rows.slice(0, 7).map((r) => r.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("waits for an afkamping when a tie sits on the cut line", () => {
    const log = makeLog(wsa());
    const scores = distinctScores(log.state());
    const ids = adultIds(log.state());
    // Make 7th and 8th best equal after qualification: the cut to the semi-final (7) runs between them.
    const byScore = [...ids].sort((a, b) => scores(b, 1) - scores(a, 1));
    const [seventh, eighth] = [byScore[6], byScore[7]];
    let state = play(log, (id, round) => (id === eighth && round === 1 ? scores(seventh, 1) : scores(id, round)), (s) =>
      competitionSchedule(s).some((h) => h.round === 3 && h.groupCode === "junior") && competitionProgress(s).heatIndex === null,
    );
    expect(knockoutPlan(state, "volwassenen").heats).toEqual([]);
    const pending = pendingShootoffs(state).find((p) => p.groupCode === "volwassenen")!;
    expect(pending.stage).toBe("cut:2");
    expect([...pending.groups[0]].sort()).toEqual([seventh, eighth].sort());

    log.emit("shootoff.recorded", {
      iterationId: crypto.randomUUID(),
      rankCode: "volwassenen",
      stage: "cut:2",
      participants: pending.groups[0],
      calls: [{ targetId: "plate-1", points: 10 }],
      results: { [eighth]: [true], [seventh]: [false] },
    });
    state = log.state();
    const semi = knockoutPlan(state, "volwassenen").heats[0];
    expect(semi.shooters).toContain(eighth);
    expect(semi.shooters).not.toContain(seventh);
    // The cut's afkamping doesn't settle anything in the final standings.
    expect(standingsFor(state, "volwassenen").rows.find((r) => r.entryId === seventh)!.tie).not.toBe("resolved");
  });

  it("only switches stages before the knockout has a score", () => {
    const log = makeLog(wsa());
    const state = play(log, distinctScores(log.state()), (s) => s.passes.size > 0 && [...s.passes.values()].some((p) => p.round > 2));
    expect(state.format.knockout?.semifinal).toBe(true);
    log.emit("knockout.set", { semifinal: false, final: true });
    expect(log.state().rejected.at(-1)?.reason).toBe("De halve finale of finale is al begonnen");
    expect(log.state().format.knockout?.semifinal).toBe(true);
  });

  it("undoes a save of typed scores", () => {
    const log = makeLog(wsa());
    const [a] = adultIds(log.state());
    log.emit("pass.recorded", { entryId: a, round: 1, knockdown: 1, hits: [], score: 20 });
    log.emit("pass.recorded", { entryId: a, round: 1, knockdown: 1, hits: [], score: 24 });
    const state = log.state();
    const save = { heatKey: "x", phaseIndex: 0, focused: false, at: "", passes: [{ entryId: a, round: 1, knockdown: 1, hits: [], score: 24, previous: [], previousScore: 20 }] };
    expect(undoActions(state, save)).toEqual([{ type: "pass.recorded", payload: { entryId: a, round: 1, knockdown: 1, hits: [], score: 20 } }]);
    expect(undoActions(state, { ...save, passes: [{ ...save.passes[0], previousScore: null }] })).toEqual([
      { type: "pass.cleared", payload: { entryId: a, round: 1, knockdown: 1 } },
    ]);
    expect(undoActions(state, { ...save, passes: [{ ...save.passes[0], score: 22 }] })).toBeNull();
  });
});
