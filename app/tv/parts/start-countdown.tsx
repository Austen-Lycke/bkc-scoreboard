import { useEffect, useRef } from "react";
import { heatKey, START_COUNTDOWN_SECONDS, startMoments, type CompetitionState, type StartMoment } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import type { Heat } from "@/lib/scoring";
import { playGo, playTick } from "@/components/sound";
import { useNowUntil } from "@/components/use-now";

/** How long "Start!" stays up after the countdown. */
const GO_MS = 1300;

/** What the TV counts down to: every start of the series timer, or the one start of a beurt without a timer. */
function momentsOf(state: CompetitionState, live: LiveRecord | undefined, heat: Heat | null): (Omit<StartMoment, "series"> & { series: number | null })[] {
  if (!heat) return [];
  const key = heatKey(heat);
  const timing = state.format.timing;
  if (timing && live?.seriesTimer?.heatKey === key) return startMoments(timing, heat.phases.length, live.seriesTimer);
  return live?.lineStart?.heatKey === key ? [{ at: Date.parse(live.lineStart.at), lead: START_COUNTDOWN_SECONDS, series: null }] : [];
}

/**
 * The countdown over the whole TV: 3-2-1 when the operator starts (or resumes) a series or a beurt, and
 * the 10 seconds of recovery before the next series. A pip on 3, 2 and 1 and the start signal on
 * "Start!". Only sounds for a countdown the TV sees coming (not when it opens halfway).
 */
export function StartCountdown({ state, live, heat }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat | null }) {
  const moments = momentsOf(state, live, heat);
  const last = moments.at(-1);
  const now = useNowUntil(last ? last.at + GO_MS : null, 50);
  const next = moments.find((m) => now < m.at + GO_MS);
  const shown = !next || now < next.at - next.lead * 1000 ? "hidden" : now >= next.at ? "go" : String(Math.ceil((next.at - now) / 1000));
  useCountdownSounds(shown);
  if (shown === "hidden") return null;

  return (
    <div role="timer" aria-label="Aftellen" aria-live="assertive" className="absolute inset-0 z-10 grid place-items-center bg-ink/95">
      {shown !== "go" && next!.lead > START_COUNTDOWN_SECONDS && (
        <span className="absolute inset-x-0 top-24 text-center text-[4.5rem] font-semibold leading-none text-white">Herstel · reeks {next!.series} start over</span>
      )}
      <span
        key={shown}
        className={`animate-count-pop font-bold leading-[0.8] text-yellow tabular-nums motion-reduce:animate-none ${
          shown === "go" ? "text-[18rem] tracking-[-0.04em]" : "text-[32rem] tracking-[-0.05em]"
        }`}
      >
        {shown === "go" ? "Start!" : shown}
      </span>
    </div>
  );
}

function useCountdownSounds(shown: string) {
  const previous = useRef<string | null>(null);
  useEffect(() => {
    const was = previous.current;
    previous.current = shown;
    if (was === null || was === shown) return;
    // Only after a countdown: "Start!" out of nowhere is a TV that was asleep.
    if (shown === "go") {
      if (was !== "hidden") playGo();
    } else if (shown !== "hidden" && Number(shown) <= START_COUNTDOWN_SECONDS && (was === "hidden" || was === "go" || Number(was) > Number(shown))) playTick();
  }, [shown]);
}
