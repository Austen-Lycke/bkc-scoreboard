import { describe, expect, it } from "vitest";
import { publicDisplayName, publicNameParts, similarNames, tidyName } from "./names";

describe("publicNameParts", () => {
  it("splits the public name, a junior's last name shortened", () => {
    const p = { firstName: " Lotte ", lastName: "Dewulf" };
    expect(publicNameParts(p, false)).toEqual({ first: "Lotte", last: "Dewulf" });
    expect(publicNameParts(p, true)).toEqual({ first: "Lotte", last: "D." });
    expect(publicDisplayName(p, true)).toBe("Lotte D.");
    expect(publicDisplayName({ firstName: "Mo", lastName: "" }, true)).toBe("Mo");
  });
});

describe("tidyName", () => {
  it("capitalises a name typed in lower or upper case", () => {
    expect(tidyName("  frank   hermans ")).toBe("Frank Hermans");
    expect(tidyName("van den broeck")).toBe("Van den Broeck");
    expect(tidyName("D'HONDT")).toBe("D'Hondt");
    expect(tidyName("anne-marie")).toBe("Anne-Marie");
  });

  it("keeps a name typed with its own capitals", () => {
    expect(tidyName("Van Den Broeck")).toBe("Van Den Broeck");
    expect(tidyName("McLeod")).toBe("McLeod");
  });
});

describe("similarNames", () => {
  const people = [
    { firstName: "Frank", lastName: "Hermans" },
    { firstName: "Jan", lastName: "D'Hondt" },
    { firstName: "Sofie", lastName: "Maes" },
  ];

  it("finds a typo or a missing letter", () => {
    expect(similarNames({ firstName: "frank", lastName: "herman" }, people)).toEqual([people[0]]);
    expect(similarNames({ firstName: "Jan", lastName: "Dhondt" }, people)).toEqual([people[1]]);
  });

  it("ignores the same name and names that are really different", () => {
    expect(similarNames({ firstName: "Frank", lastName: "Hermans" }, people)).toEqual([]);
    expect(similarNames({ firstName: "Tom", lastName: "Willems" }, people)).toEqual([]);
  });
});
