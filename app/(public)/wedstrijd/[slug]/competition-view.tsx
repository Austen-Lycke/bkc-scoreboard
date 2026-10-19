"use client";

import { useEffect, useState } from "react";
import { Knockdown } from "@/components/knockdown";
import { formatLongDate, LIVE } from "@/components/public/format";
import { StandingsTable } from "@/components/public/standings-table";
import { StatusPill } from "@/components/public/status-pill";
import type { PublicView } from "@/lib/competition";

const POLL_MS = 5000;
const clock = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The public competition page. While the competition runs, it refreshes itself every few seconds. */
export function CompetitionView({ initial, live }: { initial: PublicView; live: boolean }) {
  const [view, setView] = useState(initial);
  const [stale, setStale] = useState(false);
  const polling = live && !["finished", "published"].includes(view.competition.status);

  useEffect(() => {
    if (!polling) return;
    let stopped = false;
    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/public/competitions/${initial.competition.slug}/live`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next: PublicView = await res.json();
        if (!stopped) {
          setView(next);
          setStale(false);
        }
      } catch {
        if (!stopped) setStale(true);
      }
    }
    const timer = setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [polling, initial.competition.slug]);

  const { competition: comp } = view;
  const isLive = LIVE.has(comp.status);
  const shootingRank = view.current?.rankName;
  const [rankTab, setRankTab] = useState<string | null>(null);
  const selectedRank =
    view.ranks.find((r) => r.code === rankTab) ?? view.ranks.find((r) => r.name === shootingRank) ?? view.ranks[0];
  const pct = view.progress.total ? Math.round((view.progress.done / view.progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill status={comp.status} />
          {polling && view.updatedAt && (
            <span className="text-xs text-muted">
              {stale ? "Verbinding verloren, opnieuw proberen…" : `Bijgewerkt ${clock.format(new Date(view.updatedAt))}`}
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{comp.name}</h1>
        <p className="mt-1 text-muted">
          {formatLongDate(comp.date)}
          {comp.location ? ` · ${comp.location}` : ""}
        </p>
        {(isLive || view.progress.done > 0) && view.progress.total > 0 && (
          <div className="mt-5 max-w-md">
            <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div className="h-full rounded-full bg-gold transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {view.progress.done} van {view.progress.total} beurten geschoten
            </p>
          </div>
        )}
      </header>

      {comp.status === "prepared" && (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted">
          De wedstrijd is nog niet begonnen. Deze pagina wordt automatisch live zodra de eerste schutters aan de lijn staan.
        </p>
      )}

      {isLive && view.current && (
        <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl bg-navy p-6 text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold">
              {comp.status === "break" ? "Na de pauze" : comp.status === "warmup" ? "Na de opwarming" : "Nu aan de beurt"}
            </p>
            <p className="mt-1 text-white/70">
              Ronde {view.current.round} · {view.current.rankName} · beurt {view.current.heatNumber}/{view.current.heatsInRank}
              {view.current.swapped ? " · gewisseld" : ""}
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {view.current.shooters.map((s) => (
                <li key={s.shooterId} className="rounded-xl bg-white/[0.06] p-4">
                  <p className="text-xs uppercase tracking-widest text-white/50">Knockdown {s.knockdown}</p>
                  <p className="mt-1 text-xl font-semibold">{s.name}</p>
                  <p className="mt-2 text-white/70">
                    Totaal <span className="text-lg font-semibold tabular-nums text-white">{s.total}</span>
                    {s.position ? ` · plaats ${s.position}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Volgende</p>
            {view.next.length === 0 ? (
              <p className="mt-3 text-muted">Laatste beurt van de wedstrijd.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-3">
                {view.next.map((h, i) => (
                  <li key={i}>
                    <p className="text-xs text-muted">
                      Ronde {h.round} · {h.rankName}
                    </p>
                    <p className="font-medium">{h.names.join(" & ")}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}

      {isLive && view.lastPasses.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Laatste beurten</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {view.lastPasses.map((p) => (
              <li key={`${p.name}${p.round}${p.knockdown}${p.at}`} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-2xl font-semibold tabular-nums">{p.score}</p>
                </div>
                <p className="text-xs text-muted">
                  {p.rankName} · R{p.round} KD{p.knockdown}
                </p>
                <Knockdown setup={p.setup} hits={p.hits} className="mt-3 w-full" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {view.ranks.length > 0 && selectedRank && (
        <section>
          <h2 className="text-lg font-semibold">{isLive ? "Tussenstand" : "Uitslag"}</h2>
          <div className="mt-3 flex flex-wrap gap-2" role="tablist">
            {view.ranks.map((r) => (
              <button
                key={r.code}
                type="button"
                role="tab"
                aria-selected={r.code === selectedRank.code}
                onClick={() => setRankTab(r.code)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  r.code === selectedRank.code ? "bg-navy text-white dark:bg-gold dark:text-navy" : "border border-border bg-surface hover:border-gold"
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <StandingsTable
              rank={selectedRank}
              passLabels={view.passLabels}
              highlight={isLive ? view.current?.shooters.map((s) => s.shooterId) : undefined}
            />
          </div>
        </section>
      )}
    </div>
  );
}
