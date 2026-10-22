import {
  achievableScores,
  passKey,
  scorePass,
  sortRanks,
  type CompetitionFormat,
  type GroupDef,
  type Setup,
  type ShootoffIteration,
} from "@/lib/scoring";
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
  /** The reason the jury gave for the last correction. */
  note?: string;
}

export interface ShootoffRecord extends ShootoffIteration {
  id: string;
  /** The group the tie is in (a rank code, unless the format groups ranks). */
  rankCode: string;
  /** "cut:N": settles who goes on after round N. Missing: the final standings. */
  stage?: string;
  at: string;
}

export interface CompetitionState {
  snapshot: CompetitionSnapshot;
  /** How the day is shot, with the operator's semi-final/final switches applied. */
  format: CompetitionFormat;
  /** Club shooters from the snapshot plus walk-ins created during the competition. */
  shooters: Map<string, SnapshotShooter>;
  entries: Map<string, Entry>;
  orders: Map<string, { entryIds: string[]; source: string; seed?: string }>;
  /** Keyed by `passKey(entryId, round, knockdown)`. */
  passes: Map<string, PassRecord>;
  shootoffs: ShootoffRecord[];
  /** Ties of the final standings the jury chose not to afkamp: those shooters share the place. */
  waivedTies: { rankCode: string; participants: string[] }[];
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

/** The stored format, or the Spanish day for competitions made before formats existed. */
export function formatOf(snapshot: CompetitionSnapshot): CompetitionFormat {
  const { format, knockdowns } = snapshot.competition;
  return format ?? { lanes: knockdowns, seriesPerRound: knockdowns, rotate: true };
}

/**
 * The groups that shoot and are ranked apart, in shooting order. Without groups in the format every
 * rank is a group (code = rank code). A rank the format doesn't list shoots as its own group.
 */
export function groupsOf(state: Pick<CompetitionState, "snapshot" | "format">): GroupDef[] {
  const ranks = sortRanks(state.snapshot.ranks);
  const groups = state.format.groups ?? [];
  const listed = new Set(groups.flatMap((g) => g.rankCodes));
  return [...groups, ...ranks.filter((r) => !listed.has(r.code)).map((r) => ({ code: r.code, name: r.name, rankCodes: [r.code] }))];
}

export function groupOfRank(state: Pick<CompetitionState, "snapshot" | "format">, rankCode: string): string {
  return groupsOf(state).find((g) => g.rankCodes.includes(rankCode))?.code ?? rankCode;
}

export type Stage = "qualification" | "semifinal" | "final";

/** The rounds after qualification: the semi-final round, and where the final's one-series steps start. */
export function knockoutRounds(state: Pick<CompetitionState, "snapshot" | "format">) {
  const ko = state.format.knockout;
  const last = state.snapshot.competition.rounds;
  const semi = ko?.semifinal ? last + 1 : null;
  const finalStart = ko?.final ? last + (semi ? 2 : 1) : null;
  return { semi, finalStart };
}

export function stageOfRound(state: Pick<CompetitionState, "snapshot" | "format">, round: number): Stage | null {
  if (round >= 1 && round <= state.snapshot.competition.rounds) return "qualification";
  const { semi, finalStart } = knockoutRounds(state);
  if (round === semi) return "semifinal";
  if (finalStart !== null && round >= finalStart) return "final";
  return null;
}

/** Series per shooter in a round: the format's, the semi-final's, or 1 for a final step. */
export function seriesIn(state: Pick<CompetitionState, "snapshot" | "format">, round: number): number {
  const stage = stageOfRound(state, round);
  if (stage === "semifinal") return state.format.knockout!.semiSeries;
  if (stage === "final") return 1;
  return state.format.seriesPerRound;
}

/** The setup a group shoots in a round. */
export function setupFor(state: Pick<CompetitionState, "snapshot" | "format">, groupCode: string, round: number): Setup {
  const stage = stageOfRound(state, round);
  const ko = state.format.knockout;
  if (ko && stage === "semifinal") return ko.semiSetup;
  if (ko && stage === "final") return ko.finalSetup;
  return state.format.setupByRound?.[String(round)] ?? setupForRank(state.snapshot, groupCode);
}

/** Rebuilds the competition from the snapshot plus local events (merged by id, in log order). */
export function buildState(snapshot: CompetitionSnapshot, localEvents: readonly CompetitionEvent[] = []): CompetitionState {
  const format = formatOf(snapshot);
  const state: CompetitionState = {
    snapshot,
    format: { ...format, knockout: format.knockout && { ...format.knockout } },
    shooters: new Map(snapshot.shooters.map((s) => [s.id, s])),
    entries: new Map(),
    orders: new Map(),
    passes: new Map(),
    shootoffs: [],
    waivedTies: [],
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
  const { ranks } = state.snapshot;
  const rankExists = (code: string) => ranks.some((r) => r.code === code);
  const groupExists = (code: string) => groupsOf(state).some((g) => g.code === code);

  switch (event.type) {
    case "entry.checked_in": {
      const p = event.payload;
      if (state.entries.has(p.entryId)) return; // replayed: already applied
      if ([...state.entries.values()].some((e) => e.shooterId === p.shooter.id)) {
        return "Schutter is al ingeschreven";
      }
      if (!rankExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      // A known shooter keeps the name the club has for them (the admin may have corrected it since).
      if (!state.shooters.has(p.shooter.id)) {
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
      if (!groupExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      state.orders.set(p.rankCode, { entryIds: [...p.entryIds], source: p.source, seed: p.seed });
      return;
    }
    case "pass.recorded": {
      const p = event.payload;
      const entry = state.entries.get(p.entryId);
      if (!entry) return "Onbekende inschrijving";
      if (!stageOfRound(state, p.round) || p.knockdown > seriesIn(state, p.round)) return "Ronde of knockdown bestaat niet";
      const setup = setupFor(state, groupOfRank(state, entry.rankCode), p.round);
      let score: number;
      if (setup.entry === "points") {
        // Typed from the scorecard: only a score the plates can make.
        if (p.score === undefined) return "Score ontbreekt";
        if (!achievableScores(setup).has(p.score)) return `${p.score} punten kan niet op ${setup.name}`;
        score = p.score;
      } else {
        try {
          score = scorePass(setup, p.hits);
        } catch (err) {
          return (err as Error).message;
        }
      }
      const key = passKey(p.entryId, p.round, p.knockdown);
      state.passes.set(key, {
        entryId: p.entryId,
        round: p.round,
        knockdown: p.knockdown,
        hits: setup.entry === "points" ? [] : [...new Set(p.hits)],
        score,
        at: event.at,
        edited: state.passes.has(key),
        ...(p.note && { note: p.note }),
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
      if (!groupExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      if (p.participants.some((id) => !state.entries.has(id))) return "Onbekende schutter in afkamping";
      if (p.participants.some((id) => (p.results[id]?.length ?? -1) !== p.calls.length)) {
        return "Afkamping onvolledig: niet elke schutter heeft een resultaat per geroepen doel";
      }
      const record = { id: p.iterationId, rankCode: p.rankCode, stage: p.stage, participants: p.participants, calls: p.calls, results: p.results, at: event.at };
      // A correction keeps its place: iterations settle a tie in the order they were shot.
      const i = state.shootoffs.findIndex((s) => s.id === p.iterationId);
      state.shootoffs = i === -1 ? [...state.shootoffs, record] : state.shootoffs.map((s, j) => (j === i ? record : s));
      return;
    }
    case "shootoff.cleared": {
      state.shootoffs = state.shootoffs.filter((s) => s.id !== event.payload.iterationId);
      return;
    }
    case "shootoff.waived": {
      const p = event.payload;
      if (!groupExists(p.rankCode)) return `Onbekende klasse ${p.rankCode}`;
      if (p.participants.some((id) => !state.entries.has(id))) return "Onbekende schutter in afkamping";
      const set = new Set(p.participants);
      const same = (w: { rankCode: string; participants: string[] }) =>
        w.rankCode === p.rankCode && w.participants.length === set.size && w.participants.every((id) => set.has(id));
      state.waivedTies = state.waivedTies.filter((w) => !same(w));
      if (p.waived) state.waivedTies.push({ rankCode: p.rankCode, participants: [...p.participants] });
      return;
    }
    case "knockout.set": {
      const ko = state.format.knockout;
      if (!ko) return "Deze wedstrijd heeft geen halve finale of finale";
      const last = state.snapshot.competition.rounds;
      // Switching changes which round is which, so never once a knockout round has a score.
      if ([...state.passes.values()].some((x) => x.round > last)) return "De halve finale of finale is al begonnen";
      ko.semifinal = event.payload.semifinal;
      ko.final = event.payload.final;
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
