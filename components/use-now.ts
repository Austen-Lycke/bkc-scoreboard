"use client";

import { useEffect, useState } from "react";

/** The current time in ms, refreshed every `intervalMs` while `enabled` (for countdowns). */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0); // catch up right away after being disabled for a while
    const timer = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [intervalMs, enabled]);
  return now;
}

/** 754 seconds → "12:34". */
export const formatClock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
