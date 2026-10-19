import { describe, expect, it } from "vitest";
import { DEFAULT_RANKS } from "./ranks";
import { proposeRanks } from "./promotion";
import { seasonStandings, type CompetitionResult } from "./season";

const results = (shooterId: string, totals: number[]): CompetitionResult[] =>
  totals.map((total, i) => ({ competitionId: `c${i}`, shooterId, total }));

describe("seasonStandings", () => {
  const ranks = new Map([
    ["x", "klasse3"],
    ["y", "klasse3"],
    ["z", "klasse3"],
    ["e", "ereklasse"],
  ]);
  const data = [...results("x", [100, 50, 60]), ...results("y", [90, 90]), ...results("z", [70]), ...results("e", [110])];

  it("sum (current club rule): total of all competitions, per rank", () => {
    const s = seasonStandings(data, ranks, { type: "sum" });
    expect(s.get("klasse3")!.map((r) => [r.shooterId, r.points, r.position])).toEqual([
      ["x", 210, 1],
      ["y", 180, 2],
      ["z", 70, 3],
    ]);
    expect(s.get("ereklasse")!.map((r) => r.shooterId)).toEqual(["e"]);
  });

  it("best N: only the best results count", () => {
    const s = seasonStandings(data, ranks, { type: "best_n", n: 1 });
    expect(s.get("klasse3")!.map((r) => [r.shooterId, r.points])).toEqual([
      ["x", 100],
      ["y", 90],
      ["z", 70],
    ]);
  });

  it("average with a minimum number of participations", () => {
    const s = seasonStandings(data, ranks, { type: "average", minParticipations: 2 });
    expect(s.get("klasse3")!.map((r) => [r.shooterId, r.points, r.position, r.eligible])).toEqual([
      ["y", 90, 1, true],
      ["x", 70, 2, true],
      ["z", 70, null, false],
    ]);
  });

  it("shares positions on equal points", () => {
    const s = seasonStandings([...results("x", [50]), ...results("y", [50]), ...results("z", [10])], ranks, { type: "sum" });
    expect(s.get("klasse3")!.map((r) => r.position)).toEqual([1, 1, 3]);
  });
});

describe("proposeRanks", () => {
  /** 12 shooters in 3de klasse with distinct season totals s1 (best) … s12. */
  const twelve = Array.from({ length: 12 }, (_, i) => `s${i + 1}`);
  const shooters = [
    ...twelve.map((shooterId) => ({ shooterId, rankCode: "klasse3", birthdate: "1980-01-01" })),
    { shooterId: "champ", rankCode: "ereklasse", birthdate: "1970-01-01" },
    { shooterId: "kid", rankCode: "junior", birthdate: "2012-05-05" },
    { shooterId: "teen", rankCode: "junior", birthdate: "2008-06-30" },
    { shooterId: "absent", rankCode: "klasse2", birthdate: "1990-01-01" },
  ];
  const rankOf = new Map(shooters.map((s) => [s.shooterId, s.rankCode]));

  it("promotes the top 10 of each adult rank; Ereklasse stays; juniors move up when 18", () => {
    const data = [
      ...twelve.flatMap((id, i) => results(id, [200 - i * 10])),
      ...results("champ", [300]),
      ...results("kid", [50]),
      ...results("teen", [60]),
    ];
    const proposal = proposeRanks({
      ranks: DEFAULT_RANKS,
      shooters,
      standings: seasonStandings(data, rankOf, { type: "sum" }),
      nextSeasonYear: 2027,
    });
    const by = new Map(proposal.map((p) => [p.shooterId, p]));
    expect(twelve.slice(0, 10).every((id) => by.get(id)!.toRank === "klasse2")).toBe(true);
    expect(by.get("s11")).toMatchObject({ toRank: "klasse3", reason: "stay" });
    expect(by.get("champ")).toMatchObject({ toRank: "ereklasse", reason: "stay" });
    expect(by.get("kid")).toMatchObject({ toRank: "junior", reason: "stay" });
    expect(by.get("teen")).toMatchObject({ toRank: "klasse3", reason: "junior_age_out" });
    expect(by.get("absent")).toMatchObject({ toRank: "klasse2", reason: "stay" });
  });

  it("flags a tie that straddles place 10 for the board", () => {
    // s9, s10, s11 share 9th place → places 9–11 straddle the cut.
    const totals = [200, 190, 180, 170, 160, 150, 140, 130, 100, 100, 100, 50];
    const data = twelve.flatMap((id, i) => results(id, [totals[i]]));
    const proposal = proposeRanks({
      ranks: DEFAULT_RANKS,
      shooters: shooters.filter((s) => s.rankCode === "klasse3"),
      standings: seasonStandings(data, rankOf, { type: "sum" }),
      nextSeasonYear: 2027,
    });
    const by = new Map(proposal.map((p) => [p.shooterId, p]));
    expect(by.get("s8")!.reason).toBe("promotion");
    for (const id of ["s9", "s10", "s11"]) expect(by.get(id)).toMatchObject({ reason: "tie_at_cut", toRank: "klasse3" });
    expect(by.get("s12")!.reason).toBe("stay");
  });
});
