"use client";

import { autoOrder, effectiveOrder, entryName, ranksInShootingOrder } from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { useComp } from "../context";
import { Badge, Button, Card, Empty } from "@/components/ui";

const SOURCE_LABEL: Record<string, string> = {
  reverse_ranking: "vastgezet",
  random: "vastgezet",
  manual: "handmatig aangepast",
};

/** Shooting order per rank, shown in pairs (one per knockdown). Weakest first, leader last. */
export function OrderView() {
  const { id, state } = useComp();
  const perHeat = state.snapshot.competition.knockdowns;
  const ranks = ranksInShootingOrder(state).filter((r) => effectiveOrder(state, r.code).length > 0);

  if (ranks.length === 0) return <Empty>Schrijf eerst schutters in.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-3xl text-sm text-muted">
        De volgorde volgt het omgekeerde seizoensklassement: de zwakste eerst, de leider als laatste. Schutters zonder
        seizoenspunten (nieuw of eerste wedstrijd) worden willekeurig vooraan geloot. Bij de start van de wedstrijd wordt
        de volgorde vastgezet; laatkomers sluiten achteraan aan. Ronde 2 schiet in dezelfde volgorde.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {ranks.map((rank) => {
          const order = effectiveOrder(state, rank.code);
          const stored = state.orders.get(rank.code);
          const move = (from: number, to: number) => {
            const next = [...order];
            const [item] = next.splice(from, 1);
            next.splice(to, 0, item);
            void emit(id, "order.set", { rankCode: rank.code, entryIds: next, source: "manual" });
          };
          return (
            <Card key={rank.code} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{rank.name}</h3>
                <div className="flex items-center gap-2">
                  <Badge tone={stored ? "navy" : "neutral"}>{stored ? SOURCE_LABEL[stored.source] : "automatisch"}</Badge>
                  {stored?.source === "manual" && (
                    <Button
                      size="sm"
                      tone="ghost"
                      onClick={() => emit(id, "order.set", { rankCode: rank.code, entryIds: autoOrder(state, rank.code), source: "reverse_ranking" })}
                    >
                      Automatisch herstellen
                    </Button>
                  )}
                </div>
              </div>
              <ol className="mt-3 flex flex-col gap-2">
                {chunk(order, perHeat).map((heat, h) => (
                  <li key={h} className="rounded-lg border border-border">
                    <p className="border-b border-border px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                      Beurt {h + 1}
                    </p>
                    <ul>
                      {heat.map((entryId, i) => {
                        const index = h * perHeat + i;
                        const points = state.snapshot.seasonPoints[state.entries.get(entryId)!.shooterId];
                        return (
                          <li key={entryId} className="flex items-center gap-2 px-3 py-1.5">
                            <span className="w-6 text-right font-mono text-sm text-muted">{index + 1}</span>
                            <span className="mr-auto">{entryName(state, entryId)}</span>
                            <span className="text-xs text-muted">{points === undefined ? "geen seizoenspunten" : `${Math.round(points)} ptn`}</span>
                            <Button size="sm" tone="ghost" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label="Naar boven">
                              ↑
                            </Button>
                            <Button
                              size="sm"
                              tone="ghost"
                              disabled={index === order.length - 1}
                              onClick={() => move(index, index + 1)}
                              aria-label="Naar beneden"
                            >
                              ↓
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ol>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
