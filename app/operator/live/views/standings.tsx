"use client";

import { useState } from "react";
import { Knockdown } from "@/components/knockdown";
import { entryName, passOf, ranksInShootingOrder, setupForRank, standingsFor } from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { scorePass, type TieState } from "@/lib/scoring";
import { useComp } from "../context";
import { Badge, Button, Card, Empty } from "@/components/ui";

const TIE_BADGE: Record<TieState, { label: string; tone: "neutral" | "gold" | "red" | "green" } | null> = {
  none: null,
  shared: { label: "gelijk", tone: "neutral" },
  pending: { label: "afkamping nodig", tone: "red" },
  resolved: { label: "na afkamping", tone: "green" },
};

/** Standings per rank with every pass; click a pass to correct it. */
export function StandingsView() {
  const { state } = useComp();
  const ranks = ranksInShootingOrder(state).filter((r) => standingsFor(state, r.code).rows.length > 0);
  const [rankCode, setRankCode] = useState(ranks[0]?.code);
  const [editing, setEditing] = useState<{ entryId: string; round: number; knockdown: number } | null>(null);
  const { rounds, knockdowns } = state.snapshot.competition;

  if (ranks.length === 0 || !rankCode) return <Empty>Nog geen schutters.</Empty>;
  const standings = standingsFor(state, rankCode);
  const cols: [number, number][] = [];
  for (let r = 1; r <= rounds; r++) for (let k = 1; k <= knockdowns; k++) cols.push([r, k]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" role="tablist">
        {ranks.map((r) => (
          <Button key={r.code} role="tab" aria-selected={r.code === rankCode} tone={r.code === rankCode ? "primary" : "secondary"} onClick={() => setRankCode(r.code)}>
            {r.name}
          </Button>
        ))}
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted">
            <tr className="border-b border-border">
              <th className="px-4 py-2.5">Pl.</th>
              <th className="px-4 py-2.5">Naam</th>
              {cols.map(([r, k]) => (
                <th key={`${r}${k}`} className="px-2 py-2.5 text-center">
                  R{r} KD{k}
                </th>
              ))}
              <th className="px-4 py-2.5 text-right">Totaal</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {standings.rows.map((row) => {
              const badge = row.withdrawn ? { label: "afgehaakt", tone: "neutral" as const } : TIE_BADGE[row.tie];
              return (
                <tr key={row.entryId} className={`border-b border-border last:border-0 ${row.withdrawn ? "text-muted" : ""}`}>
                  <td className="px-4 py-2 font-semibold tabular-nums">{row.position ?? "–"}</td>
                  <td className="px-4 py-2 font-medium">{entryName(state, row.entryId)}</td>
                  {cols.map(([r, k]) => {
                    const pass = passOf(state, row.entryId, r, k);
                    return (
                      <td key={`${r}${k}`} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => setEditing({ entryId: row.entryId, round: r, knockdown: k })}
                          className="w-full rounded-md px-2 py-1.5 tabular-nums hover:bg-black/5 dark:hover:bg-white/10"
                          aria-label={`Ronde ${r} knockdown ${k} aanpassen`}
                        >
                          {pass ? pass.score : <span className="text-muted">·</span>}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right text-base font-semibold tabular-nums">{row.total}</td>
                  <td className="px-4 py-2">{badge && <Badge tone={badge.tone}>{badge.label}</Badge>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {editing && <PassEditor {...editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function PassEditor({ entryId, round, knockdown, onClose }: { entryId: string; round: number; knockdown: number; onClose: () => void }) {
  const { id, state } = useComp();
  const entry = state.entries.get(entryId)!;
  const setup = setupForRank(state.snapshot, entry.rankCode);
  const existing = passOf(state, entryId, round, knockdown);
  const [hits, setHits] = useState<string[]>(existing?.hits ?? []);

  async function save() {
    await emit(id, "pass.recorded", { entryId, round, knockdown, hits });
    onClose();
  }
  async function clear() {
    if (!confirm("Deze passage wissen? Ze moet dan opnieuw geschoten of ingevoerd worden.")) return;
    await emit(id, "pass.cleared", { entryId, round, knockdown });
    onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Passage aanpassen" className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-xl p-6">
        <div onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted">
            Ronde {round} · Knockdown {knockdown}
          </p>
          <h3 className="mt-1 text-xl font-semibold">{entryName(state, entryId)}</h3>
          <Knockdown
            setup={setup}
            hits={hits}
            onToggle={(t) => setHits((h) => (h.includes(t) ? h.filter((x) => x !== t) : [...h, t]))}
            className="mt-4 w-full"
          />
          <p className="mt-3 text-3xl font-semibold tabular-nums">
            {scorePass(setup, hits)}
            {existing && <span className="ml-3 text-base font-normal text-muted">was {existing.score}</span>}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button tone="primary" onClick={save}>
              Opslaan
            </Button>
            <Button tone="ghost" onClick={onClose}>
              Annuleren
            </Button>
            {existing && (
              <Button tone="danger" className="ml-auto" onClick={clear}>
                Passage wissen
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
