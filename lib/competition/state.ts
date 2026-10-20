import { passKey, scorePass, type ShootoffIteration } from "@/lib/scoring";
import { sortEvents, type CompetitionEvent, type CompetitionStatus } from "./events";
import type { CompetitionSnapshot, SnapshotShooter } from "./snapshot";

export interface Entry {
  entryId: string;
  shooterId: string;
  rankCode: string;
  feePaid: boolean;
  feeCents: number;
  withdrawn: boolean;
  checkedInAt: string;
}

export interface PassRecord {
  entryId: string;
  round: number;
  knockdown: number;
  hits: string[];
  score: number;
  at: string;
  /** Recorded again after the first time: a correction ("aangepast" in the standings). */
  edited: boolean;
}

export interface ShootoffRecord extends ShootoffIteration {
  id: string;
  rankCode: string;
  at: string;
}

export interface CompetitionState {
  snapshot: CompetitionSnapshot;
  /** Club shooters from the snapshot plus walk-ins created during the competition. */
  shooters: Map<string, SnapshotShooter>;
  entries: Map<string, Entry>;
  orders: Map<string, { entryIds: string[]; source: string; seed?: string }>;
  /** Keyed by `passKey(entryId, round, knockdown)`. */
  passes: Map<string, PassRecord>;
  shootoffs: ShootoffRecord[];
  status: CompetitionStatus;
  /** The phase before the last change, so "Heropenen" can return to it after the end. */
  previousStatus: CompetitionStatus | null;
  lastEventAt: string | null;
  /** Events that could not be applied, with the reason; shown to the operator, never silently lost. */
  rejected: { event: CompetitionEvent; reason: string }[];
}

export function setupForRank(snapshot: CompetitionSnapshot, rankCode: string) {
  const setups = snapshot.competition.setupByRank;
  const setup = setups[rankCode] ?? Object.values(setups)[0];
  if (!setup) throw new Error(`No setup configured for competition ${snapshot.competition.id}`);
  return setup;
}

/** Rebuilds the competition from the snapshot plus local events (merged by id, in log order). */
export function buildState(snapshot: CompetitionSnapshot, localEvents: readonly CompetitionEvent[] = []): CompetitionState {
  const state: CompetitionState = {
    snapshot,
    shooters: new Map(snapshot.shooters.map((s) => [s.id, s])),
    entries: new Map(),
    orders: new Map(),
    passes: new Map(),
    shootoffs: [],
    status: snapshot.competition.status,
    previousStatus: null,
    lastEventAt: null,
    rejected: [],
  };
  const byId = new Map<string, CompetitionEvent>();
  for (const e of [...snapshot.events, ...localEvents]) byId.set(e.id, e);
  for (const event of sortEvents([...byId.values()])) {
    const reason = applyEvent(state, event);
    if (reason) state.rejected.push({ event, reason });
    else state.lastEventAt = event.at;
  }
  return state;
}

/** Applies one event in place. Returns a reason when the event is rejected. */
function applyEvent(state: CompetitionState, event: CompetitionEvent): string | undefined {
  const { competition, ranks } = state.snapshot;
  const rankExists = (code: string) => ranks.some((r) => r.code === code);

  switch (event.type) {
    case "entry.checked_in": {
      const p = event.payload;
      if (state.entries.has(p.entryId)) return; // replayed: already applied
      if ([...state.entries.values()].some((e) => e.shooterId === p.shooter.id)) {
        return "Schutter is al ingeschreven";
      }
      if (!rankExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      if (p.isNewShooter || !state.shooters.has(p.shooter.id)) {
        state.shooters.set(p.shooter.id, { ...p.shooter, rankCode: p.rankCode });
      }
      state.entries.set(p.entryId, {
        entryId: p.entryId,
        shooterId: p.shooter.id,
        rankCode: p.rankCode,
        feePaid: p.feePaid,
        feeCents: p.feeCents,
        withdrawn: false,
        checkedInAt: event.at,
      });
      return;
    }
    case "entry.updated": {
      const p = event.payload;
      const entry = state.entries.get(p.entryId);
      if (!entry) return "Onbekende inschrijving";
      if (p.rankCode !== undefined) {
        if (!rankExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
        if (hasPasses(state, p.entryId) && p.rankCode !== entry.rankCode) {
          return "Klasse wijzigen kan niet meer: er zijn al scores";
        }
        entry.rankCode = p.rankCode;
      }
      if (p.feePaid !== undefined) entry.feePaid = p.feePaid;
      if (p.feeCents !== undefined) entry.feeCents = p.feeCents;
      if (p.withdrawn !== undefined) entry.withdrawn = p.withdrawn;
      return;
    }
    case "entry.removed": {
      const { entryId } = event.payload;
      if (!state.entries.has(entryId)) return;
      if (hasPasses(state, entryId)) return "Verwijderen kan niet: er zijn al scores (gebruik 'afgehaakt')";
      state.entries.delete(entryId);
      for (const order of state.orders.values()) order.entryIds = order.entryIds.filter((id) => id !== entryId);
      return;
    }
    case "order.set": {
      const p = event.payload;
      if (!rankExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      state.orders.set(p.rankCode, { entryIds: [...p.entryIds], source: p.source, seed: p.seed });
      return;
    }
    case "pass.recorded": {
      const p = event.payload;
      const entry = state.entries.get(p.entryId);
      if (!entry) return "Onbekende inschrijving";
      if (p.round > competition.rounds || p.knockdown > competition.knockdowns) return "Ronde of knockdown bestaat niet";
      let score: number;
      try {
        score = scorePass(setupForRank(state.snapshot, entry.rankCode), p.hits);
      } catch (err) {
        return (err as Error).message;
      }
      const key = passKey(p.entryId, p.round, p.knockdown);
      state.passes.set(key, {
        entryId: p.entryId,
        round: p.round,
        knockdown: p.knockdown,
        hits: [...new Set(p.hits)],
        score,
        at: event.at,
        edited: state.passes.has(key),
      });
      return;
    }
    case "pass.cleared": {
      const p = event.payload;
      state.passes.delete(passKey(p.entryId, p.round, p.knockdown));
      return;
    }
    case "shootoff.recorded": {
      const p = event.payload;
      if (!rankExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      if (p.participants.some((id) => !state.entries.has(id))) return "Onbekende schutter in afkamping";
      if (p.participants.some((id) => (p.results[id]?.length ?? -1) !== p.calls.length)) {
        return "Afkamping onvolledig: niet elke schutter heeft een resultaat per geroepen doel";
      }
      const record = { id: p.iterationId, rankCode: p.rankCode, participants: p.participants, calls: p.calls, results: p.results, at: event.at };
      state.shootoffs = [...state.shootoffs.filter((s) => s.id !== p.iterationId), record];
      return;
    }
    case "shootoff.cleared": {
      state.shootoffs = state.shootoffs.filter((s) => s.id !== event.payload.iterationId);
      return;
    }
    case "status.set": {
      if (event.payload.status !== state.status) state.previousStatus = state.status;
      state.status = event.payload.status;
      return;
    }
  }
}

function hasPasses(state: CompetitionState, entryId: string) {
  for (const p of state.passes.values()) if (p.entryId === entryId) return true;
  return false;
}
