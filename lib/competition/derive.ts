import {
  buildSchedule,
  fullName,
  passKey,
  rankStandings,
  reverseRankingOrder,
  scheduleProgress,
  sortRanks,
  type Heat,
  type RankDef,
  type RankStandings,
  type ScheduleProgress,
} from "@/lib/scoring";
import type { CompetitionState, Entry } from "./state";

/** Read-only views on the competition state, shared by the operator screen and the TV. */

export const ranksInShootingOrder = (state: CompetitionState): RankDef[] => sortRanks(state.snapshot.ranks);

export function rankName(state: CompetitionState, rankCode: string): string {
  return state.snapshot.ranks.find((r) => r.code === rankCode)?.name ?? rankCode;
}

export function entriesOfRank(state: CompetitionState, rankCode: string, { includeWithdrawn = false } = {}): Entry[] {
  return [...state.entries.values()].filter((e) => e.rankCode === rankCode && (includeWithdrawn || !e.withdrawn));
}

export function entryName(state: CompetitionState, entryId: string): string {
  const entry = state.entries.get(entryId);
  const shooter = entry && state.shooters.get(entry.shooterId);
  return shooter ? fullName(shooter) : "Onbekend";
}

/** The automatic order: reverse season ranking, random for shooters without season points. */
export function autoOrder(state: CompetitionState, rankCode: string): string[] {
  const entries = entriesOfRank(state, rankCode);
  const entryByShooter = new Map(entries.map((e) => [e.shooterId, e.entryId]));
  const points = new Map(Object.entries(state.snapshot.seasonPoints));
  const seed = `${state.snapshot.competition.id}:${rankCode}`;
  return reverseRankingOrder([...entryByShooter.keys()], points, seed).map((shooterId) => entryByShooter.get(shooterId)!);
}

/**
 * The order a rank shoots in: the stored order (once set or frozen at the start of round 1) without
 * removed/withdrawn shooters. Late arrivals go at the end, so pairs that already shot stay intact.
 */
export function effectiveOrder(state: CompetitionState, rankCode: string): string[] {
  const auto = autoOrder(state, rankCode);
  const stored = state.orders.get(rankCode);
  if (!stored) return auto;
  const active = new Set(auto);
  const kept = stored.entryIds.filter((id) => active.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...auto.filter((id) => !keptSet.has(id))];
}

export function competitionSchedule(state: CompetitionState): Heat[] {
  const ranks = ranksInShootingOrder(state);
  return buildSchedule({
    rankOrder: ranks.map((r) => r.code),
    ordersByRank: Object.fromEntries(ranks.map((r) => [r.code, effectiveOrder(state, r.code)])),
    rounds: state.snapshot.competition.rounds,
    knockdowns: state.snapshot.competition.knockdowns,
  });
}

export const donePassKeys = (state: CompetitionState) => new Set(state.passes.keys());

export function competitionProgress(state: CompetitionState, schedule = competitionSchedule(state)): ScheduleProgress {
  return scheduleProgress(schedule, donePassKeys(state));
}

export function expectedPasses(state: CompetitionState): number {
  return state.snapshot.competition.rounds * state.snapshot.competition.knockdowns;
}

export function standingsFor(state: CompetitionState, rankCode: string): RankStandings {
  const entries = entriesOfRank(state, rankCode, { includeWithdrawn: true });
  const ids = new Set(entries.map((e) => e.entryId));
  return rankStandings({
    entries: entries.map((e) => ({ entryId: e.entryId, withdrawn: e.withdrawn })),
    passes: [...state.passes.values()].filter((p) => ids.has(p.entryId)),
    expectedPasses: expectedPasses(state),
    shootoffs: state.shootoffs.filter((s) => s.rankCode === rankCode),
  });
}

export function entryTotal(state: CompetitionState, entryId: string): number {
  let total = 0;
  for (const p of state.passes.values()) if (p.entryId === entryId) total += p.score;
  return total;
}

export const passOf = (state: CompetitionState, entryId: string, round: number, knockdown: number) =>
  state.passes.get(passKey(entryId, round, knockdown));

/** Heat identity that survives re-pairing: round, rank and the shooters in it. */
export const heatKey = (heat: Heat) => `${heat.round}:${heat.rankCode}:${heat.shooters.join("+")}`;

/** All ranks with ties that need (another) afkamping, in shooting order. */
export function pendingShootoffs(state: CompetitionState): { rankCode: string; groups: string[][] }[] {
  return ranksInShootingOrder(state)
    .map((r) => ({ rankCode: r.code, groups: standingsFor(state, r.code).pendingTies }))
    .filter((r) => r.groups.length > 0);
}
