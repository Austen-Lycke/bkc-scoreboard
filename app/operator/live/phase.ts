"use client";

import { useCallback, useEffect, useRef } from "react";
import { autoStatus, heatKey, START_COUNTDOWN_SECONDS, startSeries, statusActions, type CompetitionState, type CompetitionStatus } from "@/lib/competition";
import type { Heat } from "@/lib/scoring";
import { emitMany, updateLive } from "@/lib/offline/store";
import { useComp } from "./context";

/** How long "Pauze starten" counts down on the TV; "+5 min" makes it longer. */
export const BREAK_MINUTES = 10;

/**
 * Moves the day to another phase (not the end: that goes through Afronden). A timed day (WSA) counts
 * the warmup down on the TV right away, and every day counts the break down; any other phase stops a
 * countdown, a series timer too. The last save can't be undone from the new phase any more: corrections go through Stand.
 */
export async function setPhase(id: string, state: CompetitionState, status: CompetitionStatus) {
  await emitMany(id, statusActions(state, status));
  const warmup = state.format.timing?.warmupSeconds;
  const from = (seconds: number) => new Date(Date.now() + seconds * 1000).toISOString();
  await updateLive(id, (current) => ({
    lastSave: null,
    seriesTimer: null,
    lineStart: null,
    ...(status === "warmup" && warmup
      ? { pauseEndsAt: from(warmup) }
      : status === "break"
        ? current.pauseEndsAt
          ? {}
          : { pauseEndsAt: from(BREAK_MINUTES * 60) }
        : current.pauseEndsAt
          ? { pauseEndsAt: null }
          : {}),
  }));
}

/**
 * Scoring a round moves the phase along with it (Klaar or Opwarming → Ronde 1, Pauze → Ronde 2), so the
 * TV shows the line from the first tap even when nobody switched the phase. Sent once per change.
 */
export function useAutoPhase() {
  const { id, state } = useComp();
  const sent = useRef<string | null>(null);
  // Switched back by hand (to the warmup, say): the next start has to move the phase again.
  useEffect(() => {
    sent.current = null;
  }, [state.status]);
  return useCallback(
    async (round: number) => {
      const target = autoStatus(state, round);
      const key = `${state.status}>${target}`;
      if (!target || sent.current === key) return;
      sent.current = key;
      await emitMany(id, statusActions(state, target));
      await updateLive(id, (current) => (current.pauseEndsAt ? { pauseEndsAt: null } : {}));
    },
    [id, state],
  );
}

/**
 * Starts a beurt with a 3-2-1 on the TV and the start signal at the end of it. Moves the phase along
 * like scoring does. A timed heat (WSA) starts the countdown of `series` at that same moment.
 */
export function useStartBeurt() {
  const { id } = useComp();
  const advance = useAutoPhase();
  return useCallback(
    async (heat: Heat, { series }: { series?: number } = {}) => {
      await advance(heat.round);
      const key = heatKey(heat);
      const now = Date.now();
      await updateLive(
        id,
        series
          ? { lineStart: null, seriesTimer: startSeries(key, series, now) }
          : { lineStart: { heatKey: key, at: new Date(now + START_COUNTDOWN_SECONDS * 1000).toISOString() } },
      );
    },
    [id, advance],
  );
}
