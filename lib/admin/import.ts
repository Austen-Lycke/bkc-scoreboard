import { parseCsv } from "@/lib/csv";
import { entryAdultRank, type RankDef } from "@/lib/scoring";

/**
 * Member list import: validates a CSV from the club's own records before anything is written.
 * Columns: Voornaam; Achternaam; optional Klasse. Other columns (e.g. an old Geboortedatum) are ignored.
 */

export interface ImportRow {
  line: number;
  firstName: string;
  lastName: string;
  /** The rank as written in the file. */
  rankText: string;
  rankCode: string | null;
  /** Rank given in the file, or the entry adult rank when the cell is empty. */
  rankSource: "file" | "default";
  status: "new" | "duplicate" | "error";
  message?: string;
}

const HEADERS = {
  firstName: ["voornaam", "first name", "firstname", "prénom", "prenom"],
  lastName: ["achternaam", "familienaam", "naam", "last name", "lastname", "nom"],
  rank: ["klasse", "rang", "categorie", "rank"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").trim();

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

/** Without a birthdate, a member is recognised by name (case and accents ignored). */
export const shooterKey = (s: { firstName: string; lastName: string }) => `${norm(s.firstName)}|${norm(s.lastName)}`;

export function validateImport(
  text: string,
  opts: { ranks: readonly RankDef[]; existingKeys: ReadonlySet<string> },
): { rows: ImportRow[]; error?: string } {
  const [header, ...lines] = parseCsv(text);
  if (!header) return { rows: [], error: "Het bestand is leeg." };
  const col = (aliases: string[]) => header.findIndex((h) => aliases.includes(norm(h)));
  const idx = { firstName: col(HEADERS.firstName), lastName: col(HEADERS.lastName), rank: col(HEADERS.rank) };
  const missing = [idx.firstName < 0 && "voornaam", idx.lastName < 0 && "achternaam"].filter(Boolean);
  if (missing.length) return { rows: [], error: `Kolom(men) niet gevonden: ${missing.join(", ")}. De eerste rij moet de kolomnamen bevatten.` };
  const defaultRank = entryAdultRank(opts.ranks).code;

  const seen = new Set<string>();
  const rows = lines.map((cells, i): ImportRow => {
    const firstName = cells[idx.firstName] ?? "";
    const lastName = cells[idx.lastName] ?? "";
    const rankText = idx.rank >= 0 ? (cells[idx.rank] ?? "") : "";
    const base = { line: i + 2, firstName, lastName, rankText, rankCode: null, rankSource: "file" as const };
    if (!firstName) return { ...base, status: "error", message: "voornaam ontbreekt" };
    if (!lastName) return { ...base, status: "error", message: "achternaam ontbreekt" };
    const rankCode = rankText ? parseRank(rankText, opts.ranks) : defaultRank;
    if (!rankCode) return { ...base, status: "error", message: "onbekende klasse" };
    const key = shooterKey({ firstName, lastName });
    const duplicate = opts.existingKeys.has(key) || seen.has(key);
    seen.add(key);
    return {
      ...base,
      rankCode,
      rankSource: rankText ? "file" : "default",
      status: duplicate ? "duplicate" : "new",
      message: duplicate ? "bestaat al" : undefined,
    };
  });
  return { rows };
}
