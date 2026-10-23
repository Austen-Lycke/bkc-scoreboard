import { entryShortName, entryTotal, groupName, pendingShootoffs, setupFor, standingsFor, tvName, type CompetitionState } from "@/lib/competition";
import type { ShootoffDraft } from "@/lib/offline/db";
import { iterationScore } from "@/lib/scoring";
import { Centered } from "./frame";
import { FitPlates } from "./plates";

/**
 * Names on the afkamping cards. `short` (narrow cards): "Pieter D.", unless two of them would read
 * the same; then those keep their TV name.
 */
function shootoffNames(state: CompetitionState, participants: string[], short: boolean): Map<string, string> {
  const shortNames = participants.map((p) => entryShortName(state, p));
  return new Map(
    participants.map((p, i) => [p, short && shortNames.indexOf(shortNames[i]) === shortNames.lastIndexOf(shortNames[i]) ? shortNames[i] : tvName(state, p)]),
  );
}

export function ShootoffWaiting({ state }: { state: CompetitionState }) {
  const next = pendingShootoffs(state)[0];
  if (!next) return <Centered kicker="Afkamping" title="Alle gelijke standen zijn beslecht" />;
  const group = next.groups[0];
  const position = standingsFor(state, next.groupCode).rows.find((r) => r.entryId === group[0])?.position;
  return (
    <Centered
      kicker="Afkamping"
      title={groupName(state, next.groupCode)}
      bar={{
        label: next.stage ? "Gelijk op de grens" : "Gelijke stand",
        names: group.map((e) => tvName(state, e)).join(" & "),
        meta: `${entryTotal(state, group[0])} punten${next.stage ? " · wie mag verder?" : position ? ` · plaats ${position}` : ""}`,
      }}
    />
  );
}

export function ShootoffLive({ state, draft }: { state: CompetitionState; draft: ShootoffDraft }) {
  const setup = setupFor(state, draft.rankCode, state.snapshot.competition.rounds);
  const label = (id: string) => setup.targets.find((t) => t.id === id)?.label ?? id;
  const last = draft.calls.length - 1;
  const lastId = last >= 0 ? draft.calls[last].targetId : null;
  const iteration = {
    participants: draft.participants,
    calls: draft.calls,
    results: Object.fromEntries(draft.participants.map((p) => [p, draft.results[p].map(Boolean)])),
  };
  // Up to five tied shooters side by side; more go on two rows, with the plates beside the score.
  const n = draft.participants.length;
  const twoRows = n > 5;
  const cols = twoRows ? Math.ceil(n / 2) : n;
  const look =
    n <= 2
      ? { card: "gap-5 px-14 py-11", name: "4.5rem", score: "9.375rem" }
      : n === 3
        ? { card: "gap-5 px-14 py-11", name: "3.5rem", score: "9.375rem" }
        : !twoRows
          ? { card: "gap-5 px-8 py-9", name: "3rem", score: "7rem" }
          : { card: "gap-3 px-8 py-6", name: "2.75rem", score: "6rem" };
  const names = shootoffNames(state, draft.participants, n > 3);

  return (
    <>
      <div className="flex flex-none items-end justify-between gap-10">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold">Afkamping · {groupName(state, draft.rankCode)}</span>
          <span className="text-[6.875rem] font-semibold leading-[0.95] tracking-[-0.04em]">{lastId ? `Geroepen: ${label(lastId)}` : "Wachten op het eerste doel"}</span>
        </div>
        <div className="flex flex-col items-end gap-[0.875rem]">
          <span className="text-[1.875rem] text-muted">
            {draft.calls.length} van {setup.targets.length} doelen geroepen
          </span>
          <div className="flex gap-2.5">
            {draft.calls.map((c, i) => (
              <span key={c.targetId} className={`rounded-full px-[1.125rem] py-1.5 text-[1.625rem] font-semibold ${i === last ? "bg-yellow" : "bg-fill"}`}>
                {label(c.targetId)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div
        className="grid min-h-0 flex-1 gap-8"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${twoRows ? 2 : 1}, minmax(0, 1fr))` }}
      >
        {draft.participants.map((p) => {
          const result = lastId ? draft.results[p][last] : null;
          const plates = (
            <FitPlates
              setup={setup}
              scale={0.9}
              look={(id) => {
                const i = draft.calls.findIndex((c) => c.targetId === id);
                const called = i >= 0;
                const hit = called && draft.results[p][i] === true;
                const isLast = id === lastId;
                return {
                  background: hit ? "var(--yellow)" : "transparent",
                  color: hit ? "var(--ink)" : called ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.35)",
                  borderColor: isLast || hit ? "var(--yellow)" : called ? "rgba(255,255,255,.45)" : "rgba(255,255,255,.25)",
                  // 0.4375rem and 0.1875rem at full size, thinner when the plates shrink.
                  borderWidth: isLast ? "calc(var(--mm) * 7.8)" : "calc(var(--mm) * 3.3)",
                };
              }}
            />
          );
          const score = (
            <div className="flex flex-none flex-wrap items-baseline justify-center gap-x-6 gap-y-2 self-center">
              <span className="font-semibold leading-[0.8] tracking-[-0.04em] text-yellow tabular-nums" style={{ fontSize: look.score }}>
                {iterationScore(iteration, p)}
              </span>
              {lastId && result !== null && <span className="text-[1.875rem] text-white/60">{`Doel ${label(lastId)}: ${result ? "raak" : "mis"}`}</span>}
            </div>
          );
          return (
            <section key={p} className={`flex min-h-0 min-w-0 flex-col items-center rounded-[2.75rem] bg-ink text-white ${look.card}`}>
              <span className="line-clamp-2 max-w-full text-balance text-center font-semibold leading-[1.05] tracking-[-0.03em]" style={{ fontSize: look.name }}>
                {names.get(p)}
              </span>
              {twoRows ? (
                // Stretched, not centred: the plates' box takes its height from this row.
                <div className="flex min-h-0 w-full flex-1 gap-8">
                  {plates}
                  {score}
                </div>
              ) : (
                <>
                  {plates}
                  {score}
                </>
              )}
            </section>
          );
        })}
      </div>
      <div className="flex flex-none gap-9 text-[1.625rem] text-muted">
        <span className="flex items-center gap-3">
          <span className="size-[1.375rem] rounded-full bg-yellow" />
          raak
        </span>
        <span className="flex items-center gap-3">
          <span className="box-border size-[1.375rem] rounded-full border-[0.1875rem] border-muted opacity-50" />
          mis
        </span>
        <span className="flex items-center gap-3">
          <span className="box-border size-[1.375rem] rounded-full border-[0.3125rem] border-yellow bg-ink" />
          zojuist geroepen
        </span>
        <span>· nog niet geroepen doelen staan gedimd</span>
      </div>
    </>
  );
}
