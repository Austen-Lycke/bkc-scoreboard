"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeatProgress } from "@/components/heat-progress";
import { CLUB_TIME_ZONE, formatLongDate, LIVE, STATUS_LABEL } from "@/components/public/format";
import type { PublicRank, PublicView } from "@/lib/competition";

const POLL_MS = 5000;
const clock = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });
const TIE: Record<string, string | null> = { none: null, resolved: "na afkamping", shared: "gelijk", pending: "afkamping" };

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
  const isLive = LIVE.has(comp.status);
  const [rankTab, setRankTab] = useState<string | null>(null);
  const selectedRank = view.ranks.find((r) => r.code === rankTab) ?? view.ranks.find((r) => r.name === current?.rankName) ?? view.ranks[0];
  const shooters = view.ranks.reduce((n, r) => n + r.rows.filter((x) => !x.withdrawn).length, 0);
  const meta = [formatLongDate(comp.date), comp.location, shooters ? `${shooters} schutters` : null].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
        <div className="flex min-w-0 flex-col gap-2">
          {isLive ? (
            <span className="flex items-center gap-2 self-start rounded-full bg-yellow px-3 py-1 text-sm font-bold">
              <span className="size-2 rounded-full bg-ink" />
              Live{comp.status === "break" ? " · pauze" : comp.status === "warmup" ? " · opwarming" : comp.status === "shootoff" ? " · afkamping" : ""}
            </span>
          ) : (
            <span className="self-start rounded-full bg-fill px-3 py-1 text-sm font-bold">{STATUS_LABEL[comp.status] ?? comp.status}</span>
          )}
          <h1 className="text-[clamp(2.25rem,6vw,3.5rem)] font-semibold leading-none tracking-[-0.03em]">{comp.name}</h1>
          <span className="text-base text-muted first-letter:uppercase">{meta}</span>
        </div>
        {(isLive || view.progress.done > 0) && !!view.progress.heatRounds?.length && (
          <div className="flex max-w-[27.5rem] flex-[1_1_17.5rem] flex-col gap-2">
            <HeatProgress variant="web" rounds={view.progress.heatRounds} current={view.progress.heatIndex ?? null} />
            {polling && view.updatedAt && (
              <span className="text-right text-[0.8125rem] text-subtle">
                {stale ? "Verbinding verloren, opnieuw proberen…" : `Bijgewerkt om ${clock.format(new Date(view.updatedAt))}`}
              </span>
            )}
          </div>
        )}
      </div>

      {comp.status === "prepared" && (
        <p className="rounded-3xl border-[0.09375rem] border-dashed border-plate bg-surface p-6 text-muted">
          De wedstrijd is nog niet begonnen. Deze pagina wordt automatisch live zodra de eerste schutters aan de lijn staan.
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,27.5rem),1fr))] items-start gap-6">
        {isLive && current && (
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-5 rounded-3xl bg-ink px-7 pb-7 pt-6 text-white">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <span className="rounded-full bg-yellow px-3.5 py-1 text-base font-bold text-ink">
                  {comp.status === "break" ? "Na de pauze" : comp.status === "warmup" ? "Als eerste" : "Nu aan de lijn"}
                </span>
                <span className="text-sm text-white/60">
                  Ronde {current.round} · {current.rankName} · beurt {current.heatNumber}/{current.heatsInRank}
                  {current.swapped ? " · gewisseld" : ""}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-8">
                {current.shooters.map((s) => (
                  <div key={s.shooterId} className="flex min-w-0 flex-col gap-3.5">
                    <div className="min-w-0">
                      <div className="text-sm text-white/50">Knockdown {s.knockdown}</div>
                      <div className="truncate text-lg font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[1.75rem]">{s.name}</div>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="text-[2.5rem] font-semibold leading-[0.9] tracking-[-0.04em] text-yellow tabular-nums sm:text-[3.5rem]">{s.total}</span>
                      <span className="whitespace-nowrap text-[0.9375rem] text-white/60">totaal{s.position ? ` · plaats ${s.position}` : ""}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section className="flex flex-col gap-3.5 rounded-3xl border border-border bg-surface px-7 py-[1.375rem]">
              <span className="text-[0.9375rem] font-semibold text-muted">Hierna</span>
              {view.next.length === 0 && <span className="text-[1.0625rem] text-muted">Laatste beurt van de wedstrijd.</span>}
              {view.next.map((h, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 ${i === 0 ? "" : "border-t border-[#f0f0ec] pt-3"}`}
                >
                  <span className={`font-semibold tracking-[-0.01em] ${i === 0 ? "text-2xl" : "text-[1.0625rem]"}`}>{h.names.join(" & ")}</span>
                  <span className="text-sm text-muted">
                    Ronde {h.round} · {h.rankName} · beurt {h.heatNumber}
                  </span>
                </div>
              ))}
            </section>
          </div>
        )}

        {view.ranks.length > 0 && selectedRank && (
          <section className="flex min-w-0 flex-col gap-4 rounded-3xl border border-border bg-surface px-7 pb-6 pt-[1.375rem]">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-[1.375rem] font-semibold tracking-[-0.01em]">{isLive ? "Voorlopige stand" : "Uitslag"}</h2>
              <span className="text-[0.8125rem] text-subtle">{view.passLabels.length} passages per schutter</span>
            </div>
            <div
              className="sticky top-0 z-[2] -mx-7 flex flex-nowrap gap-1.5 overflow-x-auto bg-surface px-7 py-2.5 [scrollbar-width:none] sm:static sm:mx-0 sm:flex-wrap sm:px-0 sm:py-0"
              role="tablist"
            >
              {view.ranks.map((r) => {
                const on = r.code === selectedRank.code;
                const shooting = isLive && r.name === current?.rankName;
                return (
                  <button
                    key={r.code}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setRankTab(r.code)}
                    className={`flex min-h-11 flex-none cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-[0.4375rem] text-sm font-semibold sm:min-h-0 ${
                      on ? "border-ink bg-ink text-white" : "border-border bg-surface hover:border-ink"
                    }`}
                  >
                    {r.name}
                    {shooting && <span className={`size-[0.4375rem] rounded-full ${on ? "bg-yellow" : "bg-live"}`} />}
                  </button>
                );
              })}
            </div>
            <RankList rank={selectedRank} view={view} isLive={isLive} />
          </section>
        )}
      </div>
    </div>
  );
}

function RankList({ rank, view, isLive }: { rank: PublicRank; view: PublicView; isLive: boolean }) {
  const current = isLive ? view.current : null;
  const nextIds = isLive ? (view.next[0]?.shooterIds ?? []) : [];
  const livePass = (shooterId: string) => {
    const s = current?.shooters.find((x) => x.shooterId === shooterId);
    return s ? view.passLabels.indexOf(`R${current!.round} KD${s.knockdown}`) : -1;
  };
  const scrollable = rank.rows.length > 9;
  const fade = scrollable ? "sm:[mask-image:linear-gradient(#000_0,#000_calc(100%-2.5rem),transparent)]" : "";

  return (
    <>
      <div className="-mb-2.5 flex justify-between text-xs text-subtle">
        <span>{rank.rows.filter((r) => !r.withdrawn).length} schutters</span>
        {scrollable && <span className="hidden sm:inline">scroll voor de volledige stand</span>}
      </div>
      <div className={`-mx-3 flex flex-col overscroll-contain px-3 ${scrollable ? "sm:max-h-[min(35rem,62vh)] sm:overflow-y-auto" : ""} ${fade}`}>
        {rank.rows.map((row) => {
          const now = livePass(row.shooterId);
          const onLine = now >= 0;
          const tag = onLine ? "Nu aan de lijn" : nextIds.includes(row.shooterId) ? "Hierna" : row.withdrawn ? "afgehaakt" : TIE[row.tie];
          const strong = onLine || row.position === 1;
          return (
            <div
              key={row.shooterId}
              className={`-mx-3 flex items-center gap-3.5 rounded-xl border-b border-[#f0f0ec] px-3 py-2.5 ${onLine ? "bg-yellow-light" : ""} ${row.withdrawn ? "text-faint" : ""}`}
            >
              <span className={`w-6 text-base font-semibold tabular-nums ${strong ? "text-ink" : "text-subtle"}`}>{row.position ?? "–"}</span>
              <div className="flex min-w-0 flex-1 flex-col gap-[0.0625rem]">
                <Link href={`/schutter/${row.shooterId}`} className={`truncate text-[1.0625rem] hover:underline ${strong ? "font-bold" : "font-medium"}`}>
                  {row.name}
                </Link>
                {tag && <span className="text-xs font-semibold text-muted">{tag}</span>}
              </div>
              <div className="flex gap-[0.3125rem]">
                {row.passes.map((p, i) => (
                  <span
                    key={i}
                    title={`${view.passLabels[i]}${p === null ? "" : `: ${p}`}`}
                    className="box-border size-2.5 rounded-full border-2"
                    style={{
                      background: i === now ? "var(--yellow)" : p === null ? "transparent" : "var(--ink)",
                      borderColor: i === now || p !== null ? "var(--ink)" : "var(--plate)",
                    }}
                  />
                ))}
              </div>
              <span className="w-10 text-right text-lg font-semibold tabular-nums">{row.total}</span>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-[1.125rem] gap-y-1.5 text-xs text-subtle">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-ink" />
          geschoten
        </span>
        {isLive && (
          <span className="flex items-center gap-1.5">
            <span className="box-border size-2.5 rounded-full border-2 border-ink bg-yellow" />
            nu bezig
          </span>
        )}
        <span className="flex items-center gap-1.5">
          <span className="box-border size-2.5 rounded-full border-2 border-plate" />
          nog te schieten
        </span>
      </div>
    </>
  );
}
