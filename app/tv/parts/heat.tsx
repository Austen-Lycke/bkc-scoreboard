import type { ReactNode } from "react";
import {
  entriesOfGroup,
  entryShortName,
  entryTotal,
  groupName,
  knockoutRounds,
  passColumns,
  passOf,
  roundTitle,
  setupFor,
  standingsFor,
  tvName,
  type CompetitionState,
} from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import { achievableScores, passKey, scorePass, type Heat, type Setup } from "@/lib/scoring";
import { Gap } from "./frame";
import { TV_HIT, TV_OPEN, TvPlates } from "./plates";
import { TvSeriesTimer } from "./timer";

/** "Lotte D. & Mathis C.", or "14 schutters" for a WSA line. */
export const heatNames = (state: CompetitionState, heat: Heat) =>
  heat.shooters.length > 2 ? `${heat.shooters.length} schutters` : heat.shooters.map((e) => tvName(state, e)).join(" & ");
export const heatMeta = (state: CompetitionState, heat: Heat) => `${roundTitle(state, heat.round)} · ${groupName(state, heat.groupCode)}`;

export function LiveHeat({
  state,
  live,
  schedule,
  heatIndex,
  phaseIndex,
}: {
  state: CompetitionState;
  live: LiveRecord | undefined;
  schedule: Heat[];
  heatIndex: number;
  phaseIndex: number;
}) {
  const heat = schedule[heatIndex];
  const phase = heat.phases[phaseIndex];
  const knockdowns = state.format.lanes;
  const setup = setupFor(state, heat.groupCode, heat.round);
  const heatsInRank = schedule.filter((h) => h.round === heat.round && h.groupCode === heat.groupCode).length;
  const next = schedule[heatIndex + 1];
  const hitsOf = (entryId: string, kd: number) => live?.drafts[passKey(entryId, heat.round, kd)] ?? passOf(state, entryId, heat.round, kd)?.hits ?? [];
  const liveTotal = (entryId: string, kd: number) =>
    entryTotal(state, entryId) - (passOf(state, entryId, heat.round, kd)?.score ?? 0) + scorePass(setup, hitsOf(entryId, kd));
  const columns = Array.from({ length: knockdowns }, () => "minmax(0,1fr)").join(" 0.125rem ");

  return (
    <>
      <section className="flex flex-none flex-col gap-5 rounded-[2.75rem] bg-ink px-16 pb-10 pt-9 text-white">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold text-ink">Nu aan de lijn</span>
          <span className="text-[2.125rem] text-white/60">
            {heatMeta(state, heat)} · beurt {heat.index + 1}/{heatsInRank}
            {phaseIndex > 0 && state.format.rotate ? " · gewisseld" : ""}
          </span>
        </div>
        <div className="grid gap-14" style={{ gridTemplateColumns: columns }}>
          {Array.from({ length: knockdowns }, (_, i) => i + 1).flatMap((kd) => {
            const a = phase.find((s) => s.knockdown === kd);
            const divider = kd > 1 ? [<span key={`d${kd}`} className="bg-white/12" />] : [];
            if (!a) {
              return [
                ...divider,
                <div key={kd} className="flex min-w-0 flex-col gap-4">
                  <div className="text-[1.875rem] text-white/50">Knockdown {kd}</div>
                  <div className="text-[3.5rem] font-semibold text-white/50">vrij in deze fase</div>
                </div>,
              ];
            }
            const hits = hitsOf(a.entryId, kd);
            return [
              ...divider,
              <div key={kd} className="flex min-w-0 flex-col gap-4">
                <div className="min-w-0">
                  <div className="text-[1.875rem] text-white/50">Knockdown {kd}</div>
                  <div className="truncate text-[5.5rem] font-semibold leading-[1.02] tracking-[-0.03em]">{tvName(state, a.entryId)}</div>
                </div>
                <div className="flex items-end justify-between gap-8">
                  <TvPlates setup={setup} scale={0.62} gap="0.875rem" look={(id) => (hits.includes(id) ? TV_HIT : TV_OPEN)} />
                  <div className="text-right">
                    <div className="text-[8.25rem] font-semibold leading-[0.8] tracking-[-0.04em] text-yellow tabular-nums">{scorePass(setup, hits)}</div>
                    <div className="mt-[1.125rem] text-[1.875rem] text-white/60">totaal {liveTotal(a.entryId, kd)}</div>
                  </div>
                </div>
              </div>,
            ];
          })}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[37.5rem_minmax(0,1fr)] gap-8">
        <section className="flex flex-col gap-[0.875rem] rounded-[2.25rem] border-[0.1875rem] border-border bg-surface px-11 py-10">
          <span className="text-[1.875rem] font-semibold text-muted">Hierna klaarmaken</span>
          {next ? (
            <>
              {next.shooters.length > 2 ? (
                <span className="line-clamp-4 text-[2.25rem] font-semibold leading-[1.2]">{next.shooters.map((e) => entryShortName(state, e)).join(", ")}</span>
              ) : (
                next.shooters.map((e) => (
                  <span key={e} className="truncate text-[4rem] font-semibold leading-[1.05] tracking-[-0.02em]">
                    {tvName(state, e)}
                  </span>
                ))
              )}
              <span className="mt-auto text-[1.75rem] text-muted">
                {heatMeta(state, next)} · beurt {next.index + 1}
                {next.shooters.length === 1 && knockdowns > 1 && state.format.rotate
                  ? ` · alleen op KD ${Array.from({ length: knockdowns }, (_, k) => k + 1).join(" en ")}`
                  : ""}
              </span>
            </>
          ) : (
            <span className="text-[3rem] font-semibold text-muted">Dit is de laatste beurt</span>
          )}
        </section>
        <LiveStandings state={state} heat={heat} phase={phase} hitsOf={hitsOf} setup={setup} />
      </div>
    </>
  );
}

/** The shooting rank: the top two and the shooters on the line, with the others folded away. */
function LiveStandings({
  state,
  heat,
  phase,
  hitsOf,
  setup,
}: {
  state: CompetitionState;
  heat: Heat;
  phase: Heat["phases"][number];
  hitsOf: (entryId: string, kd: number) => string[];
  setup: Setup;
}) {
  const cols = passColumns(state, heat.groupCode).map((c) => [c.round, c.knockdown] as const);
  const rows = standingsFor(state, heat.groupCode)
    .rows.filter((r) => !r.withdrawn)
    .map((r) => {
      const onLine = phase.find((s) => s.entryId === r.entryId);
      const passes = cols.map(([round, kd]) => {
        if (onLine && round === heat.round && kd === onLine.knockdown) return { state: "live" as const, score: scorePass(setup, hitsOf(r.entryId, kd)) };
        const p = passOf(state, r.entryId, round, kd);
        return p ? { state: "shot" as const, score: p.score } : { state: "open" as const, score: 0 };
      });
      return { entryId: r.entryId, live: !!onLine, passes, total: passes.reduce((n, p) => n + p.score, 0) };
    })
    .sort((a, b) => b.total - a.total);
  const ranked = rows.map((r) => ({ ...r, pos: 1 + rows.filter((x) => x.total > r.total).length }));
  let show = ranked.map((_, i) => i);
  if (ranked.length > 5) show = [...new Set([0, 1, ...ranked.flatMap((r, i) => (r.live ? [i] : []))])].sort((a, b) => a - b);

  const items: ReactNode[] = [];
  show.forEach((i, j) => {
    if (j > 0 && i > show[j - 1] + 1) items.push(<Gap key={`g${i}`} />);
    const r = ranked[i];
    items.push(
      <div key={r.entryId} className={`-mx-[1.125rem] flex items-center gap-6 rounded-[0.875rem] px-[1.125rem] py-0.5 leading-[1.2] ${r.live ? "bg-yellow-light" : ""}`}>
        <span className={`w-[3.25rem] text-[2.125rem] font-semibold tabular-nums ${r.live ? "text-ink" : "text-muted"}`}>{r.pos}</span>
        <span className={`min-w-0 flex-1 truncate text-[2.125rem] ${r.live ? "font-bold" : "font-medium"}`}>{tvName(state, r.entryId)}</span>
        <div className="flex gap-2">
          {r.passes.map((p, k) => (
            <span
              key={k}
              className="box-border size-4 rounded-full border-[0.15625rem]"
              style={{
                background: p.state === "live" ? "var(--yellow)" : p.state === "shot" ? "var(--ink)" : "transparent",
                borderColor: p.state === "open" ? "var(--plate)" : "var(--ink)",
              }}
            />
          ))}
        </div>
        <span className="w-[5.625rem] text-right text-[2.25rem] font-semibold tabular-nums">{r.total}</span>
      </div>,
    );
  });
  if (show.length && show[show.length - 1] < ranked.length - 1) items.push(<Gap key="end" text={`${ranked.length} schutters`} />);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[2.25rem] border-[0.1875rem] border-border bg-surface px-11 pb-6 pt-[1.625rem]">
      <div className="flex items-baseline justify-between pb-1">
        <span className="text-[1.875rem] font-semibold">Voorlopige stand · {groupName(state, heat.groupCode)}</span>
        <span className="text-[1.5rem] text-muted">passages</span>
      </div>
      <div className="flex flex-1 flex-col justify-between">{items}</div>
    </section>
  );
}

/**
 * A WSA line: up to 15 shooters, each on their own frame, with this heat's series scores as they're
 * typed from the cards (only scores the plates can make) and the series countdown.
 */
export function LiveLine({ state, live, schedule, heatIndex }: { state: CompetitionState; live: LiveRecord | undefined; schedule: Heat[]; heatIndex: number }) {
  const heat = schedule[heatIndex];
  const setup = setupFor(state, heat.groupCode, heat.round);
  const allowed = achievableScores(setup);
  const heatsInGroup = schedule.filter((h) => h.round === heat.round && h.groupCode === heat.groupCode).length;
  const next = schedule[heatIndex + 1];
  const spots = heat.phases[0];
  const scoreOf = (entryId: string, kd: number) => {
    const v = live?.draftScores?.[passKey(entryId, heat.round, kd)] ?? passOf(state, entryId, heat.round, kd)?.score;
    return v !== undefined && allowed.has(v) ? v : undefined;
  };
  const lineOf = (entryId: string) => heat.phases.map((ph) => scoreOf(entryId, ph.find((x) => x.entryId === entryId)!.knockdown));
  const savedLine = (entryId: string) => heat.phases.reduce((n, ph) => n + (passOf(state, entryId, heat.round, ph.find((x) => x.entryId === entryId)!.knockdown)?.score ?? 0), 0);
  const total = (entryId: string) => entryTotal(state, entryId) - savedLine(entryId) + lineOf(entryId).reduce<number>((n, v) => n + (v ?? 0), 0);
  const groupTotals = entriesOfGroup(state, heat.groupCode).map((e) => (heat.shooters.includes(e.entryId) ? total(e.entryId) : entryTotal(state, e.entryId)));
  const placeOf = (entryId: string) => 1 + groupTotals.filter((t) => t > total(entryId)).length;
  // In the final: who dropped out after the previous series.
  const { finalStart } = knockoutRounds(state);
  const before = finalStart !== null && heat.round > finalStart ? schedule.filter((h) => h.groupCode === heat.groupCode && h.round === heat.round - 1).flatMap((h) => h.shooters) : [];
  const dropped = before.filter((e) => !heat.shooters.includes(e));

  const big = spots.length <= 5;
  const cols = big ? Math.max(1, spots.length) : 5;
  const rows = Math.ceil(spots.length / cols);

  return (
    <>
      <section className="flex min-h-0 flex-1 flex-col gap-6 rounded-[2.75rem] bg-ink px-12 pb-10 pt-8 text-white">
        <div className="flex flex-none items-center justify-between gap-10">
          <div className="flex min-w-0 items-center gap-8">
            <span className="whitespace-nowrap rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold text-ink">Nu aan de lijn</span>
            <span className="truncate text-[2.125rem] text-white/60">
              {heatMeta(state, heat)}
              {heatsInGroup > 1 ? ` · beurt ${heat.index + 1}/${heatsInGroup}` : ""}
            </span>
          </div>
          {state.format.timing && <TvSeriesTimer state={state} live={live} heat={heat} />}
        </div>
        <div className="grid min-h-0 flex-1 gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }}>
          {spots.map((s) => {
            const line = lineOf(s.entryId);
            return (
              <div key={s.entryId} className={`flex min-h-0 min-w-0 flex-col justify-between rounded-[1.75rem] bg-white/[0.07] ${big ? "gap-4 px-9 py-8" : "gap-1.5 px-6 py-[1.125rem]"}`}>
                <div className="flex items-baseline justify-between text-white/50">
                  <span className={big ? "text-[2rem]" : "text-[1.375rem]"}>KD {s.lane}</span>
                  <span className={big ? "text-[1.875rem]" : "text-[1.375rem]"}>plaats {placeOf(s.entryId)}</span>
                </div>
                <div className={`truncate font-semibold tracking-[-0.02em] ${big ? "text-[3.5rem] leading-[1.05]" : "text-[2.125rem] leading-[1.1]"}`}>{tvName(state, s.entryId)}</div>
                <div className="flex items-end justify-between gap-4">
                  <span className={`tabular-nums text-white/70 ${big ? "text-[2.5rem]" : "text-[1.75rem]"}`}>{line.map((v) => (v === undefined ? "–" : v)).join(" · ")}</span>
                  <span className={`font-semibold leading-[0.85] tracking-[-0.04em] text-yellow tabular-nums ${big ? "text-[6.5rem]" : "text-[3.5rem]"}`}>{total(s.entryId)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="flex flex-none items-baseline gap-8 rounded-[2.25rem] border-[0.1875rem] border-border bg-surface px-11 py-6">
        {dropped.length > 0 ? (
          <>
            <span className="whitespace-nowrap text-[1.875rem] font-semibold text-muted">Viel af</span>
            <span className="min-w-0 flex-1 truncate text-[2.5rem] font-semibold">{dropped.map((e) => tvName(state, e)).join(" & ")}</span>
          </>
        ) : (
          <>
            <span className="whitespace-nowrap text-[1.875rem] font-semibold text-muted">Hierna klaarmaken</span>
            <span className="min-w-0 flex-1 truncate text-[2.5rem] font-semibold">
              {next ? (next.shooters.length > 2 ? next.shooters.map((e) => entryShortName(state, e)).join(", ") : next.shooters.map((e) => tvName(state, e)).join(" & ")) : "Dit is de laatste beurt"}
            </span>
          </>
        )}
        {next && <span className="whitespace-nowrap text-[1.75rem] text-muted">{heatMeta(state, next)}</span>}
      </div>
    </>
  );
}
