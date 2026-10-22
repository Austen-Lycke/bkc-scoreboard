"use client";

import { useCallback, useRef } from "react";
import { autoStatus, statusActions, type CompetitionState, type CompetitionStatus } from "@/lib/competition";
import { emitMany, updateLive } from "@/lib/offline/store";
import { useComp } from "./context";

/**
 * Moves the day to another phase (not the end: that goes through Afronden). A timed day (WSA) counts
 * the warmup down on the TV right away; any other phase but the break stops a countdown. The last
 * save can't be undone from the new phase any more: corrections go through Stand.
 */
export async function setPhase(id: string, state: CompetitionState, status: CompetitionStatus) {
  await emitMany(id, statusActions(state, status));
  const warmup = state.format.timing?.warmupSeconds;
  await updateLive(id, (current) => ({
    lastSave: null,
    ...(status === "warmup" && warmup
      ? { pauseEndsAt: new Date(Date.now() + warmup * 1000).toISOString() }
      : status !== "break" && current.pauseEndsAt
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
