import Dexie, { type Table } from "dexie";
import type { CompetitionEvent, CompetitionSnapshot, CompetitionStatus, LastSave, SeriesTimer } from "@/lib/competition";

/**
 * Local storage on the operator laptop (IndexedDB). It is the source of truth during a competition;
 * the TV window reads the same database, so it keeps working without internet.
 */

export type StoredEvent = CompetitionEvent & {
  seq?: number;
  /** 0 = only on this device, 1 = the server has it. (IndexedDB can't index booleans.) */
  synced: 0 | 1;
};

/** What the operator is doing right now: not saved as events, but shown live on the TV. */
export interface LiveRecord {
  competitionId: string;
  /** The heat the operator has selected, if they jumped away from the next one in line. */
  focus: { heatKey: string; phaseIndex: number } | null;
  /** Targets tapped but not saved yet, per pass key. */
  drafts: Record<string, string[]>;
  /** Scores typed but not saved yet, per pass key (setups scored in points: WSA). */
  draftScores?: Record<string, number>;
  /** The running series countdown of a timed heat, shown on the TV. */
  seriesTimer?: SeriesTimer | null;
  shootoff: ShootoffDraft | null;
  /** End of the break countdown shown on the TV (ISO), or null when no timer runs. */
  pauseEndsAt?: string | null;
  /** Actions the server refused as invalid: they stay on this device but never reach the website. */
  refused?: { count: number; reason: string } | null;
  /** The last save on the scoring screen, for "Ongedaan maken". */
  lastSave?: LastSave | null;
  updatedAt: string;
}

export interface ShootoffDraft {
  /** The group the tie is in. */
  rankCode: string;
  /** "cut:N" when the tie decides who goes on after round N. */
  stage?: string;
  participants: string[];
  calls: { targetId: string; points: number }[];
  results: Record<string, (boolean | null)[]>;
  /** The phase before this afkamping switched the day to "Afkamping"; restored on cancel. */
  returnStatus?: CompetitionStatus | null;
}

class OfflineDb extends Dexie {
  meta!: Table<{ key: string; value: string }, string>;
  snapshots!: Table<{ competitionId: string; snapshot: CompetitionSnapshot }, string>;
  events!: Table<StoredEvent, number>;
  live!: Table<LiveRecord, string>;

  constructor() {
    super("bkc-wedstrijden");
    this.version(1).stores({
      meta: "key",
      snapshots: "competitionId",
      events: "++seq, &id, competitionId, [competitionId+synced]",
      live: "competitionId",
    });
  }
}

let instance: OfflineDb | undefined;

/** Browser only. */
export function offlineDb(): OfflineDb {
  instance ??= new OfflineDb();
  return instance;
}

export async function getMeta(key: string): Promise<string | undefined> {
  return (await offlineDb().meta.get(key))?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await offlineDb().meta.put({ key, value });
}

/** A stable id for this browser, written into every event. */
export async function deviceId(): Promise<string> {
  const existing = await getMeta("deviceId");
  if (existing) return existing;
  const id = `dev-${crypto.randomUUID()}`;
  await setMeta("deviceId", id);
  return id;
}

export const ACTIVE_COMPETITION_KEY = "activeCompetitionId";
