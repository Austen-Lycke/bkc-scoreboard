import { describe, expect, it } from "vitest";
import { SPANISH_KNOCKDOWN } from "@/lib/scoring";
import {
  autoStatus,
  buildDemoSnapshot,
  buildState,
  competitionProgress,
  competitionSchedule,
  pendingShootoffs,
  phaseDone,
  standingsFor,
  statusActions,
  type CompetitionEvent,
  type EventPayload,
  type EventType,
} from ".";

function makeEvents() {
  let t = Date.parse("2026-11-07T10:00:00Z");
  const events: CompetitionEvent[] = [];
  const emit = <T extends EventType>(type: T, payload: EventPayload<T>) => {
    t += 1000;
    events.push({ id: crypto.randomUUID(), competitionId: "demo", deviceId: "test", at: new Date(t).toISOString(), type, payload } as CompetitionEvent);
  };
  return { events, emit };
}

describe("phases follow the scoring", () => {
  it("moves Klaar or Opwarming to Ronde 1, and Pauze to Ronde 2, but never back", () => {
    const snapshot = buildDemoSnapshot();
    const { events, emit } = makeEvents();
    expect(autoStatus(buildState(snapshot, events), 1)).toBe("round1");
    emit("status.set", { status: "warmup" });
    expect(autoStatus(buildState(snapshot, events), 1)).toBe("round1");
    emit("status.set", { status: "break" });
    expect(autoStatus(buildState(snapshot, events), 1)).toBeNull();
    expect(autoStatus(buildState(snapshot, events), 2)).toBe("round2");
    emit("status.set", { status: "shootoff" });
    expect(autoStatus(buildState(snapshot, events), 2)).toBeNull();
  });

  it("freezes the shooting order when the day starts", () => {
    const state = buildState(buildDemoSnapshot());
    const actions = statusActions(state, "round1");
    expect(actions.at(-1)).toEqual({ type: "status.set", payload: { status: "round1" } });
    expect(actions.filter((a) => a.type === "order.set").length).toBeGreaterThan(0);
    expect(statusActions(state, "break").map((a) => a.type)).toEqual(["status.set"]);
  });

  it("asks for the break once round 1 is shot and round 2 is next", () => {
    const snapshot = buildDemoSnapshot();
    const { events, emit } = makeEvents();
    emit("status.set", { status: "round1" });
    let state = buildState(snapshot, events);
    for (let guard = 0; guard < 100; guard++) {
      const { heatIndex, phaseIndex } = competitionProgress(state);
      const heat = competitionSchedule(state)[heatIndex!];
      if (heat.round === 2) break;
      expect(phaseDone(state, heat.round)).toBe(false);
      for (const s of heat.phases[phaseIndex!]) emit("pass.recorded", { entryId: s.entryId, round: 1, knockdown: s.knockdown, hits: [] });
      state = buildState(snapshot, events);
    }
    const next = competitionSchedule(state)[competitionProgress(state).heatIndex!];
    expect(next.round).toBe(2);
    expect(phaseDone(state, next.round)).toBe(true);
    emit("status.set", { status: "break" });
    expect(phaseDone(buildState(snapshot, events), next.round)).toBe(false);
  });
});

describe("a tie the jury doesn't afkamp", () => {
  it("keeps a shared place, no longer asks for afkamping, and can be taken back", () => {
    const snapshot = buildDemoSnapshot();
    const { events, emit } = makeEvents();
    let state = buildState(snapshot, events);
    // Everyone hits everything: the whole of every rank ends tied.
    for (let guard = 0; guard < 200; guard++) {
      const { heatIndex, phaseIndex } = competitionProgress(state);
      if (heatIndex === null) break;
      const heat = competitionSchedule(state)[heatIndex];
      for (const s of heat.phases[phaseIndex!]) {
        emit("pass.recorded", { entryId: s.entryId, round: heat.round, knockdown: s.knockdown, hits: SPANISH_KNOCKDOWN.targets.map((t) => t.id) });
      }
      state = buildState(snapshot, events);
    }
    const junior = pendingShootoffs(state).find((p) => p.groupCode === "junior")!;
    emit("shootoff.waived", { rankCode: "junior", participants: junior.groups[0], waived: true });
    state = buildState(snapshot, events);
    expect(state.rejected).toEqual([]);
    expect(pendingShootoffs(state).some((p) => p.groupCode === "junior")).toBe(false);
    const rows = standingsFor(state, "junior").rows;
    expect(rows.every((r) => r.tie === "waived" && r.position === 1)).toBe(true);

    emit("shootoff.waived", { rankCode: "junior", participants: junior.groups[0], waived: false });
    expect(pendingShootoffs(buildState(snapshot, events)).some((p) => p.groupCode === "junior")).toBe(true);
  });
});

describe("a correction with a reason", () => {
  it("keeps the reason with the pass", () => {
    const snapshot = buildDemoSnapshot();
    const { events, emit } = makeEvents();
    const heat = competitionSchedule(buildState(snapshot))[0];
    const { entryId, knockdown } = heat.phases[0][0];
    emit("pass.recorded", { entryId, round: 1, knockdown, hits: ["top-6"] });
    emit("pass.recorded", { entryId, round: 1, knockdown, hits: [], note: "scorekaart nagekeken" });
    const pass = [...buildState(snapshot, events).passes.values()][0];
    expect(pass).toMatchObject({ edited: true, note: "scorekaart nagekeken", score: 0 });
  });
});
