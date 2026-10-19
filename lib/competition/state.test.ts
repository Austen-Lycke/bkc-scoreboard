import { describe, expect, it } from "vitest";
import { SPANISH_KNOCKDOWN } from "@/lib/scoring";
import {
  buildDemoSnapshot,
  buildState,
  competitionEventSchema,
  competitionProgress,
  competitionSchedule,
  effectiveOrder,
  entriesOfRank,
  pendingShootoffs,
  resultsCsv,
  standingsFor,
  type CompetitionEvent,
  type EventPayload,
  type EventType,
} from ".";

const ALL_HITS = SPANISH_KNOCKDOWN.targets.map((t) => t.id);

/** Event factory with a strictly increasing clock. */
function makeEvents() {
  let t = Date.parse("2026-11-07T10:00:00Z");
  const events: CompetitionEvent[] = [];
  const emit = <T extends EventType>(type: T, payload: EventPayload<T>) => {
    t += 1000;
    const e = { id: crypto.randomUUID(), competitionId: "demo", deviceId: "test", at: new Date(t).toISOString(), type, payload } as CompetitionEvent;
    events.push(e);
    return e;
  };
  return { events, emit };
}

/** Shoots every scheduled pass; `hitsFor` decides the result. */
function shootEverything(snapshot = buildDemoSnapshot(), hitsFor: (entryId: string, round: number, kd: number) => string[] = () => ALL_HITS) {
  const { events, emit } = makeEvents();
  let state = buildState(snapshot, events);
  for (let guard = 0; guard < 200; guard++) {
    const progress = competitionProgress(state);
    if (progress.heatIndex === null) break;
    const heat = competitionSchedule(state)[progress.heatIndex];
    for (const s of heat.phases[progress.phaseIndex!]) {
      emit("pass.recorded", { entryId: s.entryId, round: heat.round, knockdown: s.knockdown, hits: hitsFor(s.entryId, heat.round, s.knockdown) });
    }
    state = buildState(snapshot, events);
  }
  return { snapshot, events, emit, state };
}

describe("competition state", () => {
  it("builds the demo: 17 checked in, Junior shoots first, in pairs", () => {
    const state = buildState(buildDemoSnapshot());
    expect(state.entries.size).toBe(17);
    expect(state.rejected).toEqual([]);
    const schedule = competitionSchedule(state);
    // Junior 3, 3de 5, 2de 3, 1ste 3, Ere 3 → 2+3+2+2+2 = 11 heats per round
    expect(schedule).toHaveLength(22);
    expect(schedule[0]).toMatchObject({ round: 1, rankCode: "junior" });
    expect(schedule[11]).toMatchObject({ round: 2, rankCode: "junior" });
    expect(competitionProgress(state)).toMatchObject({ heatIndex: 0, phaseIndex: 0 });
  });

  it("runs a whole competition: 4 passes each, max 120, every rank complete", () => {
    const { state } = shootEverything();
    expect(state.passes.size).toBe(17 * 4);
    expect(competitionProgress(state).heatIndex).toBeNull();
    const ere = standingsFor(state, "ereklasse");
    expect(ere.complete).toBe(true);
    expect(ere.rows.every((r) => r.total === 120)).toBe(true);
    // Everyone tied on 120 → every rank needs afkamping.
    expect(pendingShootoffs(state).map((p) => p.rankCode)).toEqual(["junior", "klasse3", "klasse2", "klasse1", "ereklasse"]);
  });

  it("settles a tie with afkamping and repeats when still tied", () => {
    const snapshot = buildDemoSnapshot();
    const juniorIds = new Set(
      [...buildState(snapshot).entries.values()].filter((e) => e.rankCode === "junior").map((e) => e.entryId),
    );
    const [a, b, c] = [...juniorIds];
    // Juniors a and b tie on 120, c scores less.
    const run = shootEverything(snapshot, (id) => (id === c ? ["top-10"] : ALL_HITS));
    const [group] = pendingShootoffs(run.state).find((p) => p.rankCode === "junior")!.groups;
    expect([...group].sort()).toEqual([a, b].sort());

    const calls = SPANISH_KNOCKDOWN.targets.map((t) => ({ targetId: t.id, points: t.points }));
    const tie = calls.map(() => true);
    run.emit("shootoff.recorded", { iterationId: crypto.randomUUID(), rankCode: "junior", participants: group, calls, results: { [a]: tie, [b]: tie } });
    expect(standingsFor(buildState(snapshot, run.events), "junior").pendingTies).toHaveLength(1);

    run.emit("shootoff.recorded", {
      iterationId: crypto.randomUUID(),
      rankCode: "junior",
      participants: group,
      calls,
      results: { [a]: calls.map((_, i) => i !== 2), [b]: tie }, // a misses the 10
    });
    const standings = standingsFor(buildState(snapshot, run.events), "junior");
    expect(standings.pendingTies).toEqual([]);
    expect(standings.rows.map((r) => r.entryId)).toEqual([b, a, c]);
  });

  it("treats a second recording of a pass as a correction", () => {
    const { events, emit, snapshot } = makeEventsWithDemo();
    const entryId = [...buildState(snapshot).entries.keys()][0];
    emit("pass.recorded", { entryId, round: 1, knockdown: 1, hits: ["top-10"] });
    emit("pass.recorded", { entryId, round: 1, knockdown: 1, hits: ["top-10", "top-6"] });
    expect(buildState(snapshot, events).passes.get(`${entryId}:1:1`)?.score).toBe(16);
  });

  it("rejects impossible events instead of corrupting the state", () => {
    const { events, emit, snapshot } = makeEventsWithDemo();
    const state0 = buildState(snapshot);
    const entry = [...state0.entries.values()][0];
    const shooter = state0.shooters.get(entry.shooterId)!;
    emit("entry.checked_in", {
      entryId: crypto.randomUUID(),
      shooter: { id: shooter.id, firstName: shooter.firstName, lastName: shooter.lastName, birthdate: shooter.birthdate },
      isNewShooter: false,
      rankCode: entry.rankCode,
      feePaid: true,
      feeCents: 500,
    });
    emit("pass.recorded", { entryId: entry.entryId, round: 1, knockdown: 1, hits: ["not-a-target"] });
    emit("pass.recorded", { entryId: entry.entryId, round: 3, knockdown: 1, hits: [] });
    emit("pass.recorded", { entryId: entry.entryId, round: 1, knockdown: 2, hits: [] });
    emit("entry.removed", { entryId: entry.entryId });
    const state = buildState(snapshot, events);
    expect(state.rejected.map((r) => r.reason)).toEqual([
      "Schutter is al ingeschreven",
      expect.stringMatching(/Unknown target/),
      "Ronde of knockdown bestaat niet",
      expect.stringMatching(/Verwijderen kan niet/),
    ]);
    expect(state.entries.has(entry.entryId)).toBe(true);
  });

  it("appends late arrivals to a frozen order and drops withdrawn shooters from the schedule", () => {
    const { events, emit, snapshot } = makeEventsWithDemo();
    const state0 = buildState(snapshot);
    const frozen = effectiveOrder(state0, "klasse3");
    emit("order.set", { rankCode: "klasse3", entryIds: frozen, source: "reverse_ranking" });

    const late = snapshot.shooters.at(-1)!; // the one demo shooter not checked in
    const lateEntry = crypto.randomUUID();
    emit("entry.checked_in", {
      entryId: lateEntry,
      shooter: { id: late.id, firstName: late.firstName, lastName: late.lastName, birthdate: late.birthdate },
      isNewShooter: false,
      rankCode: "klasse3",
      feePaid: true,
      feeCents: 500,
    });
    emit("entry.updated", { entryId: frozen[0], withdrawn: true });

    const state = buildState(snapshot, events);
    expect(effectiveOrder(state, "klasse3")).toEqual([...frozen.slice(1), lateEntry]);
    expect(entriesOfRank(state, "klasse3")).toHaveLength(5);
    const row = standingsFor(state, "klasse3").rows.find((r) => r.entryId === frozen[0])!;
    expect(row).toMatchObject({ withdrawn: true, position: null });
  });

  it("puts shooters without season points first (reverse ranking)", () => {
    const snapshot = buildDemoSnapshot();
    const state = buildState(snapshot);
    const order = effectiveOrder(state, "klasse3");
    const points = order.map((id) => snapshot.seasonPoints[state.entries.get(id)!.shooterId]);
    const firstWithPoints = points.findIndex((p) => p !== undefined);
    expect(points.slice(0, firstWithPoints).every((p) => p === undefined)).toBe(true);
    const ranked = points.slice(firstWithPoints) as number[];
    expect(ranked).toEqual([...ranked].sort((x, y) => x - y));
  });

  it("merges server and local events by id without duplicates", () => {
    const { events, emit, snapshot } = makeEventsWithDemo();
    const entryId = [...buildState(snapshot).entries.keys()][0];
    emit("pass.recorded", { entryId, round: 1, knockdown: 1, hits: ["top-10"] });
    const synced = { ...snapshot, events: [...snapshot.events, ...events] };
    expect(buildState(synced, events).passes.size).toBe(1);
    expect(buildState(synced, events).entries.size).toBe(17);
  });
});

describe("event validation and export", () => {
  it("validates events with the zod schema", () => {
    const [event] = buildDemoSnapshot().events;
    expect(competitionEventSchema.safeParse(event).success).toBe(true);
    expect(competitionEventSchema.safeParse({ ...event, type: "pass.recorded" }).success).toBe(false);
    expect(competitionEventSchema.safeParse({ ...event, payload: { ...event.payload, feeCents: -1 } }).success).toBe(false);
  });

  it("exports results as Excel-friendly CSV", () => {
    const { state } = shootEverything();
    const csv = resultsCsv(state);
    expect(csv.startsWith("﻿Klasse;Plaats;Naam;R1 KD1;R1 KD2;R2 KD1;R2 KD2;Totaal;Opmerking")).toBe(true);
    expect(csv.trim().split("\r\n")).toHaveLength(18);
    expect(csv).toContain("Filip Dewulf;30;30;30;30;120;afkamping nodig");
  });
});

function makeEventsWithDemo() {
  return { ...makeEvents(), snapshot: buildDemoSnapshot() };
}
