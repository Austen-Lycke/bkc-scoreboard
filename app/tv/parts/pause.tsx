import { expectedPasses, groupsInShootingOrder, standingsFor, tvName, type CompetitionState } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import { passKey, type Heat } from "@/lib/scoring";
import { formatClock, useNow } from "@/components/use-now";
import { FirstUpBar, FirstUpNames, Leader, Marquee, type FirstUp } from "./frame";
import { firstUpOf } from "./heat";

export function Pause({ state, live, schedule, heat }: { state: CompetitionState; live: LiveRecord | undefined; schedule: Heat[]; heat: Heat | null }) {
  const end = live?.pauseEndsAt ? Date.parse(live.pauseEndsAt) : null;
  const now = useNow(1000, end !== null);
  const left = end === null ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
  const nextRound = heat?.round ?? null;
  const { rounds } = state.snapshot.competition;
  const roundDone = (r: number) => schedule.filter((h) => h.round === r).every((h) => h.phases.flat().every((a) => state.passes.has(passKey(a.entryId, r, a.knockdown))));
  const doneRounds = Array.from({ length: rounds }, (_, i) => i + 1).filter(roundDone).length;
  const perRound = expectedPasses(state) / rounds;
  const first = heat && firstUpOf(state, heat);
  const ranks = groupsInShootingOrder(state).filter((r) => standingsFor(state, r.code).rows.some((x) => !x.withdrawn));

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[38rem_minmax(0,1fr)] gap-10">
      <div className="flex min-h-0 flex-col gap-8">
        <div className="flex flex-1 flex-col justify-center gap-5">
          <span className="self-start rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold">Pauze</span>
          {end !== null ? (
            <>
              <span className="text-[2.25rem] text-muted">
                {nextRound ? `Ronde ${nextRound} begint ${left > 0 ? "over" : "zo"}` : left > 0 ? "We gaan verder over" : "We gaan zo verder"}
              </span>
              <span className="text-[13.125rem] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums">{formatClock(left)}</span>
            </>
          ) : (
            <span className="text-[10.625rem] font-semibold leading-[0.95] tracking-[-0.04em]">Pauze</span>
          )}
        </div>
        {first && (
          <div className={`flex flex-none flex-col gap-4 rounded-[2.75rem] bg-ink text-white ${first.list ? "px-10 py-8" : "px-12 py-10"}`}>
            <span className="self-start rounded-full bg-yellow px-[1.375rem] py-1.5 text-[1.875rem] font-bold text-ink">Als eerste</span>
            {first.list ? (
              <FirstUpNames list={first.list} columns={first.list.length > 5 ? 2 : 1} short={first.list.length > 5} />
            ) : (
              <span className="text-balance text-[3.75rem] font-semibold leading-[1.05] tracking-[-0.03em]">{first.names}</span>
            )}
            <span className="text-[1.875rem] text-white/75">{first.meta}</span>
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[2.5rem] font-semibold tracking-[-0.02em]">{doneRounds > 0 ? `Voorlopige stand na ronde ${doneRounds}` : "Voorlopige stand"}</span>
          <span className="text-[1.625rem] text-muted">
            {doneRounds * perRound} van {rounds * perRound} {state.format.rotate ? "passages" : "reeksen"}
          </span>
        </div>
        <div
          className={`grid min-h-0 flex-1 gap-5 ${ranks.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
          style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(ranks.length / 2))}, minmax(0, 1fr))` }}
        >
          {ranks.map((rank) => {
            const rows = standingsFor(state, rank.code).rows.filter((r) => !r.withdrawn);
            return (
              <div key={rank.code} className="flex min-h-0 min-w-0 flex-col gap-1.5 rounded-[2rem] border-[0.1875rem] border-border bg-surface px-[1.875rem] pb-[1.125rem] pt-5">
                <span className="flex-none text-[2rem] font-semibold text-muted">{rank.name}</span>
                <Marquee>
                  {rows.map((r) => (
                    <div key={r.entryId} className="flex items-baseline gap-3 leading-[1.2]">
                      <span className={`w-12 flex-none text-[2.25rem] font-semibold tabular-nums ${r.position === 1 ? "text-ink" : "text-muted"}`}>{r.position ?? "–"}</span>
                      <span className={`min-w-0 truncate text-[2.25rem] ${r.position === 1 ? "font-bold" : "font-medium"}`}>{tvName(state, r.entryId)}</span>
                      <Leader />
                      <span className="flex-none text-[2.625rem] font-bold tabular-nums">{r.total}</span>
                    </div>
                  ))}
                </Marquee>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** The warmup countdown before a round of a timed (WSA) day: the clock in the middle, as big as it gets, with who shoots first. */
export function Warmup({ end, first }: { end: string; first: FirstUp | null }) {
  const endMs = Date.parse(end);
  const now = useNow(1000);
  const left = Math.max(0, Math.ceil((endMs - now) / 1000));
  // A line of two rows or more takes more of the screen.
  const tall = (first?.list?.length ?? 0) > 8;
  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
        {left > 0 ? (
          <span role="timer" className={`font-bold leading-[0.8] tracking-[-0.05em] tabular-nums ${tall ? "text-[27rem]" : "text-[33rem]"}`}>
            {formatClock(left)}
          </span>
        ) : (
          <span className="text-center text-[14rem] font-bold leading-[0.9] tracking-[-0.04em]">Opwarming voorbij</span>
        )}
      </div>
      {first && <FirstUpBar first={first} />}
    </>
  );
}
