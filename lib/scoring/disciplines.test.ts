import { describe, expect, it } from "vitest";
import { achievableScores, maxPassScore, scorePass } from "./disciplines";
import { SPANISH_KNOCKDOWN, WSA_V1, WSA_V2 } from "./presets";

describe("knockdown scoring", () => {
  it("Spanish knockdown: all 7 plates = 30 points (top 22 + bottom 8)", () => {
    const all = SPANISH_KNOCKDOWN.targets.map((t) => t.id);
    expect(scorePass(SPANISH_KNOCKDOWN, all)).toBe(30);
    expect(maxPassScore(SPANISH_KNOCKDOWN)).toBe(30);
    const top = SPANISH_KNOCKDOWN.targets.filter((t) => t.row === 1).map((t) => t.id);
    expect(scorePass(SPANISH_KNOCKDOWN, top)).toBe(22);
  });

  it("sums only the plates that were knocked down", () => {
    expect(scorePass(SPANISH_KNOCKDOWN, ["top-10", "bottom-left-2"])).toBe(12);
    expect(scorePass(SPANISH_KNOCKDOWN, [])).toBe(0);
  });

  it("counts a plate once even if listed twice", () => {
    expect(scorePass(SPANISH_KNOCKDOWN, ["top-6", "top-6"])).toBe(6);
  });

  it("rejects targets that are not on the setup", () => {
    expect(() => scorePass(SPANISH_KNOCKDOWN, ["nope"])).toThrow(/Unknown target/);
  });

  it("WSA variant 1: big to small, 2·4·6·8·10, max 30", () => {
    expect(maxPassScore(WSA_V1)).toBe(30);
    expect(scorePass(WSA_V1, ["plate-1", "plate-5"])).toBe(12);
    expect(WSA_V1.entry).toBe("points");
  });

  it("WSA variant 2: five small plates of 10, max 50", () => {
    expect(maxPassScore(WSA_V2)).toBe(50);
    expect(WSA_V2.entry).toBe("points");
  });
});

describe("achievableScores", () => {
  it("lists every score the plates can make, so a typo in a typed score is caught", () => {
    expect([...achievableScores(WSA_V2)].sort((a, b) => a - b)).toEqual([0, 10, 20, 30, 40, 50]);
    const v1 = achievableScores(WSA_V1);
    expect(v1.size).toBe(16);
    expect([0, 2, 14, 28, 30].every((n) => v1.has(n))).toBe(true);
    expect([1, 25, 32].some((n) => v1.has(n))).toBe(false);
    expect(achievableScores(SPANISH_KNOCKDOWN).has(30)).toBe(true);
  });
});
