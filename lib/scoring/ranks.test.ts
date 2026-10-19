import { describe, expect, it } from "vitest";
import { publicDisplayName } from "./names";
import { ageOn, DEFAULT_RANKS, initialRank, nextRank, suggestSeasonRank } from "./ranks";

describe("ranks", () => {
  it("computes age in whole years", () => {
    expect(ageOn("2008-02-01", "2026-01-01")).toBe(17);
    expect(ageOn("2008-01-01", "2026-01-01")).toBe(18);
    expect(ageOn("2007-12-31", "2026-01-01")).toBe(18);
  });

  it("is Junior when under 18 on January 1st of the season, even if 18 later that year", () => {
    expect(initialRank("2008-02-01", 2026).code).toBe("junior");
    expect(initialRank("2008-01-01", 2026).code).toBe("klasse3");
    expect(initialRank("1975-06-15", 2026).code).toBe("klasse3");
  });

  it("promotes one rank up; Ereklasse and Junior have no next rank", () => {
    expect(nextRank(DEFAULT_RANKS, "klasse3")?.code).toBe("klasse2");
    expect(nextRank(DEFAULT_RANKS, "klasse1")?.code).toBe("ereklasse");
    expect(nextRank(DEFAULT_RANKS, "ereklasse")).toBeNull();
    expect(nextRank(DEFAULT_RANKS, "junior")).toBeNull();
  });
});

describe("suggestSeasonRank", () => {
  it("keeps this season's rank, carries last season's over, and ages juniors out", () => {
    expect(suggestSeasonRank({ birthdate: "1980-01-01", seasonYear: 2027, thisSeasonRank: "klasse1", lastRank: "klasse2" })).toBe("klasse1");
    expect(suggestSeasonRank({ birthdate: "1980-01-01", seasonYear: 2027, lastRank: "ereklasse" })).toBe("ereklasse");
    expect(suggestSeasonRank({ birthdate: "2008-06-30", seasonYear: 2027, lastRank: "junior" })).toBe("klasse3");
    expect(suggestSeasonRank({ birthdate: "2012-06-30", seasonYear: 2027, lastRank: "junior" })).toBe("junior");
    expect(suggestSeasonRank({ birthdate: "2012-06-30", seasonYear: 2027 })).toBe("junior");
    expect(suggestSeasonRank({ birthdate: "1990-06-30", seasonYear: 2027 })).toBe("klasse3");
  });
});

describe("public names", () => {
  it("shortens juniors to first name + initial", () => {
    expect(publicDisplayName({ firstName: "Lotte", lastName: "Van den Berghe" }, true)).toBe("Lotte V.");
    expect(publicDisplayName({ firstName: "Lotte", lastName: "Van den Berghe" }, false)).toBe(
      "Lotte Van den Berghe",
    );
  });
});
