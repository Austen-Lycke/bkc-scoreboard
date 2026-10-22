"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/** The current time in ms, refreshed every `intervalMs` while `enabled` (for countdowns). */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  // Catch up before the paint after being disabled for a while: a countdown that just started would
  // otherwise show a moment more than its length (5:12 for a 5-minute warmup).
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the clock is the external sync here
    if (enabled) setNow(Date.now());
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, enabled]);
  return now;
}

/** 754 seconds → "12:34". */
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
