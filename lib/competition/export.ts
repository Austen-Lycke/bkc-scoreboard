import { toCsv } from "@/lib/csv";
import { competitionSchedule, entryName, groupsInShootingOrder, passColumns, passLabel, passOf, standingsFor } from "./derive";
import type { CompetitionState } from "./state";

const TIE_LABEL = { none: "", resolved: "na afkamping", shared: "gedeeld", pending: "afkamping nodig" } as const;

/** Results as CSV for Excel (semicolon separated, UTF-8 with BOM, as Belgian Excel expects). */
export function resultsCsv(state: CompetitionState): string {
  const passCols = passColumns(state);
  const header = ["Klasse", "Plaats", "Naam", ...passCols.map((c) => passLabel(c)), "Totaal", "Opmerking"];
  const rows = [header];
  for (const group of groupsInShootingOrder(state)) {
    for (const row of standingsFor(state, group.code).rows) {
      rows.push([
        group.name,
        row.position === null ? "" : String(row.position),
        entryName(state, row.entryId),
        ...passCols.map((c) => String(passOf(state, row.entryId, c.round, c.knockdown)?.score ?? "")),
        String(row.total),
        row.withdrawn ? "afgehaakt" : TIE_LABEL[row.tie],
      ]);
    }
  }
  return toCsv(rows);
}

/** Total heats per group and round, for progress displays. */
export function heatCount(state: CompetitionState, groupCode: string, round: number): number {
  return competitionSchedule(state).filter((h) => h.groupCode === groupCode && h.round === round).length;
}
