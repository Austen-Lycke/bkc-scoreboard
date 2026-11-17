import type { CSSProperties, ReactNode } from "react";
import {
  entriesOfGroup,
  entryShortName,
  entryTotal,
  groupName,
  heatKey,
  knockoutRounds,
  passColumns,
  passOf,
  roundTitle,
  setupFor,
  stageOfRound,
  standingsFor,
  tvName,
  tvNameParts,
  type CompetitionState,
} from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import { passKey, scorePass, type Heat, type Setup } from "@/lib/scoring";
import { COND, Gap, slantLeft, slantRight, Ticker } from "./frame";
import { TV_HIT, TV_OPEN, TvPlates } from "./plates";
import { TvSeriesBox } from "./timer";

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

type Tier = { place: string; lane: string; score: string; total: string; num: string; name: string; sc: string; tot: string; mv: string; slot: string; gap: string; max: string; cut: string };

/** The rows of the WSA board grow as fewer shooters stand on the line. */
const TIERS: Record<"s" | "m" | "l", Tier> = {
  // 11–15 on the line.
  s: { place: "8.5rem", lane: "5rem", score: "6.5rem", total: "9.5rem", num: "text-[2rem]", name: "text-[2.25rem]", sc: "text-[1.875rem]", tot: "text-[2.625rem]", mv: "text-[1.125rem]", slot: "2.25rem", gap: "0.375rem", max: "100%", cut: "0.875rem" },
  // 6–10.
  m: { place: "10.5rem", lane: "6rem", score: "7rem", total: "11rem", num: "text-[2.875rem]", name: "text-[3.125rem]", sc: "text-[2.5rem]", tot: "text-[3.75rem]", mv: "text-[1.375rem]", slot: "2.75rem", gap: "0.625rem", max: "6.5rem", cut: "1.25rem" },
  // 5 or fewer: a final.
  l: { place: "12rem", lane: "7rem", score: "7.5rem", total: "13rem", num: "text-[4rem]", name: "text-[4rem]", sc: "text-[3.25rem]", tot: "text-[5.25rem]", mv: "text-[1.625rem]", slot: "3.25rem", gap: "1rem", max: "9.5rem", cut: "1.75rem" },
};

/** Places gained (▲) or lost (▼); nothing when the place stayed the same. */
function Move({ m, className }: { m: number; className: string }) {
  if (m === 0) return <span />;
  return (
    <span className={`font-semibold ${className}`} style={{ color: m > 0 ? "#6fd08f" : "#ff8a73" }}>
      {m > 0 ? "▲" : "▼"}
      {Math.abs(m)}
    </span>
  );
}

/**
 * A WSA line as a results board: the shooters on the line by place in their group, the place up
 * front (with the places won or lost by this beurt's saved cards), the frame, every series of the
 * stage and the total, plus the series countdown. The cards are typed after the beurt (the line may
 * already have moved on), so a series shows "–" until its card is saved.
 */
export function LiveLine({ state, live, schedule, heatIndex }: { state: CompetitionState; live: LiveRecord | undefined; schedule: Heat[]; heatIndex: number }) {
  const heat = schedule[heatIndex];
  const heatsInGroup = schedule.filter((h) => h.round === heat.round && h.groupCode === heat.groupCode).length;
  const next = schedule[heatIndex + 1];
  const spots = heat.phases[0];
  const z = TIERS[spots.length > 10 ? "s" : spots.length > 5 ? "m" : "l"];

  // The series of this stage: all of the qualification, or the knockout stage so far with what came
  // before it in one column.
  const stage = stageOfRound(state, heat.round) ?? "qualification";
  const all = passColumns(state, heat.groupCode);
  const cols = all.filter((c) => stageOfRound(state, c.round) === stage && (stage === "qualification" || c.round <= heat.round));
  const firstRound = Math.min(heat.round, ...cols.map((c) => c.round));
  const earlierCols = all.filter((c) => c.round < firstRound);
  const showEarlier = stage !== "qualification" && earlierCols.length > 0;
  const scoreAt = (entryId: string, round: number, kd: number) => passOf(state, entryId, round, kd)?.score;
  const earlier = (entryId: string) => earlierCols.reduce((n, c) => n + (scoreAt(entryId, c.round, c.knockdown) ?? 0), 0);

  // Places in the whole group, now and before this beurt's saved cards.
  const onLine = new Set(heat.shooters);
  const thisBeurt = (entryId: string) => heat.phases.reduce((n, ph) => n + (scoreAt(entryId, heat.round, ph.find((x) => x.entryId === entryId)?.knockdown ?? 0) ?? 0), 0);
  const group = entriesOfGroup(state, heat.groupCode).map((e) => {
    const total = entryTotal(state, e.entryId);
    return { entryId: e.entryId, total, before: total - (onLine.has(e.entryId) ? thisBeurt(e.entryId) : 0) };
  });
  const placeIn = (t: number, key: "total" | "before") => 1 + group.filter((g) => g[key] > t).length;
  // The first beurt of the day: everyone was first together before it, so no arrows yet.
  const ranked = group.some((g) => g.before > 0);
  const rows = spots
    .map((s) => {
      const total = entryTotal(state, s.entryId);
      const g = group.find((x) => x.entryId === s.entryId);
      const place = placeIn(total, "total");
      return { ...s, total, place, move: g && ranked ? placeIn(g.before, "before") - place : 0 };
    })
    .sort((a, b) => a.place - b.place || a.lane - b.lane);

  // In the final: who dropped out after the previous series.
  const { finalStart } = knockoutRounds(state);
  const before = finalStart !== null && heat.round > finalStart ? schedule.filter((h) => h.groupCode === heat.groupCode && h.round === heat.round - 1).flatMap((h) => h.shooters) : [];
  const dropped = before.filter((e) => !heat.shooters.includes(e));
  const nextMeta = next && (next.round !== heat.round || next.groupCode !== heat.groupCode) ? `${heatMeta(state, next)}: ` : "";

  const grid: CSSProperties = {
    gridTemplateColumns: [z.place, "minmax(0,1fr)", z.lane, ...(showEarlier ? [z.score] : []), ...cols.map(() => z.score), z.total].join(" "),
  };

  return (
    <section aria-label="Nu aan de lijn" className="flex min-h-0 flex-1 flex-col gap-5">
      <header className="flex h-[8.5rem] flex-none items-stretch gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-10 bg-ink pl-12 pr-24 text-white" style={slantRight("3rem")}>
          <span className={`${COND} text-[3.5rem] font-extrabold tracking-[0.04em] text-yellow`}>BKC</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={`${COND} truncate text-[4.5rem] font-bold uppercase leading-[0.9]`}>{heatMeta(state, heat)}</span>
            {heatsInGroup > 1 && (
              <span className="truncate text-[1.75rem] text-white/60">
                Beurt {heat.index + 1} van {heatsInGroup}
              </span>
            )}
          </div>
        </div>
        {state.format.timing && <TvSeriesBox state={state} live={live} heat={heat} />}
      </header>

      <div role="table" aria-label="Stand op de lijn" className="flex min-h-0 flex-1 flex-col justify-center" style={{ gap: z.gap }}>
        <div role="row" className="grid flex-none items-end pb-1 text-[1.25rem] font-semibold uppercase tracking-[0.2em] text-muted" style={grid}>
          <span role="columnheader" style={{ paddingLeft: `calc(1rem + ${z.slot})` }}>
            Plaats
          </span>
          <span role="columnheader" className="pl-6">
            Schutter
          </span>
          <span role="columnheader" className="text-center">
            KD
          </span>
          {showEarlier && (
            <span role="columnheader" className="text-center">
              {stage === "semifinal" ? "Kwal." : "Vooraf"}
            </span>
          )}
          {cols.map((c) => (
            <span key={`${c.round}-${c.knockdown}`} role="columnheader" className={`text-center ${c.round === heat.round ? "text-ink" : ""}`}>
              {c.sub ? `${c.head} · ${c.knockdown}` : c.head}
            </span>
          ))}
          <span role="columnheader" className="text-center text-ink">
            Totaal
          </span>
        </div>

        {rows.map((r) => {
          const { first, last } = tvNameParts(state, r.entryId);
          return (
            <div key={r.entryId} role="row" className="grid min-h-0 flex-1 items-stretch bg-surface leading-none shadow-[0_0.125rem_0_var(--border)]" style={{ ...grid, maxHeight: z.max }}>
              {/* The arrow in a slot of its own, so every place number starts on the same line. */}
              <span role="cell" className={`${COND} grid items-center bg-ink pl-4 font-bold text-yellow tabular-nums ${z.num}`} style={{ ...slantRight(z.cut), gridTemplateColumns: `${z.slot} 1fr` }}>
                <Move m={r.move} className={z.mv} />
                <span>{r.place}</span>
              </span>
              <span role="cell" className={`${COND} flex min-w-0 items-center pl-6 pr-4 ${z.name}`}>
                <span className="truncate">
                  <span className="font-bold uppercase">{first}</span> <span className="text-muted">{last}</span>
                </span>
              </span>
              <span role="cell" className={`${COND} flex items-center justify-center text-muted tabular-nums ${z.sc}`}>
                {r.lane}
              </span>
              {showEarlier && (
                <span role="cell" className={`${COND} flex items-center justify-center text-subtle tabular-nums ${z.sc}`}>
                  {earlier(r.entryId)}
                </span>
              )}
              {cols.map((c) => (
                <span key={`${c.round}-${c.knockdown}`} role="cell" className={`${COND} flex items-center justify-center tabular-nums ${z.sc} ${c.round === heat.round ? "font-semibold" : "text-subtle"}`}>
                  {scoreAt(r.entryId, c.round, c.knockdown) ?? "–"}
                </span>
              ))}
              <span role="cell" className={`${COND} flex items-center justify-center bg-yellow pl-3 font-bold tabular-nums ${z.tot}`} style={slantLeft(z.cut)}>
                {r.total}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="flex h-[4.75rem] flex-none items-center gap-8 bg-ink pl-10 pr-16 text-white" style={slantRight("2rem")}>
        <span className={`${COND} whitespace-nowrap text-[2.25rem] font-bold uppercase text-yellow`}>{dropped.length > 0 ? "Viel af" : next ? "Hierna klaarmaken" : "Hierna"}</span>
        {dropped.length > 0 || next ? (
          <Ticker key={heatKey(heat)} className="flex-1 text-[1.875rem] text-white/80">
            {dropped.length > 0 ? dropped.map((e) => tvName(state, e)).join(" · ") : nextMeta + next!.shooters.map((e) => tvName(state, e)).join(" · ")}
          </Ticker>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[1.875rem] text-white/80">Dit is de laatste beurt</span>
        )}
      </footer>
    </section>
  );
}
