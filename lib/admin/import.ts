import { parseCsv } from "@/lib/csv";
import { initialRank, type RankDef } from "@/lib/scoring";

/** Member list import: validates a CSV from the club's own records before anything is written. */

export interface ImportRow {
  line: number;
  firstName: string;
  lastName: string;
  birthdate: string;
  rankCode: string | null;
  /** Rank given in the file, or derived from age (Junior / entry adult rank). */
  rankSource: "file" | "age";
  status: "new" | "duplicate" | "error";
  message?: string;
}

const HEADERS = {
  firstName: ["voornaam", "first name", "firstname", "prénom", "prenom"],
  lastName: ["achternaam", "familienaam", "naam", "last name", "lastname", "nom"],
  birthdate: ["geboortedatum", "geb. datum", "geboorte", "birthdate", "date of birth", "date de naissance"],
  rank: ["klasse", "rang", "categorie", "rank"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();

/** Dates as Belgians type them (31/12/1980, 31-12-1980, 31.12.1980), ISO, or an Excel date number. */
export function parseDate(input: string): string | null {
  const s = input.trim();
  let y: number, m: number, d: number;
  let match: RegExpMatchArray | null;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) [y, m, d] = [+match[1], +match[2], +match[3]];
  else if ((match = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [d, m, y] = [+match[1], +match[2], +match[3]];
  else if (/^\d{5}$/.test(s)) {
    // Excel serial date (days since 1899-12-30)
    const date = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86_400_000);
    [y, m, d] = [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()];
  } else return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  if (y < 1900 || y > 2100) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "3de klasse", "3de", "derde", "3", "klasse3", "Ere", "jeugd"… → rank code. */
export function parseRank(input: string, ranks: readonly RankDef[]): string | null {
  const s = norm(input).replace(/\s*klasse\s*/g, " ").trim();
  if (!s) return null;
  for (const r of ranks) if (norm(r.code) === norm(input) || norm(r.name) === norm(input)) return r.code;
  const junior = ranks.find((r) => r.isJunior);
  if (junior && /^(jun|junior|jeugd|u18)/.test(s)) return junior.code;
  if (/^ere/.test(s)) return ranks.find((r) => /^ere/i.test(r.name))?.code ?? null;
  const words: Record<string, number> = { eerste: 1, "1ste": 1, "1e": 1, "1": 1, tweede: 2, "2de": 2, "2e": 2, "2": 2, derde: 3, "3de": 3, "3e": 3, "3": 3 };
  const n = words[s];
  if (n) return ranks.find((r) => norm(r.name).startsWith(`${n}`))?.code ?? null;
  return null;
}

export const shooterKey = (s: { firstName: string; lastName: string; birthdate: string }) =>
  `${norm(s.firstName)}|${norm(s.lastName)}|${s.birthdate}`;

export function validateImport(
  text: string,
  opts: { ranks: readonly RankDef[]; existingKeys: ReadonlySet<string>; seasonYear: number },
): { rows: ImportRow[]; error?: string } {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], error: "Het bestand is leeg." };
  const col = (aliases: string[]) => header.findIndex((h) => aliases.includes(norm(h)));
  const idx = { firstName: col(HEADERS.firstName), lastName: col(HEADERS.lastName), birthdate: col(HEADERS.birthdate), rank: col(HEADERS.rank) };
  const missing = [
    idx.firstName < 0 && "voornaam",
    idx.lastName < 0 && "achternaam",
    idx.birthdate < 0 && "geboortedatum",
  ].filter(Boolean);
  if (missing.length) return { rows: [], error: `Kolom(men) niet gevonden: ${missing.join(", ")}. De eerste rij moet de kolomnamen bevatten.` };

  const seen = new Set<string>();
  const rows = lines.map((cells, i): ImportRow => {
    const firstName = cells[idx.firstName] ?? "";
    const lastName = cells[idx.lastName] ?? "";
    const rawDate = cells[idx.birthdate] ?? "";
    const rawRank = idx.rank >= 0 ? (cells[idx.rank] ?? "") : "";
    const birthdate = parseDate(rawDate);
    const base = { line: i + 2, firstName, lastName, birthdate: birthdate ?? rawDate, rankCode: null, rankSource: "age" as const };
    if (!firstName || !lastName) return { ...base, status: "error", message: "Voornaam of achternaam ontbreekt" };
    if (!birthdate) return { ...base, status: "error", message: `Ongeldige geboortedatum "${rawDate}"` };
    let rankCode: string | null = null;
    let rankSource: ImportRow["rankSource"] = "age";
    if (rawRank) {
      rankCode = parseRank(rawRank, opts.ranks);
      if (!rankCode) return { ...base, status: "error", message: `Onbekende klasse "${rawRank}"` };
      rankSource = "file";
    } else rankCode = initialRank(birthdate, opts.seasonYear, opts.ranks).code;
    const key = shooterKey({ firstName, lastName, birthdate });
    const duplicate = opts.existingKeys.has(key) || seen.has(key);
    seen.add(key);
    return {
      ...base,
      birthdate,
      rankCode,
      rankSource,
      status: duplicate ? "duplicate" : "new",
      message: duplicate ? "Bestaat al" : undefined,
    };
  });
  return { rows };
}
