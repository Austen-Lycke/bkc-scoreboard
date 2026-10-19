import { toCsv } from "@/lib/csv";
import { competitionSchedule, entryName, passOf, ranksInShootingOrder, standingsFor } from "./derive";
import type { CompetitionState } from "./state";

const TIE_LABEL = { none: "", resolved: "na afkamping", shared: "gedeeld", pending: "afkamping nodig" } as const;

/** Results as CSV for Excel (semicolon separated, UTF-8 with BOM, as Belgian Excel expects). */
export function resultsCsv(state: CompetitionState): string {
  const { rounds, knockdowns } = state.snapshot.competition;
  const passCols: [number, number][] = [];
  for (let r = 1; r <= rounds; r++) for (let k = 1; k <= knockdowns; k++) passCols.push([r, k]);

  const header = ["Klasse", "Plaats", "Naam", ...passCols.map(([r, k]) => `R${r} KD${k}`), "Totaal", "Opmerking"];
  const rows = [header];
  for (const rank of ranksInShootingOrder(state)) {
    for (const row of standingsFor(state, rank.code).rows) {
      rows.push([
        rank.name,
        row.position === null ? "" : String(row.position),
        entryName(state, row.entryId),
        ...passCols.map(([r, k]) => String(passOf(state, row.entryId, r, k)?.score ?? "")),
        String(row.total),
        row.withdrawn ? "afgehaakt" : TIE_LABEL[row.tie],
      ]);
    }
  }
  return toCsv(rows);
}

/** Total heats per rank and round, for progress displays. */
export function heatCount(state: CompetitionState, rankCode: string, round: number): number {
  return competitionSchedule(state).filter((h) => h.rankCode === rankCode && h.round === round).length;
}
