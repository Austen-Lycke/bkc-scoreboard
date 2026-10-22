"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo } from "react";
import {
  buildDemoSnapshot,
  buildState,
  DEMO_COMPETITION_ID,
  WSA_DEMO_ID,
  type CompetitionSnapshot,
  type CompetitionState,
  type EventPayload,
  type EventType,
} from "@/lib/competition";
import { ACTIVE_COMPETITION_KEY, deviceId, offlineDb, setMeta, type LiveRecord, type StoredEvent } from "./db";

export interface LocalCompetition {
  state: CompetitionState;
  live: LiveRecord | undefined;
  /** Events recorded on this device that the server doesn't have yet. */
  unsynced: number;
}

/**
 * The competition as stored on this device, kept live: Dexie re-runs the query whenever the data
 * changes, also when another window (the TV) or tab made the change.
 * `undefined` while loading, `null` when this device has no snapshot for it yet.
 */
export function useLocalCompetition(competitionId: string | null): LocalCompetition | null | undefined {
  const data = useLiveQuery(async () => {
    if (!competitionId) return null;
    const db = offlineDb();
    const [stored, events, live] = await Promise.all([
      db.snapshots.get(competitionId),
      db.events.where("competitionId").equals(competitionId).sortBy("seq"),
      db.live.get(competitionId),
    ]);
    if (!stored) return null;
    return { snapshot: stored.snapshot, events, live };
  }, [competitionId]);

  return useMemo(() => {
    if (data === undefined) return undefined;
    if (data === null) return null;
    return {
      state: buildState(data.snapshot, data.events),
      live: data.live,
      unsynced: data.events.filter((e) => e.synced === 0).length,
    };
  }, [data]);
}

/** Stores a freshly downloaded snapshot. Local events stay: they're replayed on top of it. */
export async function saveSnapshot(snapshot: CompetitionSnapshot): Promise<void> {
  const db = offlineDb();
  await db.transaction("rw", db.snapshots, db.meta, async () => {
    await db.snapshots.put({ competitionId: snapshot.competition.id, snapshot });
    await setMeta(ACTIVE_COMPETITION_KEY, snapshot.competition.id);
  });
}

/** Creates a demo competition on this device (again), wiping earlier demo scores. */
export async function resetDemo(id: string = DEMO_COMPETITION_ID): Promise<void> {
  const db = offlineDb();
  await db.transaction("rw", [db.snapshots, db.events, db.live, db.meta], async () => {
    await db.events.where("competitionId").equals(id).delete();
    await db.live.delete(id);
    await saveSnapshot(buildDemoSnapshot(new Date(), id === WSA_DEMO_ID ? "wsa" : "spanish"));
  });
}

/** Records an operator action. This is the only way the competition changes. */
export async function emit<T extends EventType>(competitionId: string, type: T, payload: EventPayload<T>): Promise<void> {
  await emitMany(competitionId, [{ type, payload }]);
}

/** Several actions at once (e.g. both passes of a phase), atomically. */
export async function emitMany(competitionId: string, actions: { type: EventType; payload: EventPayload<EventType> }[]) {
  const db = offlineDb();
  await db.transaction("rw", [db.events, db.snapshots, db.meta], async () => {
    const device = await deviceId();
    const base = await nextEventTime(competitionId);
    await db.events.bulkAdd(
      actions.map(
        (a, i) =>
          ({
            id: crypto.randomUUID(),
            competitionId,
            deviceId: device,
            at: new Date(base + i).toISOString(),
            type: a.type,
            payload: a.payload,
            synced: 0,
          }) as StoredEvent,
      ),
    );
  });
}

/**
 * The time of the next action, which orders the log: now, but never before an event this device
 * already has (its own, or the other laptop's after a takeover). A clock that is behind, or that
 * jumps back once it finds a network, then can't put a correction before the score it corrects.
 */
async function nextEventTime(competitionId: string): Promise<number> {
  const db = offlineDb();
  const [last, stored] = await Promise.all([db.events.where("competitionId").equals(competitionId).last(), db.snapshots.get(competitionId)]);
  let latest = last ? Date.parse(last.at) : 0;
  for (const e of stored?.snapshot.events ?? []) latest = Math.max(latest, Date.parse(e.at));
  return Math.max(Date.now(), latest + 1);
}

type LivePatch = Partial<Omit<LiveRecord, "competitionId">>;

/**
 * Updates the live record. Pass a function to derive the change from the stored record inside the
 * transaction: fast taps then never overwrite each other.
 */
export async function updateLive(competitionId: string, patch: LivePatch | ((current: LiveRecord) => LivePatch)) {
  const db = offlineDb();
  await db.transaction("rw", db.live, async () => {
    const current = (await db.live.get(competitionId)) ?? {
      competitionId,
      focus: null,
      drafts: {},
      shootoff: null,
      updatedAt: "",
    };
    const change = typeof patch === "function" ? patch(current) : patch;
    await db.live.put({ ...current, ...change, updatedAt: new Date().toISOString() });
  });
}

/** Removes a competition and everything recorded for it from this device only (not from the server). */
export async function removeFromDevice(competitionId: string): Promise<void> {
  const db = offlineDb();
  await db.transaction("rw", [db.snapshots, db.events, db.live, db.meta], async () => {
    await db.events.where("competitionId").equals(competitionId).delete();
    await db.snapshots.delete(competitionId);
    await db.live.delete(competitionId);
    if ((await db.meta.get(ACTIVE_COMPETITION_KEY))?.value === competitionId) await db.meta.delete(ACTIVE_COMPETITION_KEY);
  });
}

export async function eventsForExport(competitionId: string) {
  return offlineDb().events.where("competitionId").equals(competitionId).sortBy("seq");
}
