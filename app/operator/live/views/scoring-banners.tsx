"use client";

import { emit } from "@/lib/offline/store";
import { entryName, entryShortName, groupName, heatKey, pendingShootoffs, roundName, statusForRound } from "@/lib/competition";
import type { Heat } from "@/lib/scoring";
import { useComp, useNav } from "../context";
import { BREAK_MINUTES, setPhase } from "../phase";
import { Panel, Pill } from "@/components/ui";

/** The next heats in line. A heat of more than two (WSA) lists its names under the count. */
export function NextUp({ next }: { next: Heat[] }) {
  const { state } = useComp();
  return (
    <Panel size="md" className="flex flex-col gap-3 px-5 py-[1.125rem]">
      <div className="text-[0.9375rem] font-semibold">Daarna</div>
      {next.length === 0 ? (
        <span className="text-sm text-muted">Niemand meer.</span>
      ) : (
        next.map((h, j) => (
          // A short screen (laptop, tablet in landscape) shows two, so the list never runs under the save block.
          <div key={heatKey(h)} className={`flex items-center gap-3 ${j >= 2 ? "[@media(max-height:56rem)]:hidden" : ""}`}>
            <span className="grid size-[1.625rem] flex-none place-items-center rounded-full border-[0.09375rem] border-border text-xs font-semibold">{j + 1}</span>
            <div className="min-w-0">
              {h.shooters.length > 2 ? (
                <>
                  <div className="text-sm font-semibold">{h.shooters.length} schutters</div>
                  <div className="line-clamp-2 text-xs text-muted">{h.shooters.map((e) => entryShortName(state, e)).join(", ")}</div>
                </>
              ) : (
                <div className="truncate text-sm font-semibold">{h.shooters.map((e) => entryName(state, e)).join(" & ")}</div>
              )}
              <div className="text-xs text-muted first-letter:uppercase">
                {roundName(state, h.round)} · {groupName(state, h.groupCode)} · beurt {h.index + 1}
              </div>
            </div>
          </div>
        ))
      )}
    </Panel>
  );
}

/** Nothing left on the line: on to the standings, or first an afkamping (a tie on a cut line holds up the knockout). */
export function AllShot() {
  const { state } = useComp();
  const { goTo } = useNav();
  const cut = pendingShootoffs(state).find((p) => p.stage);
  return (
    <Panel className="flex flex-col items-start gap-3 px-7 py-6">
      <span className="text-[1.375rem] font-semibold">{cut ? "Eerst afkampen" : "Alle beurten zijn geschoten"}</span>
      <span className="text-[0.9375rem] text-muted">
        {cut
          ? `Gelijke stand op de grens bij ${groupName(state, cut.groupCode)}: de afkamping beslist wie verder mag.`
          : "Kijk de stand na en los eventuele gelijke standen op via Afkamping."}
      </span>
      <div className="flex flex-wrap gap-2">
        <Pill tone={cut ? "outline" : "ink"} onClick={() => goTo("standings")}>
          Naar de stand
        </Pill>
        <Pill tone={cut ? "ink" : "outline"} onClick={() => goTo("shootoff")}>
          Naar afkamping
        </Pill>
      </div>
    </Panel>
  );
}

/** "Ronde 1 is klaar": the operator starts the break, or goes straight on (scoring then moves the phase itself). */
export function PhaseDone({ round }: { round: number }) {
  const { id, state } = useComp();
  const next = statusForRound(state, round);
  const done = state.status === "round1" ? "Ronde 1" : state.status === "round2" ? "Ronde 2" : "De halve finale";
  return (
    <Panel data-keep-enter className="flex flex-col items-start gap-3 px-7 py-6">
      <span className="text-[1.375rem] font-semibold">{done} is klaar</span>
      <span className="text-[0.9375rem] text-muted">
        Start de pauze (de TV toont de tussenstand en telt {BREAK_MINUTES} minuten af), of ga meteen door met {roundName(state, round)}.
      </span>
      <div className="flex flex-wrap gap-2">
        <Pill tone="ink" onClick={() => setPhase(id, state, "break")}>
          Pauze starten
        </Pill>
        <Pill onClick={() => setPhase(id, state, next)}>Meteen door met {roundName(state, round)}</Pill>
      </div>
    </Panel>
  );
}

export function FinishedBanner() {
  const { id, state } = useComp();
  return (
    <div data-keep-enter className="flex items-center gap-3 rounded-2xl bg-ink px-[1.125rem] py-3 text-[0.9375rem] font-semibold text-white">
      <span className="flex-1">Wedstrijd beëindigd. Scoren staat op slot.</span>
      <button
        type="button"
        onClick={() => emit(id, "status.set", { status: state.previousStatus && state.previousStatus !== "finished" ? state.previousStatus : "round2" })}
        className="cursor-pointer rounded-full border-[0.09375rem] border-white px-[0.875rem] py-1.5 text-[0.8125rem]"
      >
        Heropenen
      </button>
    </div>
  );
}
