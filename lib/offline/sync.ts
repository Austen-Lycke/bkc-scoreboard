"use client";

import { useEffect, useSyncExternalStore } from "react";
import { downloadSnapshot } from "./api";
import { deviceId, offlineDb, type StoredEvent } from "./db";
import { saveSnapshot } from "./store";

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

export async function syncNow(competitionId: string, { takeover = false } = {}): Promise<void> {
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
        });
      } catch {
        setStatus(competitionId, { state: "offline", message: undefined });
        return;
      }
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        setStatus(competitionId, { state: "lease", message: body.since ? `sinds ${new Date(body.since).toLocaleTimeString("nl-BE")}` : undefined });
        return;
      }
      if (res.status === 401 || res.status === 403) {
        setStatus(competitionId, { state: "auth", message: undefined });
        return;
      }
      if (!res.ok) {
        setStatus(competitionId, { state: "error", message: `Server antwoordde ${res.status}` });
        return;
      }
      const body: { accepted: string[]; invalid: { id: string; reason: string }[] } = await res.json();
      if (body.invalid.length) console.warn("Door de server geweigerde acties", body.invalid);
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
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [competitionId, enabled]);

  useEffect(() => {
    if (enabled && unsynced > 0) void syncNow(competitionId);
  }, [competitionId, enabled, unsynced]);
}
