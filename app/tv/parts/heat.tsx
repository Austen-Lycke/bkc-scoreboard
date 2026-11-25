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
import { COND, Gap, Leader, slantLeft, slantRight, Ticker, type FirstUp } from "./frame";
import { TV_HIT, TV_OPEN, TvPlates } from "./plates";
import { TvSeriesBox } from "./timer";

export const heatMeta = (state: CompetitionState, heat: Heat) => `${roundTitle(state, heat.round)} · ${groupName(state, heat.groupCode)}`;

/** Who shoots a heat: "Lotte D. & Mathis C.", or the whole WSA line by frame. */
export const firstUpOf = (state: CompetitionState, heat: Heat): FirstUp => ({
  names: heat.shooters.map((e) => tvName(state, e)).join(" & "),
  list: heat.shooters.length > 2 || !state.format.rotate ? heat.phases[0].map((s) => ({ lane: s.lane, name: tvName(state, s.entryId), short: entryShortName(state, s.entryId) })).sort((x, y) => x.lane - y.lane) : null,
  meta: heatMeta(state, heat),
});

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
        <span className={`min-w-0 truncate text-[2.125rem] ${r.live ? "font-bold" : "font-medium"}`}>{tvName(state, r.entryId)}</span>
        <Leader />
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

const rem = (n: number) => `${Math.round(n * 1000) / 1000}rem`;

/**
 * The sizes of the WSA board, in rem, from how many stand on the line: the rows share the height there
 * is, and the type fills its row, so it reads from as far as the screen allows.
 */
function boardSizes(rows: number) {
  const gap = rows > 10 ? 0.3125 : rows > 5 ? 0.5 : 1;
  const row = Math.min(11, 49 / Math.max(rows, 3) - gap);
  // A row of 3rem holds type of 3rem (digits and capitals are lower than that); a tall one gets air.
  const name = Math.min(5.5, row * 0.55 + 1.4);
  const score = Math.min(4.75, name * 0.92);
  return {
    gap: rem(gap),
    max: rem(row),
    name: rem(name),
    score: rem(score),
    total: rem(Math.min(7, name * 1.22)),
    move: rem(name * 0.5),
    slot: rem(name * 1.15),
    placeCol: rem(name * 3.4),
    laneCol: rem(Math.max(4.5, name * 1.5)),
    scoreCol: rem(Math.max(6.25, score * 1.85)),
    totalCol: rem(Math.max(10, name * 2.9)),
    cut: rem(Math.max(0.75, row * 0.18)),
  };
}

/** Places gained (▲) or lost (▼); nothing when the place stayed the same. */
function Move({ m, size }: { m: number; size: string }) {
  if (m === 0) return <span />;
  return (
    <span className="font-semibold" style={{ fontSize: size, color: m > 0 ? "#6fd08f" : "#ff8a73" }}>
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
  const z = boardSizes(spots.length);

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
    gridTemplateColumns: [z.placeCol, "minmax(0,1fr)", z.laneCol, ...(showEarlier ? [z.scoreCol] : []), ...cols.map(() => z.scoreCol), z.totalCol].join(" "),
  };

  return (
    <section aria-label="Nu aan de lijn" className="-mx-12 -mb-9 -mt-7 flex min-h-0 flex-1 flex-col gap-3">
      <header className="flex h-[8rem] flex-none items-stretch gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-10 bg-ink pl-12 pr-24 text-white" style={slantRight("3rem")}>
          <span className={`${COND} text-[3.5rem] font-extrabold tracking-[0.04em] text-yellow`}>BKC</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={`${COND} truncate text-[4.5rem] font-bold uppercase leading-[0.9]`}>{heatMeta(state, heat)}</span>
            {heatsInGroup > 1 && (
              <span className="truncate text-[2rem] text-white/75">
                Beurt {heat.index + 1} van {heatsInGroup}
              </span>
            )}
          </div>
        </div>
        {state.format.timing && <TvSeriesBox state={state} live={live} heat={heat} />}
      </header>

      <div role="table" aria-label="Stand op de lijn" className="flex min-h-0 flex-1 flex-col justify-center" style={{ gap: z.gap }}>
        <div role="row" className="grid flex-none items-end text-[1.625rem] font-semibold uppercase leading-[1.2] tracking-[0.06em] text-muted" style={grid}>
          <span role="columnheader" style={{ paddingLeft: z.slot }}>
            Pl.
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
            <div key={r.entryId} role="row" className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] items-stretch bg-surface leading-none shadow-[0_0.125rem_0_var(--border)]" style={{ ...grid, maxHeight: z.max }}>
              {/* The arrow in a slot of its own, so every place number starts on the same line. */}
              <span
                role="cell"
                className={`${COND} grid items-center bg-ink pl-4 font-bold text-yellow tabular-nums`}
                style={{ ...slantRight(z.cut), fontSize: z.name, gridTemplateColumns: `${z.slot} 1fr` }}
              >
                <Move m={r.move} size={z.move} />
                <span>{r.place}</span>
              </span>
              <span role="cell" className={`${COND} flex min-w-0 items-center gap-6 pl-6 pr-2`} style={{ fontSize: z.name }}>
                <span className="truncate leading-[1.15]">
                  <span className="font-extrabold uppercase">{first}</span> <span className="font-medium">{last}</span>
                </span>
                <Leader />
              </span>
              <span role="cell" className={`${COND} flex items-center justify-center font-medium text-muted tabular-nums`} style={{ fontSize: z.score }}>
                {r.lane}
              </span>
              {showEarlier && (
                <span role="cell" className={`${COND} flex items-center justify-center font-medium text-muted tabular-nums`} style={{ fontSize: z.score }}>
                  {earlier(r.entryId)}
                </span>
              )}
              {cols.map((c) => (
                <span
                  key={`${c.round}-${c.knockdown}`}
                  role="cell"
                  className={`${COND} flex items-center justify-center tabular-nums ${c.round === heat.round ? "font-bold" : "font-medium text-muted"}`}
                  style={{ fontSize: z.score }}
                >
                  {scoreAt(r.entryId, c.round, c.knockdown) ?? "–"}
                </span>
              ))}
              <span role="cell" className={`${COND} flex items-center justify-center bg-yellow pl-3 font-extrabold tabular-nums`} style={{ ...slantLeft(z.cut), fontSize: z.total }}>
                {r.total}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="flex h-[5rem] flex-none items-center gap-8 bg-ink pl-10 pr-16 text-white" style={slantRight("2rem")}>
        <span className={`${COND} whitespace-nowrap text-[2.5rem] font-bold uppercase text-yellow`}>{dropped.length > 0 ? "Viel af" : next ? "Hierna klaarmaken" : "Hierna"}</span>
        {dropped.length > 0 || next ? (
          <Ticker key={heatKey(heat)} className="flex-1 text-[2.5rem] font-medium text-white">
            {dropped.length > 0 ? dropped.map((e) => tvName(state, e)).join(" · ") : nextMeta + next!.shooters.map((e) => tvName(state, e)).join(" · ")}
          </Ticker>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[2.5rem] text-white">Dit is de laatste beurt</span>
        )}
      </footer>
    </section>
  );
}
