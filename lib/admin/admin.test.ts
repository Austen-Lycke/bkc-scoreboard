import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";
import { DEFAULT_RANKS, type RankProposal } from "@/lib/scoring";
import { parseDate, parseRank, shooterKey, validateImport } from "./import";
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
  it("parses the date formats Belgians use", () => {
    expect(parseDate("31/12/1980")).toBe("1980-12-31");
    expect(parseDate("1-2-2011")).toBe("2011-02-01");
    expect(parseDate("05.06.1975")).toBe("1975-06-05");
    expect(parseDate("1980-12-31")).toBe("1980-12-31");
    expect(parseDate("29436")).toBe("1980-08-03"); // Excel serial
    expect(parseDate("31/02/1980")).toBeNull();
    expect(parseDate("12/31/1980")).toBeNull();
    expect(parseDate("gisteren")).toBeNull();
  });

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

  it("validates rows, derives missing ranks from age and flags duplicates", () => {
    const existing = new Set([shooterKey({ firstName: "Jens", lastName: "Vermeulen", birthdate: "1988-05-19" })]);
    const csv = [
      "Voornaam;Achternaam;Geboortedatum;Klasse",
      "Jens;Vermeulen;19/05/1988;3de",
      "Lotte;De Smet;12/04/2014;",
      "Ward;Lambrecht;05/10/1969;ere",
      "Ward;Lambrecht;05/10/1969;ere",
      "Elien;Maes;31/02/1995;",
      ";Leeg;01/01/1990;",
      "Tom;Janssens;11/06/1975;vierde",
    ].join("\n");
    const { rows, error } = validateImport(csv, { ranks: DEFAULT_RANKS, existingKeys: existing, seasonYear: 2026 });
    expect(error).toBeUndefined();
    expect(rows.map((r) => [r.line, r.status, r.rankCode, r.rankSource])).toEqual([
      [2, "duplicate", "klasse3", "file"],
      [3, "new", "junior", "age"],
      [4, "new", "ereklasse", "file"],
      [5, "duplicate", "ereklasse", "file"],
      [6, "error", null, "age"],
      [7, "error", null, "age"],
      [8, "error", null, "age"],
    ]);
  });

  it("explains a missing header", () => {
    expect(validateImport("naam;datum\nJan;1/1/1990", { ranks: DEFAULT_RANKS, existingKeys: new Set(), seasonYear: 2026 }).error).toMatch(/voornaam/);
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
