import { describe, expect, it } from "vitest";
import { maxPassScore, scorePass } from "./disciplines";
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

  it("WSA variants: 5 plates, 1 point each", () => {
    expect(maxPassScore(WSA_V1)).toBe(5);
    expect(maxPassScore(WSA_V2)).toBe(5);
    expect(scorePass(WSA_V1, ["plate-1", "plate-5"])).toBe(2);
  });
});
