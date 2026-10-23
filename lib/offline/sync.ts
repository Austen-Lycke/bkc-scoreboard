"use client";

import { useEffect, useSyncExternalStore } from "react";
import { CLUB_TIME_ZONE } from "@/components/public/format";
import { downloadSnapshot } from "./api";
import { deviceId, offlineDb, type StoredEvent } from "./db";
import { saveSnapshot, updateLive } from "./store";

/**
 * Pushes this device's events to the server whenever there is a connection. The laptop stays the
 * source of truth: failures only mean "not shared yet", never lost data.
 */

export type SyncState = "idle" | "syncing" | "synced" | "offline" | "lease" | "auth" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: string | null;
  message?: string;
}

const BATCH = 200;
const HEARTBEAT_MS = 10_000;
/** Venue wifi can hang a request for minutes; give up and retry on the next heartbeat. */
const SYNC_TIMEOUT_MS = 15_000;
const statuses = new Map<string, SyncStatus>();
const listeners = new Set<() => void>();
const inFlight = new Set<string>();
const IDLE: SyncStatus = { state: "idle", lastSyncAt: null };

function setStatus(id: string, patch: Partial<SyncStatus>) {
  statuses.set(id, { ...(statuses.get(id) ?? IDLE), ...patch });
  for (const l of listeners) l();
}

export const syncStatus = (competitionId: string): SyncStatus => statuses.get(competitionId) ?? IDLE;

export function useSyncStatus(competitionId: string): SyncStatus {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => statuses.get(competitionId) ?? IDLE,
    () => IDLE,
  );
}

/** The event as the server expects it, without the local bookkeeping fields. */
const toWire = (e: StoredEvent) => ({ id: e.id, competitionId: e.competitionId, deviceId: e.deviceId, at: e.at, type: e.type, payload: e.payload });

/** One sync per competition across every tab and window of this browser, not only this one. */
export async function syncNow(competitionId: string, opts: { takeover?: boolean } = {}): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    // A heartbeat skips when another tab is already syncing; a takeover waits its turn.
    await navigator.locks.request(`bkc-sync:${competitionId}`, { ifAvailable: !opts.takeover }, async (lock) => {
      if (lock) await runSync(competitionId, opts);
    });
    return;
  }
  await runSync(competitionId, opts);
}

async function runSync(competitionId: string, { takeover = false }: { takeover?: boolean } = {}): Promise<void> {
  if (inFlight.has(competitionId)) return;
  inFlight.add(competitionId);
  try {
    const db = offlineDb();
    const device = await deviceId();
    let pending = await db.events.where("[competitionId+synced]").equals([competitionId, 0]).sortBy("seq");
    setStatus(competitionId, { state: "syncing" });
    // An empty push still runs: it's the heartbeat that confirms the connection and the lease.
    do {
      const batch = pending.slice(0, BATCH);
      let res: Response;
      try {
        res = await fetch(`/api/operator/competitions/${competitionId}/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: device, takeover, events: batch.map(toWire) }),
          signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
        });
      } catch {
        setStatus(competitionId, { state: "offline", message: undefined });
        return;
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setStatus(competitionId, { state: "lease", message: body.since ? `sinds ${new Date(body.since).toLocaleTimeString("nl-BE", { timeZone: CLUB_TIME_ZONE })}` : undefined });
        return;
      }
      if (res.status === 404) {
        setStatus(competitionId, { state: "error", message: "Deze wedstrijd bestaat niet meer op de server" });
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setStatus(competitionId, { state: "auth", message: undefined });
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatus(competitionId, { state: "error", message: body.error ?? `Server antwoordde ${res.status}` });
        return;
      }
      const body: { accepted: string[]; invalid: { id: string; reason: string }[] } = await res.json();
      if (body.invalid.length) {
        // Shown to the operator until dismissed: the website won't have these.
        console.warn("Door de server geweigerde acties", body.invalid);
        await updateLive(competitionId, (live) => ({
          refused: { count: (live.refused?.count ?? 0) + body.invalid.length, reason: body.invalid.at(-1)!.reason },
        }));
      }
      // Invalid events can never be accepted; mark them too so they don't block the queue.
      await db.events.where("id").anyOf([...body.accepted, ...body.invalid.map((i) => i.id)]).modify({ synced: 1 });
      pending = pending.slice(batch.length);
      if (takeover) {
        // Now that this device holds the lease, pull in what the previous device recorded.
        await saveSnapshot(await downloadSnapshot(competitionId));
        takeover = false;
      }
    } while (pending.length);
    setStatus(competitionId, { state: "synced", lastSyncAt: new Date().toISOString(), message: undefined });
  } catch (err) {
    setStatus(competitionId, { state: "error", message: (err as Error).message });
  } finally {
    inFlight.delete(competitionId);
  }
}

/** Keeps syncing while the operator screen is open: right after each action, and as a heartbeat. */
export function useSyncLoop(competitionId: string, enabled: boolean, unsynced: number) {
  useEffect(() => {
    if (!enabled) return;
    void syncNow(competitionId);
    const timer = setInterval(() => void syncNow(competitionId), HEARTBEAT_MS);
    const onOnline = () => void syncNow(competitionId);
    // Losing the network is certain, so show it right away; "online" only means "try again".
    const onOffline = () => setStatus(competitionId, { state: "offline", message: undefined });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [competitionId, enabled]);

  useEffect(() => {
    if (enabled && unsynced > 0) void syncNow(competitionId);
  }, [competitionId, enabled, unsynced]);
}
