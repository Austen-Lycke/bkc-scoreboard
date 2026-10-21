import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { DEFAULT_RANKS, type RankProposal } from "@/lib/scoring";
import { parseRank, shooterKey, validateImport } from "./import";
import { finalizeProposal } from "./promotion";

describe("csv", () => {
  it("reads Excel (;) and Sheets (,) exports with quotes and a BOM", () => {
    expect(parseCsv('\uFEFFVoornaam;Achternaam\r\n"Jan; Piet";"De ""Wit"""\r\n\r\n')).toEqual([
      ["Voornaam", "Achternaam"],
      ["Jan; Piet", 'De "Wit"'],
    ]);
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
  it("round-trips what we export", () => {
    const rows = [["Naam", "Opmerking"], ["Jan", 'zei "hallo"; dag']];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
  it("exports names that look like formulas as text, and imports them as typed", () => {
    const rows = [['=HYPERLINK("http://x")', "+32 50 12 34 56", "@SUM(A1)", "-", "-12", "3,5", "Jan"]];
    const csv = toCsv(rows);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(";'+32 50 12 34 56;'@SUM(A1);-;-12;3,5;Jan");
    expect(parseCsv(csv)).toEqual(rows);
  });
});

describe("member import", () => {
  it("understands how people write ranks", () => {
    const r = (s: string) => parseRank(s, DEFAULT_RANKS);
    expect([r("3de klasse"), r("3de"), r("derde"), r("3"), r("klasse3")]).toEqual(["klasse3", "klasse3", "klasse3", "klasse3", "klasse3"]);
    expect([r("1ste"), r("Eerste klasse"), r("2de"), r("Ere"), r("Ereklasse"), r("jeugd"), r("Junior")]).toEqual([
      "klasse1",
      "klasse1",
      "klasse2",
      "ereklasse",
      "ereklasse",
      "junior",
      "junior",
    ]);
    expect(r("vierde")).toBeNull();
  });

  it("validates rows, defaults a missing rank to 3de klasse and flags duplicates by name", () => {
    const existing = new Set([shooterKey({ firstName: "Jens", lastName: "Vermeulen" })]);
    const csv = [
      "Voornaam;Achternaam;Geboortedatum;Klasse",
      "jens;VERMEULEN;19/05/1988;3de",
      "Lotte;De Smet;;Junior",
      "Ward;Lambrecht;;ere",
      "Ward;Lambrecht;;ere",
      "Elien;Maes;;",
      ";Leeg;;",
      "Tom;;;",
      "Tom;Janssens;;vierde",
    ].join("\n");
    const { rows, error } = validateImport(csv, { ranks: DEFAULT_RANKS, existingKeys: existing });
    expect(error).toBeUndefined();
    expect(rows.map((r) => [r.line, r.status, r.rankCode, r.rankSource, r.message])).toEqual([
      [2, "duplicate", "klasse3", "file", "bestaat al"],
      [3, "new", "junior", "file", undefined],
      [4, "new", "ereklasse", "file", undefined],
      [5, "duplicate", "ereklasse", "file", "bestaat al"],
      [6, "new", "klasse3", "default", undefined],
      [7, "error", null, "file", "voornaam ontbreekt"],
      [8, "error", null, "file", "achternaam ontbreekt"],
      [9, "error", null, "file", "onbekende klasse"],
    ]);
  });

  it("needs only the name columns", () => {
    expect(validateImport("Voornaam,Achternaam\nJan,Peeters", { ranks: DEFAULT_RANKS, existingKeys: new Set() }).rows[0]).toMatchObject({
      status: "new",
      rankCode: "klasse3",
    });
    expect(validateImport("naam;datum\nJan;1/1/1990", { ranks: DEFAULT_RANKS, existingKeys: new Set() }).error).toMatch(/voornaam/);
  });
});

describe("finalizeProposal", () => {
  const proposals: RankProposal[] = [
    { shooterId: "a", fromRank: "klasse3", toRank: "klasse2", reason: "promotion" },
    { shooterId: "b", fromRank: "klasse3", toRank: "klasse3", reason: "tie_at_cut" },
    { shooterId: "c", fromRank: "junior", toRank: "klasse3", reason: "junior_age_out" },
    { shooterId: "d", fromRank: "junior", toRank: "junior", reason: "stay" },
    { shooterId: "e", fromRank: "klasse1", toRank: "klasse1", reason: "stay" },
  ];
  const juniors = new Set(["junior"]);

  it("refuses to save while a tie at the cut is undecided", () => {
    expect(finalizeProposal(proposals, {}, juniors)).toEqual({ ok: false, undecided: ["b"] });
  });

  it("applies the board's decisions and keeps the reasons", () => {
    const result = finalizeProposal(proposals, { b: "klasse2", e: "klasse2" }, juniors);
    expect(result.ok && result.ranks).toEqual([
      { shooterId: "a", rankCode: "klasse2", reason: "promotion" },
      { shooterId: "b", rankCode: "klasse2", reason: "manual" },
      { shooterId: "c", rankCode: "klasse3", reason: "junior_age_out" },
      { shooterId: "d", rankCode: "junior", reason: "junior" },
      { shooterId: "e", rankCode: "klasse2", reason: "manual" },
    ]);
  });
});
