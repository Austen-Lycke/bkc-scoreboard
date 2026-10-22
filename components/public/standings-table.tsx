import Link from "next/link";
import type { PublicRank } from "@/lib/competition";

const TIE: Record<string, string | null> = { none: null, resolved: "na afkamping", shared: "gelijk", pending: "afkamping" };

/** Standings of one rank. Server-safe (no hooks), also rendered inside the live client view. */
export function StandingsTable({ rank, passLabels, highlight }: { rank: PublicRank; passLabels: string[]; highlight?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr className="border-b border-border">
            <th className="w-12 px-3 py-2.5 sm:px-4">Pl.</th>
            <th className="px-3 py-2.5 sm:px-4">Naam</th>
            {passLabels.map((l) => (
              <th key={l} className="hidden px-2 py-2.5 text-center sm:table-cell">
                {l}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right sm:px-4">Totaal</th>
          </tr>
        </thead>
        <tbody>
          {rank.rows.map((row) => {
            const tie = row.withdrawn ? "afgehaakt" : TIE[row.tie];
            const active = highlight?.includes(row.shooterId);
            return (
              <tr key={row.shooterId} className={`border-b border-border last:border-0 ${active ? "bg-yellow-light" : ""} ${row.withdrawn ? "text-muted" : ""}`}>
                <td className="px-3 py-2.5 font-semibold tabular-nums sm:px-4">
                  {row.position === null ? "–" : row.position <= 3 && rank.complete ? <Medal place={row.position} /> : row.position}
                </td>
                <td className="px-3 py-2.5 sm:px-4">
                  <Link href={`/schutter/${row.shooterId}`} className="font-medium hover:underline">
                    {row.name}
                  </Link>
                  {tie && <span className="ml-2 text-xs text-muted">{tie}</span>}
                  <span className="mt-0.5 block text-xs tabular-nums text-muted sm:hidden">{row.passes.map((p) => p ?? "·").join("  ")}</span>
                </td>
                {row.passes.map((p, i) => (
                  <td key={i} className={`hidden px-2 py-2.5 text-center tabular-nums sm:table-cell ${p !== null && p === rank.maxPasses[i] ? "font-bold underline decoration-yellow decoration-[0.1875rem] underline-offset-4" : ""}`}>
                    {p ?? <span className="text-muted">·</span>}
                  </td>
                ))}
                <td className="px-3 py-2.5 text-right text-base font-semibold tabular-nums sm:px-4">{row.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Medal({ place }: { place: number }) {
  const colors = ["bg-yellow text-ink", "bg-fill text-ink", "bg-[#e9e9e4] text-ink"];
  return <span className={`inline-flex size-6 items-center justify-center rounded-full text-xs ${colors[place - 1]}`}>{place}</span>;
}
