"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { CLUB_TIME_ZONE } from "@/components/public/format";

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

const clubClock = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });

/** "14:32" in Belgian time, refreshed every 10 seconds; empty until mounted (the server's clock may differ). */
export function useClubClock(): string {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(clubClock.format(new Date()));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);
  return time;
}
