"use client";

import { entryName, expectedPasses, ranksInShootingOrder, resultsCsv, standingsFor } from "@/lib/competition";
import { emit, eventsForExport } from "@/lib/offline/store";
import { useComp } from "../context";
import { Badge, Button, Card } from "../ui";

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

/** End of the day: check every rank is complete and tie-free, export, close the competition. */
export function CloseView() {
  const { id, state } = useComp();
  const comp = state.snapshot.competition;
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

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {ranks.map((r) => (
          <Card key={r.rank.code} className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{r.rank.name}</h3>
              {!r.standings.complete ? (
                <Badge tone="gold">nog {missing(r)} passages</Badge>
              ) : r.standings.pendingTies.length ? (
                <Badge tone="red">afkamping nodig</Badge>
              ) : (
                <Badge tone="green">volledig</Badge>
              )}
            </div>
            <ol className="mt-3 flex flex-col gap-1.5">
              {r.standings.rows
                .filter((x) => x.position !== null && x.position <= 3)
                .map((x) => (
                  <li key={x.entryId} className="flex items-baseline gap-3">
                    <span className="w-5 font-semibold tabular-nums text-gold">{x.position}</span>
                    <span className="mr-auto">{entryName(state, x.entryId)}</span>
                    <span className="font-semibold tabular-nums">{x.total}</span>
                  </li>
                ))}
            </ol>
          </Card>
        ))}
      </div>
      <Card className="flex flex-wrap items-center gap-3 p-5">
        <Button tone="primary" disabled={state.status === "finished"} onClick={() => (ready || confirm("Nog niet alles is volledig. Toch beëindigen?")) && emit(id, "status.set", { status: "finished" })}>
          {state.status === "finished" ? "Wedstrijd beëindigd" : "Wedstrijd beëindigen"}
        </Button>
        <Button onClick={() => download(`${comp.slug}-uitslag.csv`, resultsCsv(state), "text/csv;charset=utf-8")}>Uitslag (CSV voor Excel)</Button>
        <Button onClick={backup}>Back-up downloaden</Button>
        <p className="w-full text-sm text-muted">
          De back-up bevat alle gegevens en acties van deze wedstrijd op dit toestel. Bewaar hem op een USB-stick als extra zekerheid.
        </p>
      </Card>
    </div>
  );
}
