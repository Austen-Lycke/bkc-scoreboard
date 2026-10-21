import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatLongDate } from "@/components/public/format";
import { buildState, entryName, passOf, ranksInShootingOrder, standingsFor } from "@/lib/competition";
import { buildSnapshot } from "@/lib/server/snapshot";
import { requireRole } from "@/lib/session";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Uitslag afdrukken" };

/** All ranks on paper, with full names, for the club's notice board. */
export default async function PrintResultsPage({ params }: PageProps<"/admin/wedstrijden/[id]/afdrukken">) {
  await requireRole("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const snapshot = await buildSnapshot(id);
  if (!snapshot) notFound();
  const state = buildState(snapshot);
  const { rounds, knockdowns, name, date, location } = state.snapshot.competition;
  const cols: [number, number][] = [];
  for (let r = 1; r <= rounds; r++) for (let k = 1; k <= knockdowns; k++) cols.push([r, k]);

  return (
    <article className="mx-auto w-full max-w-3xl bg-white text-black print:max-w-none">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 print:mb-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest">Brugse Katapultclub</p>
          <h1 className="text-3xl font-semibold">Uitslag {name}</h1>
          <p className="text-sm">
            {formatLongDate(date)}
            {location ? ` · ${location}` : ""}
          </p>
        </div>
        <PrintButton />
      </div>
      {ranksInShootingOrder(state).map((rank) => {
        const standings = standingsFor(state, rank.code);
        if (!standings.rows.length) return null;
        return (
          <section key={rank.code} className="mb-6 break-inside-avoid">
            <h2 className="border-b-2 border-black pb-1 text-xl font-semibold">{rank.name}</h2>
            {/* On a phone screen the passes scroll sideways; on paper everything fits. */}
            <div className="overflow-x-auto print:overflow-visible">
              <table className="mt-2 w-full min-w-[30rem] text-sm print:min-w-0">
                <thead>
                  <tr className="text-left">
                    <th className="w-10 py-1">Pl.</th>
                    <th className="py-1">Naam</th>
                    {cols.map(([r, k]) => (
                      <th key={`${r}${k}`} className="w-16 py-1 text-center">
                        R{r} KD{k}
                      </th>
                    ))}
                    <th className="w-16 py-1 text-right">Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.rows.map((row) => (
                    <tr key={row.entryId} className="border-t border-gray-300">
                      <td className="py-1 font-semibold">{row.position ?? "–"}</td>
                      <td className="py-1">
                        {entryName(state, row.entryId)}
                        {row.tie === "resolved" && <span className="ml-2 text-xs">(na afkamping)</span>}
                        {row.withdrawn && <span className="ml-2 text-xs">(afgehaakt)</span>}
                      </td>
                      {cols.map(([r, k]) => (
                        <td key={`${r}${k}`} className="py-1 text-center tabular-nums">
                          {passOf(state, row.entryId, r, k)?.score ?? "·"}
                        </td>
                      ))}
                      <td className="py-1 text-right font-semibold tabular-nums">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </article>
  );
}
