"use client";

import { useEffect, useState } from "react";
import { HeatProgress } from "@/components/heat-progress";
import { capitalize, CLUB_TIME_ZONE, FINISHED, formatCompactDate, formatLongDate, formatLongDay, LIVE } from "@/components/public/format";
import type { PublicView } from "@/lib/competition";
import { LineHero } from "./hero";
import { Countdown, FirstUp, Next, Podium } from "./side";
import { Standings } from "./standings";

const POLL_MS = 5000;
const clock = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });

const LIVE_PHASE: Record<string, string> = {
  warmup: "opwarming",
  round1: "Ronde 1",
  break: "pauze",
  round2: "Ronde 2",
  semifinal: "halve finale",
  final: "finale",
  shootoff: "afkamping",
};

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

  const { competition: comp, current } = view;
  const status = comp.status;
  const isLive = LIVE.has(status);
  const prepared = status === "prepared";
  const pausing = status === "break" || status === "warmup";
  const onLine = isLive && !pausing && !!current;
  const shooters = view.ranks.reduce((n, r) => n + r.rows.filter((x) => !x.withdrawn).length, 0);
  const firstUp = (prepared || pausing) && current;
  const podium = FINISHED.has(status);
  const side = pausing || firstUp || onLine || podium;

  return (
    <div className="flex flex-col gap-[clamp(1.25rem,3cqw,2rem)]">
      {prepared ? (
        <section className="flex flex-col gap-[clamp(0.875rem,2cqw,1.25rem)] pb-[clamp(0.5rem,2cqw,1rem)] pt-[clamp(0.5rem,3cqw,2.5rem)]">
          <span className="self-start rounded-pill bg-yellow px-4 py-1.5 text-[clamp(1rem,1.6cqw,1.375rem)] font-bold">Welkom</span>
          <h1 className="text-balance text-[clamp(3.5rem,12cqw,9.5rem)] font-semibold leading-[0.88] tracking-[-0.05em]">{comp.name}</h1>
          <span className="text-pretty text-[clamp(1.125rem,2.2cqw,1.75rem)] text-muted">
            <span className="max-md:hidden">
              {[capitalize(formatLongDay(comp.date)), comp.location, shooters ? `${shooters} schutters ingeschreven` : null].filter(Boolean).join(" · ")}
            </span>
            <span className="md:hidden">{[capitalize(formatCompactDate(comp.date)), shooters ? `${shooters} schutters` : null].filter(Boolean).join(" · ")}</span>
          </span>
          <p className="mt-1 max-w-[36rem] text-pretty leading-[1.45] text-muted max-md:hidden">
            De wedstrijd is nog niet begonnen. Deze pagina wordt automatisch live zodra de eerste schutters aan de lijn staan.
          </p>
        </section>
      ) : (
        <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
          <div className="flex min-w-0 flex-[1_1_26rem] flex-col gap-3.5">
            {isLive ? (
              <span className="inline-flex items-center gap-2 self-start rounded-pill bg-yellow px-3.5 py-[0.3125rem] text-[clamp(0.9375rem,1.4cqw,1.0625rem)] font-bold">
                <span className="size-2 rounded-full bg-ink" />
                Live · {LIVE_PHASE[status]}
              </span>
            ) : (
              <span className="self-start rounded-pill bg-ink px-3.5 py-[0.3125rem] text-[clamp(0.9375rem,1.4cqw,1.0625rem)] font-bold text-white">Uitslag</span>
            )}
            <h1 className="text-balance text-[clamp(2.875rem,8cqw,6rem)] font-semibold leading-[0.9] tracking-[-0.045em]">{comp.name}</h1>
            <span className="text-[clamp(1rem,1.6cqw,1.25rem)] text-muted">
              <span className="max-md:hidden">
                {[capitalize(formatLongDate(comp.date)), comp.location, shooters ? `${shooters} schutters` : null].filter(Boolean).join(" · ")}
              </span>
              {shooters > 0 && <span className="md:hidden">{shooters} schutters</span>}
            </span>
          </div>
          {(isLive || view.progress.done > 0) && !!view.progress.heatRounds?.length && (
            <div className="flex max-w-[30rem] flex-[1_1_18rem] flex-col gap-2.5">
              <HeatProgress
                variant="web"
                rounds={view.progress.heatRounds}
                current={view.progress.heatIndex ?? null}
                endLabel={view.progress.endLabel}
                aside={polling && view.updatedAt ? <Updated at={view.updatedAt} stale={stale} narrow /> : null}
              />
              {polling && view.updatedAt && <Updated at={view.updatedAt} stale={stale} />}
            </div>
          )}
        </div>
      )}

      {onLine && current && <LineHero current={current} />}

      <div className="flex flex-wrap items-start gap-[clamp(1rem,2.5cqw,1.5rem)]">
        {side && (
          <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-[clamp(1rem,2.5cqw,1.5rem)]">
            {pausing && <Countdown view={view} />}
            {podium && <Podium ranks={view.ranks} />}
            {onLine && <Next next={view.next} />}
            {firstUp && <FirstUp current={firstUp} />}
          </div>
        )}
        {view.ranks.length > 0 && <Standings view={view} isLive={isLive} onLine={onLine} />}
      </div>
    </div>
  );
}

/** "Bijgewerkt om 14:32" under the progress bar; on a phone "14:32" (or "Offline") in its label row. */
function Updated({ at, stale, narrow = false }: { at: string; stale: boolean; narrow?: boolean }) {
  const time = clock.format(new Date(at));
  return (
    <span
      className={`flex items-center gap-1.5 ${narrow ? "md:hidden" : "justify-end text-sm max-md:hidden"} ${stale ? "text-error" : "text-muted"}`}
    >
      <span className={`size-[0.4375rem] rounded-full ${stale ? "bg-error" : "bg-good"}`} />
      {stale ? (narrow ? "Offline" : "Verbinding verloren, opnieuw proberen…") : narrow ? time : `Bijgewerkt om ${time}`}
    </span>
  );
}
