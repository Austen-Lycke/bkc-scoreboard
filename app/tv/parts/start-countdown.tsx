import { useEffect, useRef } from "react";
import { heatKey, START_COUNTDOWN_SECONDS } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";
import type { Heat } from "@/lib/scoring";
import { playGo, playTick } from "@/components/sound";
import { useNowUntil } from "@/components/use-now";

/** How long "Start!" stays up after the countdown. */
const GO_MS = 1200;

/**
 * The 3-2-1 over the whole TV when the operator starts a beurt, a pip on every number and the start
 * signal on "Start!". Only sounds for a countdown the TV sees from the start (not when it opens halfway).
 */
export function StartCountdown({ live, heat }: { live: LiveRecord | undefined; heat: Heat | null }) {
  const at = heat && live?.lineStart?.heatKey === heatKey(heat) ? Date.parse(live.lineStart.at) : null;
  const now = useNowUntil(at === null ? null : at + GO_MS, 50);
  // Capped at 3: on the first frame after a start, `now` can still be from before it.
  const shown = at === null || now >= at + GO_MS ? "hidden" : now >= at ? "go" : String(Math.min(START_COUNTDOWN_SECONDS, Math.ceil((at - now) / 1000)));
  useCountdownSounds(shown);
  if (shown === "hidden") return null;

  return (
    <div role="timer" aria-label="Aftellen" aria-live="assertive" className="absolute inset-0 z-10 grid place-items-center bg-ink/85">
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
    if (shown === "go") playGo();
    else if (shown !== "hidden" && (was === "hidden" || Number(was) > Number(shown))) playTick();
  }, [shown]);
}
