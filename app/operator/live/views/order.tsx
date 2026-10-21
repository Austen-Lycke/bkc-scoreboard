"use client";

import { useMemo } from "react";
import {
  autoOrder,
  competitionProgress,
  competitionSchedule,
  effectiveOrder,
  entriesOfRank,
  entryName,
  ranksInShootingOrder,
} from "@/lib/competition";
import { emit } from "@/lib/offline/store";
import { passKey } from "@/lib/scoring";
import { useComp } from "../context";
import { Empty, Panel, Tag } from "@/components/ui";

/**
 * Shooting order per rank, shown in heats (one shooter per knockdown). Weakest first, leader last.
 * Heats that already shot (or are shooting) are fixed: moving those shooters would re-pair passes.
 */
export function OrderView() {
  const { id, state } = useComp();
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const next = useMemo(() => competitionProgress(state, schedule).heatIndex, [state, schedule]);
  // Only during a round is the next heat in line actually on the line.
  const current = state.status === "round1" || state.status === "round2" ? next : null;
  const perHeat = state.snapshot.competition.knockdowns;
  const ranks = ranksInShootingOrder(state).filter((r) => entriesOfRank(state, r.code, { includeWithdrawn: true }).length > 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-[0.875rem] overflow-auto px-4 pb-8 pt-2 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-5 px-1">
        <h2 className="text-[1.375rem] font-semibold">Volgorde</h2>
        <p className="max-w-[45rem] text-pretty text-sm text-muted">
          Omgekeerd seizoensklassement: de zwakste eerst, de leider als laatste. Zonder seizoenspunten wordt vooraan geloot. Vastgezet bij de start;
          laatkomers sluiten achteraan aan. Ronde 2 schiet in dezelfde volgorde. Beurten die al geschoten zijn liggen vast.
        </p>
      </div>
      {ranks.length === 0 ? (
        <Empty>Schrijf eerst schutters in.</Empty>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,26.25rem),1fr))] items-start gap-4">
          {ranks.map((rank) => {
            const order = effectiveOrder(state, rank.code);
            const stored = state.orders.get(rank.code);
            const withdrawn = entriesOfRank(state, rank.code, { includeWithdrawn: true }).filter((e) => e.withdrawn);
            const heats = chunk(order, perHeat);
            const scheduled = (h: number) =>
              schedule.map((s, i) => ({ s, i })).filter(({ s }) => s.rankCode === rank.code && s.index === h);
            const isNow = (h: number) => scheduled(h).some(({ i }) => i === current);
            const isLocked = (h: number) =>
              isNow(h) || scheduled(h).some(({ s }) => s.phases.flat().some((a) => state.passes.has(passKey(a.entryId, s.round, a.knockdown))));
            const lastLocked = heats.reduce((last, _, h) => (isLocked(h) ? h : last), -1);
            const fixed = Math.min(order.length, (lastLocked + 1) * perHeat);

            const move = (from: number, to: number) => {
              if (from < fixed || to < fixed || to >= order.length) return;
              const next = [...order];
              const [item] = next.splice(from, 1);
              next.splice(to, 0, item);
              void emit(id, "order.set", { rankCode: rank.code, entryIds: next, source: "manual" });
            };
            const restore = () => {
              const head = order.slice(0, fixed);
              const tail = autoOrder(state, rank.code).filter((e) => !head.includes(e));
              void emit(id, "order.set", { rankCode: rank.code, entryIds: [...head, ...tail], source: "reverse_ranking" });
            };

            return (
              <Panel key={rank.code} className="flex flex-col gap-3 px-3 py-5 sm:px-[1.375rem]">
                <div className="flex flex-wrap items-center gap-2.5 max-sm:px-1">
                  <h3 className="mr-auto text-[1.0625rem] font-semibold">{rank.name}</h3>
                  <Tag tone={stored?.source === "manual" ? "yellow" : "fill"} className="py-1">
                    {!stored ? "automatisch" : stored.source === "manual" ? "handmatig aangepast" : "vastgezet"}
                  </Tag>
                  {stored?.source === "manual" && (
                    <button
                      type="button"
                      onClick={restore}
                      className="cursor-pointer rounded-full border-[0.09375rem] border-border px-2.5 py-[0.1875rem] text-xs font-semibold hover:border-ink"
                    >
                      Automatisch herstellen
                    </button>
                  )}
                </div>
                {withdrawn.length > 0 && (
                  <span className="text-[0.8125rem] text-muted max-sm:px-1">Afgehaakt: {withdrawn.map((e) => entryName(state, e.entryId)).join(", ")}</span>
                )}
                {heats.length === 0 && <span className="text-sm text-faint">Niemand meer actief.</span>}
                {heats.map((heat, h) => {
                  const now = isNow(h);
                  const locked = isLocked(h);
                  const status = scheduled(h)
                    .map(({ s, i }) => {
                      const done = s.phases.flat().every((a) => state.passes.has(passKey(a.entryId, s.round, a.knockdown)));
                      return `R${s.round} ${i === current ? "nu" : done ? "✓" : "nog"}`;
                    })
                    .join(" · ");
                  return (
                    <div key={h} className={`overflow-hidden rounded-2xl border-[0.09375rem] ${now ? "border-yellow bg-yellow-light" : "border-divider bg-background"}`}>
                      <div className="flex justify-between px-[0.875rem] pb-1 pt-2 text-xs font-semibold text-muted">
                        <span>Beurt {h + 1}</span>
                        <span className={now ? "text-ink" : "text-faint"}>{status}</span>
                      </div>
                      {heat.map((entryId, j) => {
                        const index = h * perHeat + j;
                        const points = state.snapshot.seasonPoints[state.entries.get(entryId)!.shooterId];
                        const kd = heat.length === 1 && perHeat > 1 ? `KD ${Array.from({ length: perHeat }, (_, k) => k + 1).join("+")}` : `KD ${j + 1}`;
                        return (
                          <div key={entryId} className="flex items-center gap-2.5 py-1.5 pl-2.5 pr-2 sm:pl-[0.875rem]">
                            {/* Phone: the place in the order over the knockdown, and the season points under the name. */}
                            <span className="flex w-[3.25rem] flex-none flex-col sm:w-auto sm:flex-row sm:items-center sm:gap-2.5">
                              <span className="w-[1.375rem] font-mono text-xs font-medium text-faint">{index + 1}</span>
                              <span className="w-[3.25rem] whitespace-nowrap text-xs font-semibold text-faint">{kd}</span>
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-2.5">
                              <span className="truncate text-[0.9375rem] font-semibold sm:min-w-[7.5rem] sm:flex-1">{entryName(state, entryId)}</span>
                              <span className="min-w-0 truncate whitespace-nowrap text-xs text-muted" title={points === undefined ? "Nog geen seizoenspunten" : undefined}>
                                {points === undefined ? "geen punten" : `${Math.round(points)} ptn`}
                              </span>
                            </span>
                            {locked ? (
                              <span className="w-[6.25rem] flex-none whitespace-nowrap text-right text-xs text-muted">{now ? "wordt geschoten" : "geschoten"}</span>
                            ) : (
                              <>
                                <Arrow label="Naar boven" disabled={index <= fixed} onClick={() => move(index, index - 1)}>
                                  ↑
                                </Arrow>
                                <Arrow label="Naar beneden" disabled={index >= order.length - 1} onClick={() => move(index, index + 1)}>
                                  ↓
                                </Arrow>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Arrow({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 flex-none cursor-pointer place-items-center rounded-full text-sm hover:bg-fill disabled:cursor-default disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
