"use client";

import Link from "next/link";
import { useState } from "react";
import type { PublicRank, PublicRow, PublicView } from "@/lib/competition";

const TIE: Record<string, string | null> = { none: null, resolved: "na afkamping", shared: "gelijk", pending: "afkamping", waived: "gedeelde plaats" };

/** While live, a long ranking is folded to the top (5, on a phone 3) plus whoever is on the line or next. */
const FOLD_FROM = 9;
const TOP = { wide: 5, narrow: 3 };

type Item = { row: PublicRow; hide: string } | { gap: number; hide: string };

/**
 * Rows to show, with "Toon nog N schutters" where rows are folded away. Phone and desktop keep a
 * different top, so each gets its own gaps; `hide` hides an item on the other one.
 */
function fold(rows: PublicRow[], flagged: (row: PublicRow) => boolean): Item[] {
  const items: Item[] = [];
  const hidden = { wide: 0, narrow: 0 };
  const flush = (mode: "wide" | "narrow") => {
    if (hidden[mode]) items.push({ gap: hidden[mode], hide: mode === "wide" ? "max-md:hidden" : "md:hidden" });
    hidden[mode] = 0;
  };
  rows.forEach((row, i) => {
    const keep = { wide: i < TOP.wide || flagged(row), narrow: i < TOP.narrow || flagged(row) };
    for (const mode of ["narrow", "wide"] as const) {
      if (keep[mode]) flush(mode);
      else hidden[mode]++;
    }
    if (keep.wide || keep.narrow) items.push({ row, hide: !keep.narrow ? "max-md:hidden" : !keep.wide ? "md:hidden" : "" });
  });
  flush("narrow");
  flush("wide");
  return items;
}

/** `onLine`: shooters are on the line now (not in a break, warmup or afkamping). */
export function Standings({ view, isLive, onLine }: { view: PublicView; isLive: boolean; onLine: boolean }) {
  const { competition: comp, current } = view;
  const [tab, setTab] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rank = view.ranks.find((r) => r.code === tab) ?? view.ranks.find((r) => r.name === current?.rankName) ?? view.ranks[0];
  if (!rank) return null;

  const status = comp.status;
  // In a break `current` is the first heat after it: everything of the rounds before is shot.
  const doneRounds = status === "break" && current ? current.round - 1 : 0;
  const donePasses = view.passRounds.filter((r) => r <= doneRounds).length;
  const title =
    status === "finished"
      ? "Uitslag"
      : status === "prepared"
        ? "Ingeschreven"
        : doneRounds > 0
          ? `Voorlopige stand na ronde ${doneRounds}`
          : "Voorlopige stand";
  const note = doneRounds > 0 ? `${donePasses} van ${view.passLabels.length} ${view.passUnit}` : view.passNote;

  return (
    <section className="flex min-w-0 flex-[2_1_32rem] flex-col gap-4 rounded-card border-2 border-border bg-surface px-[clamp(1rem,3cqw,2rem)] pb-[clamp(1.25rem,3cqw,1.75rem)] pt-[clamp(1.25rem,3cqw,1.875rem)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-[clamp(1.625rem,3cqw,2.25rem)] font-semibold leading-none tracking-[-0.035em]">{title}</h2>
        <span className="text-[0.9375rem] text-muted max-md:hidden">{note}</span>
      </div>
      <div role="tablist" className="flex flex-wrap gap-2">
        {view.ranks.map((r) => {
          const on = r.code === rank.code;
          const shooting = isLive && r.name === current?.rankName;
          return (
            <button
              key={r.code}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(r.code)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-pill border-2 px-[1.125rem] font-semibold ${
                on ? "border-ink bg-ink text-white" : "border-border bg-surface hover:border-ink"
              }`}
            >
              {r.name}
              {shooting && <span className={`size-2 rounded-full ${on ? "bg-yellow" : "bg-live"}`} />}
            </button>
          );
        })}
      </div>
      <span className="text-[0.9375rem] text-muted max-md:hidden">{rank.rows.filter((r) => !r.withdrawn).length} schutters</span>
      <Rows rank={rank} view={view} isLive={isLive} onLine={onLine} folded={isLive && rank.rows.length >= FOLD_FROM && !open[rank.code]} onUnfold={() => setOpen((o) => ({ ...o, [rank.code]: true }))} />
      <div className="flex flex-wrap gap-x-5 gap-y-2 border-t-2 border-divider pt-2 text-sm text-muted max-md:hidden">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-ink" />
          geschoten
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5">
            <span className="box-border size-3 rounded-full border-2 border-ink bg-yellow" />
            nu bezig
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="box-border size-3 rounded-full border-2 border-plate" />
          nog te schieten
        </span>
      </div>
    </section>
  );
}

function Rows({
  rank,
  view,
  isLive,
  onLine,
  folded,
  onUnfold,
}: {
  rank: PublicRank;
  view: PublicView;
  isLive: boolean;
  onLine: boolean;
  folded: boolean;
  onUnfold: () => void;
}) {
  const current = onLine ? view.current : null;
  // In a break or the warmup, the heat that shoots first is next.
  const nextIds = onLine ? (view.next[0]?.shooterIds ?? []) : isLive ? (view.current?.shooters.map((s) => s.shooterId) ?? []) : [];
  const liveCol = (row: PublicRow) => current?.shooters.find((x) => x.shooterId === row.shooterId)?.col ?? -1;
  const flagged = (row: PublicRow) => liveCol(row) >= 0 || nextIds.includes(row.shooterId);
  const items: Item[] = folded ? fold(rank.rows, flagged) : rank.rows.map((row) => ({ row, hide: "" }));

  return (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => {
        if ("gap" in item) {
          return (
            <button
              key={`gap-${i}`}
              type="button"
              onClick={onUnfold}
              className={`-mx-3 flex min-h-11 cursor-pointer items-center gap-4 rounded-row px-3 text-left hover:bg-hover ${item.hide}`}
            >
              <span className="text-2xl leading-none tracking-[0.3em] text-subtle">···</span>
              <span className="text-[0.9375rem] font-semibold text-muted">Toon nog {item.gap} schutters</span>
            </button>
          );
        }
        const { row } = item;
        const now = liveCol(row);
        const shooting = now >= 0;
        const next = !shooting && nextIds.includes(row.shooterId);
        // Nobody who hasn't shot yet has a place (they'd all tie on 0).
        const shot = row.passes.some((p) => p !== null);
        const position = shot ? row.position : null;
        const tag = row.withdrawn ? "afgehaakt" : shot ? TIE[row.tie] : null;
        const strong = shooting || position === 1;
        return (
          <div
            key={row.shooterId}
            className={`-mx-3 flex min-h-14 items-center gap-[clamp(0.625rem,1.6cqw,1rem)] rounded-row px-3 py-1.5 ${shooting ? "bg-yellow-light" : ""} ${item.hide}`}
          >
            <span className={`w-7 flex-none text-lg font-semibold ${strong ? "text-ink" : "text-muted"}`}>{position ?? "–"}</span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
              <Link
                href={`/schutter/${row.shooterId}`}
                className={`max-w-full truncate text-[clamp(1.0625rem,1.5cqw,1.1875rem)] leading-tight tracking-[-0.01em] hover:underline hover:decoration-2 hover:underline-offset-[0.1875rem] ${
                  strong ? "font-bold" : "font-medium"
                } ${row.withdrawn ? "text-faint" : ""}`}
              >
                {row.name}
              </Link>
              {/* On a phone the yellow row already says who's on the line. */}
              {shooting && <span className="rounded-pill bg-yellow px-2 py-0.5 text-xs font-bold max-md:hidden">Nu aan de lijn</span>}
              {next && <span className="rounded-pill bg-fill px-2 py-0.5 text-xs font-bold">Hierna</span>}
              {!shooting && !next && tag && <span className="text-[0.8125rem] font-semibold text-muted">{tag}</span>}
            </div>
            <div className="flex flex-none gap-[0.3125rem]">
              {row.passes.map((p, i) => (
                <span
                  key={i}
                  title={`${view.passLabels[i]}${p === null ? "" : `: ${p}`}`}
                  className="box-border size-3 rounded-full border-2"
                  style={{
                    background: i === now ? "var(--yellow)" : p === null ? "transparent" : "var(--ink)",
                    borderColor: i === now || p !== null ? "var(--ink)" : "var(--plate)",
                  }}
                />
              ))}
            </div>
            <span className={`w-11 flex-none text-right text-[clamp(1.25rem,1.8cqw,1.5rem)] font-semibold tracking-[-0.03em] ${row.withdrawn ? "text-faint" : ""}`}>
              {shot ? row.total : "–"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
