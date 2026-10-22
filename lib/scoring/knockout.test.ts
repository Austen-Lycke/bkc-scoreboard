import { describe, expect, it } from "vitest";
import { advanceCount, cutAt, dropCount, rankByTotal } from "./knockout";

describe("advanceCount", () => {
  it("lets the best half through, rounded down, but never fewer than 3", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 20].map((n) => advanceCount(n))).toEqual([1, 2, 3, 3, 3, 3, 3, 4, 4, 7, 8, 10]);
  });
});

describe("dropCount", () => {
  it("drops 2 per final series until 3 are left for the podium", () => {
    const steps = (n: number) => {
      const left = [n];
      while (left.at(-1)! > 3) left.push(left.at(-1)! - dropCount(left.at(-1)!));
      return left;
    };
    expect(steps(8)).toEqual([8, 6, 4, 3]);
    expect(steps(5)).toEqual([5, 3]);
    expect(steps(3)).toEqual([3]);
    expect(dropCount(3)).toBe(0);
  });
});

describe("rankByTotal and cutAt", () => {
  const totals: Record<string, number> = { a: 90, b: 80, c: 80, d: 70 };
  const total = (id: string) => totals[id];

  it("cuts a clean ranking", () => {
    const ranked = rankByTotal(["d", "b", "c", "a"], total, []);
    expect(ranked).toEqual([["a"], ["b", "c"], ["d"]]);
    expect(cutAt(ranked, 3)).toEqual({ through: ["a", "b", "c"], out: ["d"] });
  });

  it("stops at a tie on the line until an afkamping settles it", () => {
    const ranked = rankByTotal(["a", "b", "c", "d"], total, []);
    expect(cutAt(ranked, 2)).toEqual({ tie: ["b", "c"] });
    const settled = rankByTotal(["a", "b", "c", "d"], total, [
      { participants: ["b", "c"], calls: [{ targetId: "t", points: 10 }], results: { b: [false], c: [true] } },
    ]);
    expect(cutAt(settled, 2)).toEqual({ through: ["a", "c"], out: ["b", "d"] });
  });
});
