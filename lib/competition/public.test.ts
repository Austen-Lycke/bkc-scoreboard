import { describe, expect, it } from "vitest";
import { SPANISH_KNOCKDOWN } from "@/lib/scoring";
import { buildDemoSnapshot, buildState, competitionProgress, competitionSchedule, publicName, publicView, type CompetitionEvent } from ".";

describe("publicName", () => {
  it("shortens juniors and anyone under 18 on the date, never adults", () => {
    const adult = { firstName: "Jens", lastName: "Vermeulen", birthdate: "1988-05-19" };
    const minorIn3de = { firstName: "Mila", lastName: "Peeters", birthdate: "2009-12-01" };
    expect(publicName(adult, { isJuniorRank: false, onDate: "2026-11-07" })).toBe("Jens Vermeulen");
    expect(publicName(adult, { isJuniorRank: true, onDate: "2026-11-07" })).toBe("Jens V.");
    expect(publicName(minorIn3de, { isJuniorRank: false, onDate: "2026-11-07" })).toBe("Mila P.");
    expect(publicName(minorIn3de, { isJuniorRank: false, onDate: "2027-12-01" })).toBe("Mila Peeters");
  });
});

describe("publicView", () => {
  it("never exposes juniors' full names or anyone's birthdate", () => {
    const snapshot = buildDemoSnapshot(new Date("2026-11-07T09:00:00Z"));
    const view = publicView(buildState(snapshot));
    const json = JSON.stringify(view);
    expect(json).toContain("Lotte D.");
    expect(json).not.toContain("De Smet");
    expect(json).not.toContain("birthdate");
    expect(json).not.toContain("2011-04-12");
    expect(json).toContain("Filip Dewulf");
  });

  it("shows the heat on the line, who's next, the latest passes and progress", () => {
    const snapshot = buildDemoSnapshot(new Date("2026-11-07T09:00:00Z"));
    const events: CompetitionEvent[] = [];
    let t = Date.parse("2026-11-07T10:00:00Z");
    let state = buildState(snapshot);
    // Shoot the first phase of the first heat.
    const heat = competitionSchedule(state)[competitionProgress(state).heatIndex!];
    for (const s of heat.phases[0]) {
      events.push({
        id: crypto.randomUUID(),
        competitionId: "demo",
        deviceId: "t",
        at: new Date((t += 1000)).toISOString(),
        type: "pass.recorded",
        payload: { entryId: s.entryId, round: 1, knockdown: s.knockdown, hits: SPANISH_KNOCKDOWN.targets.slice(0, 3).map((x) => x.id) },
      });
    }
    state = buildState(snapshot, events);
    const view = publicView(state);
    expect(view.current).toMatchObject({ round: 1, rankName: "Junior", heatNumber: 1, swapped: true });
    expect(view.current!.shooters.map((s) => s.total)).toEqual([19, 19]);
    expect(view.next[0].rankName).toBe("Junior");
    expect(view.lastPasses).toHaveLength(2);
    expect(view.lastPasses[0].score).toBe(19);
    expect(view.progress).toEqual({ done: 2, total: 17 * 4 });
    expect(view.passLabels).toEqual(["R1 KD1", "R1 KD2", "R2 KD1", "R2 KD2"]);
    const junior = view.ranks.find((r) => r.code === "junior")!;
    expect(junior.rows[0].passes.filter((p) => p !== null)).toHaveLength(1);
  });
});
