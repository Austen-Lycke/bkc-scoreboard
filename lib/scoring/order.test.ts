import { describe, expect, it } from "vitest";
import { buildSchedule, passKey, reverseRankingOrder, scheduleProgress } from "./order";

describe("reverseRankingOrder", () => {
  it("puts the weakest first and the leader last; newcomers go before everyone", () => {
    const points = new Map([
      ["leader", 110],
      ["mid", 80],
      ["weak", 40],
    ]);
    const order = reverseRankingOrder(["leader", "new1", "mid", "weak", "new2"], points, "seed");
    expect(order.slice(0, 2).sort()).toEqual(["new1", "new2"]);
    expect(order.slice(2)).toEqual(["weak", "mid", "leader"]);
  });

  it("is a reproducible random draw when nobody has a season score (first competition)", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    const first = reverseRankingOrder(ids, new Map(), "comp-1");
    expect(reverseRankingOrder(ids, new Map(), "comp-1")).toEqual(first);
    expect([...first].sort()).toEqual(ids);
    const draws = new Set(["s1", "s2", "s3", "s4", "s5"].map((s) => reverseRankingOrder(ids, new Map(), s).join()));
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe("buildSchedule", () => {
  const schedule = buildSchedule({
    rankOrder: ["junior", "klasse3"],
    ordersByRank: { junior: ["j1", "j2", "j3"], klasse3: ["a", "b"] },
    rounds: 2,
    knockdowns: 2,
  });

  it("runs every round rank by rank, Junior first, in pairs; an odd shooter shoots alone", () => {
    expect(schedule.map((h) => `${h.round}:${h.rankCode}:${h.shooters.join("+")}`)).toEqual([
      "1:junior:j1+j2",
      "1:junior:j3",
      "1:klasse3:a+b",
      "2:junior:j1+j2",
      "2:junior:j3",
      "2:klasse3:a+b",
    ]);
  });

  it("swaps knockdowns between the two phases of a pair", () => {
    expect(schedule[0].phases).toEqual([
      [
        { entryId: "j1", knockdown: 1 },
        { entryId: "j2", knockdown: 2 },
      ],
      [
        { entryId: "j1", knockdown: 2 },
        { entryId: "j2", knockdown: 1 },
      ],
    ]);
    expect(schedule[1].phases).toEqual([[{ entryId: "j3", knockdown: 1 }], [{ entryId: "j3", knockdown: 2 }]]);
  });

  it("gives every shooter 4 passes: 2 rounds × 2 knockdowns", () => {
    const count = new Map<string, number>();
    for (const h of schedule) for (const ph of h.phases) for (const s of ph) count.set(s.entryId, (count.get(s.entryId) ?? 0) + 1);
    expect([...count.values()]).toEqual([4, 4, 4, 4, 4]);
  });

  it("tracks progress: current heat/phase and who is next", () => {
    const done = new Set<string>();
    expect(scheduleProgress(schedule, done)).toMatchObject({ heatIndex: 0, phaseIndex: 0 });

    done.add(passKey("j1", 1, 1)).add(passKey("j2", 1, 2));
    const p = scheduleProgress(schedule, done);
    expect(p).toMatchObject({ heatIndex: 0, phaseIndex: 1 });
    expect(p.upcoming[0].shooters).toEqual(["j3"]);

    for (const h of schedule) for (const ph of h.phases) for (const s of ph) done.add(passKey(s.entryId, h.round, s.knockdown));
    expect(scheduleProgress(schedule, done)).toEqual({ heatIndex: null, phaseIndex: null, upcoming: [] });
  });
});
