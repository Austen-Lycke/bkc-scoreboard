import type { CompetitionFormat, RankDef, Setup } from "@/lib/scoring";
import type { CompetitionEvent, CompetitionStatus } from "./events";

/** Everything the operator laptop needs to run a competition offline. Built by the server (or the demo). */
export interface CompetitionSnapshot {
  competition: {
    id: string;
    slug: string;
    name: string;
    date: string;
    location: string | null;
    seasonYear: number;
    rounds: number;
    knockdowns: number;
    feeCents: number;
    setupByRank: Record<string, Setup>;
    /** How the day is shot; null (or missing in an older snapshot) = the Spanish day, from `knockdowns`. */
    format?: CompetitionFormat | null;
    status: CompetitionStatus;
  };
  ranks: RankDef[];
  /** Known club shooters, with the rank we'd propose for this season. */
  shooters: SnapshotShooter[];
  /** Season standing points before this competition, per shooter (reverse ranking order). */
  seasonPoints: Record<string, number>;
  /** Events the server already has for this competition. */
  events: CompetitionEvent[];
  fetchedAt: string;
  isDemo?: boolean;
}

export interface SnapshotShooter {
  id: string;
  firstName: string;
  lastName: string;
  birthdate: string | null;
  rankCode: string;
}
