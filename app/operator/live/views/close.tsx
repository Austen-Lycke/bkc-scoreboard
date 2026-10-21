"use client";

import { useState } from "react";
import { entryName, expectedPasses, ranksInShootingOrder, resultsCsv, standingsFor } from "@/lib/competition";
import { emit, eventsForExport } from "@/lib/offline/store";
import { useComp } from "../context";
import { Panel, Pill, Tag } from "@/components/ui";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** End of the day: check every rank is complete and tie-free, export, close the competition. */
export function CloseView() {
  const { id, state } = useComp();
  const [asking, setAsking] = useState(false);
  const comp = state.snapshot.competition;
  const finished = state.status === "finished";
  const ranks = ranksInShootingOrder(state)
    .map((r) => ({ rank: r, standings: standingsFor(state, r.code) }))
    .filter((r) => r.standings.rows.length > 0);
  const ready = ranks.every((r) => r.standings.complete && r.standings.pendingTies.length === 0);
  const missing = (r: (typeof ranks)[number]) =>
    r.standings.rows.filter((x) => !x.withdrawn).reduce((n, x) => n + Math.max(0, expectedPasses(state) - x.passCount), 0);

  async function backup() {
    const events = await eventsForExport(id);
    download(`${comp.slug}-backup.json`, JSON.stringify({ snapshot: state.snapshot, events }, null, 2), "application/json");
  }

  async function finish() {
    await emit(id, "status.set", { status: "finished" });
    setAsking(false);
  }

  const reopen = () => emit(id, "status.set", { status: state.previousStatus && state.previousStatus !== "finished" ? state.previousStatus : "round2" });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-8 pb-8 pt-2">
      <h2 className="px-1 text-[1.375rem] font-semibold">Afronden</h2>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18.75rem),1fr))] items-start gap-[0.875rem]">
        {ranks.map((r) => {
          const status = !r.standings.complete
            ? ({ label: `nog ${missing(r)} passages`, tone: "fill" } as const)
            : r.standings.pendingTies.length
              ? ({ label: "afkamping nodig", tone: "error" } as const)
              : ({ label: "volledig", tone: "good" } as const);
          return (
            <Panel key={r.rank.code} size="md" className="flex flex-col gap-2.5 px-5 py-[1.125rem]">
              <div className="flex items-center justify-between">
                <span className="text-base font-semibold">{r.rank.name}</span>
                <Tag tone={status.tone} className="py-1">
                  {status.label}
                </Tag>
              </div>
              {r.standings.rows
                .filter((x) => x.position !== null && x.position <= 3)
                .map((x) => (
                  <div key={x.entryId} className="flex items-baseline gap-3 text-[0.9375rem]">
                    <span className="w-[1.125rem] font-bold tabular-nums">{x.position}</span>
                    <span className="flex-1 font-medium">{entryName(state, x.entryId)}</span>
                    <span className="font-semibold tabular-nums">{x.total}</span>
                  </div>
                ))}
            </Panel>
          );
        })}
      </div>
      <Panel className="flex flex-wrap items-center gap-2.5 px-6 py-[1.375rem]">
        {asking ? (
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border-[0.09375rem] border-yellow bg-yellow-light py-2.5 pl-4 pr-3">
            <span className="text-sm font-semibold">
              {ready ? "Wedstrijd beëindigen? Scoren gaat daarna op slot." : "Nog niet alles is volledig. Toch beëindigen? Scoren gaat daarna op slot."}
            </span>
            <Pill tone="ink" className="py-[0.5625rem] font-bold" onClick={finish}>
              Ja, beëindigen
            </Pill>
            <Pill tone="ghost" className="py-[0.5625rem]" onClick={() => setAsking(false)}>
              Annuleren
            </Pill>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => !finished && setAsking(true)}
            className={`rounded-2xl px-[1.375rem] py-[0.9375rem] text-base font-bold ${finished ? "cursor-default bg-ink text-white" : "cursor-pointer bg-yellow hover:brightness-95"}`}
          >
            {finished ? "Wedstrijd beëindigd ✓" : "Wedstrijd beëindigen"}
          </button>
        )}
        {finished && (
          <button type="button" onClick={reopen} className="cursor-pointer px-3 py-2.5 text-sm font-semibold text-muted underline hover:text-ink">
            Heropenen
          </button>
        )}
        <Pill tone="outline-ink" size="lg" onClick={() => download(`${comp.slug}-uitslag.csv`, resultsCsv(state), "text/csv;charset=utf-8")}>
          Uitslag (CSV voor Excel)
        </Pill>
        <Pill tone="outline-ink" size="lg" onClick={backup}>
          Back-up downloaden
        </Pill>
        {!finished && !asking && !ready && <span className="text-[0.8125rem] font-semibold text-error">Nog niet alles is volledig</span>}
        <span className="w-full pt-1 text-[0.8125rem] text-muted">
          De back-up bevat alle gegevens en acties van deze wedstrijd op dit toestel. Bewaar hem op een USB-stick als extra zekerheid.
        </span>
      </Panel>
    </div>
  );
}
