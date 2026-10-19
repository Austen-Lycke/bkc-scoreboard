import { describe, expect, it } from "vitest";
import { rankStandings } from "./ranking";
import { resolveTie } from "./shootoff";
import type { ScoredPass, ShootoffIteration } from "./types";

/** Four passes per shooter with the given scores. */
const passesFor = (entryId: string, scores: number[]): ScoredPass[] =>
  scores.map((score, i) => ({ entryId, round: i < 2 ? 1 : 2, knockdown: (i % 2) + 1, score }));

const SPANISH_CALLS = [
  { targetId: "bottom-left-2", points: 2 },
  { targetId: "top-10", points: 10 },
  { targetId: "top-left-3", points: 3 },
  { targetId: "bottom-4", points: 4 },
  { targetId: "top-6", points: 6 },
  { targetId: "bottom-right-2", points: 2 },
  { targetId: "top-right-3", points: 3 },
];

const iteration = (results: Record<string, boolean[]>): ShootoffIteration => ({
  participants: Object.keys(results),
  calls: SPANISH_CALLS,
  results,
});
const hits = (n: number) => SPANISH_CALLS.map((_, i) => i < n);

describe("rankStandings", () => {
  const entries = ["a", "b", "c", "d"].map((entryId) => ({ entryId }));

  it("ranks by total, highest first", () => {
    const s = rankStandings({
      entries,
      passes: [...passesFor("a", [20, 20, 20, 20]), ...passesFor("b", [30, 30, 30, 30]), ...passesFor("c", [10, 10, 10, 10]), ...passesFor("d", [25, 25, 25, 25])],
      expectedPasses: 4,
    });
    expect(s.complete).toBe(true);
    expect(s.rows.map((r) => [r.entryId, r.total, r.position])).toEqual([
      ["b", 120, 1],
      ["d", 100, 2],
      ["a", 80, 3],
      ["c", 40, 4],
    ]);
    expect(s.pendingTies).toEqual([]);
  });

  it("shows a shared place while the rank is still shooting (no afkamping yet)", () => {
    const s = rankStandings({
      entries,
      passes: [...passesFor("a", [20, 20]), ...passesFor("b", [20, 20]), ...passesFor("c", [5])],
      expectedPasses: 4,
    });
    expect(s.complete).toBe(false);
    expect(s.rows.slice(0, 2).map((r) => [r.position, r.tie])).toEqual([
      [1, "shared"],
      [1, "shared"],
    ]);
    expect(s.rows[2].position).toBe(3);
    expect(s.pendingTies).toEqual([]);
  });

  it("asks for afkamping for every tie once the rank is complete, at any position", () => {
    const s = rankStandings({
      entries,
      passes: [...passesFor("a", [20, 20, 20, 20]), ...passesFor("b", [20, 20, 20, 20]), ...passesFor("c", [5, 5, 5, 5]), ...passesFor("d", [5, 5, 5, 5])],
      expectedPasses: 4,
    });
    expect(s.pendingTies.map((g) => [...g].sort())).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(s.rows.map((r) => r.position)).toEqual([1, 1, 3, 3]);
    expect(s.rows.every((r) => r.tie === "pending")).toBe(true);
  });

  it("settles a tie with afkamping", () => {
    const s = rankStandings({
      entries: entries.slice(0, 3),
      passes: [...passesFor("a", [20, 20, 20, 20]), ...passesFor("b", [20, 20, 20, 20]), ...passesFor("c", [1, 1, 1, 1])],
      expectedPasses: 4,
      shootoffs: [iteration({ a: hits(1), b: hits(2) })],
    });
    expect(s.rows.map((r) => [r.entryId, r.position, r.tie])).toEqual([
      ["b", 1, "resolved"],
      ["a", 2, "resolved"],
      ["c", 3, "none"],
    ]);
    expect(s.pendingTies).toEqual([]);
  });

  it("repeats afkamping while still tied", () => {
    const tiedPasses = [...passesFor("a", [20, 20, 20, 20]), ...passesFor("b", [20, 20, 20, 20])];
    const once = rankStandings({
      entries: entries.slice(0, 2),
      passes: tiedPasses,
      expectedPasses: 4,
      shootoffs: [iteration({ a: hits(3), b: hits(3) })],
    });
    expect(once.pendingTies).toHaveLength(1);

    const twice = rankStandings({
      entries: entries.slice(0, 2),
      passes: tiedPasses,
      expectedPasses: 4,
      shootoffs: [iteration({ a: hits(3), b: hits(3) }), iteration({ a: hits(7), b: hits(0) })],
    });
    expect(twice.rows.map((r) => r.entryId)).toEqual(["a", "b"]);
    expect(twice.pendingTies).toEqual([]);
  });

  it("lists withdrawn shooters last, without a position and outside tie detection", () => {
    const s = rankStandings({
      entries: [{ entryId: "a" }, { entryId: "b", withdrawn: true }],
      passes: [...passesFor("a", [10, 10, 10, 10]), ...passesFor("b", [30, 10])],
      expectedPasses: 4,
    });
    expect(s.complete).toBe(true);
    expect(s.rows.map((r) => [r.entryId, r.position, r.withdrawn])).toEqual([
      ["a", 1, false],
      ["b", null, true],
    ]);
  });
});

describe("resolveTie", () => {
  it("splits a 3-way tie and only re-shoots the shooters still tied", () => {
    const first = iteration({ a: hits(2), b: hits(5), c: hits(2) }); // b 25, a & c 12
    expect(resolveTie(["a", "b", "c"], [first])).toEqual([["b"], ["a", "c"]]);

    const second = iteration({ a: hits(1), c: hits(4) });
    expect(resolveTie(["a", "b", "c"], [first, second])).toEqual([["b"], ["c"], ["a"]]);
  });

  it("ignores an iteration for a different set of shooters", () => {
    expect(resolveTie(["a", "b"], [iteration({ a: hits(5), z: hits(1) })])).toEqual([["a", "b"]]);
  });
});
