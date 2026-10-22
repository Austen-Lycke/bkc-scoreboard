import {
  advanceCount,
  buildSchedule,
  cutAt,
  dropCount,
  fullName,
  groupHeats,
  passKey,
  publicDisplayName,
  rankByTotal,
  rankStandings,
  reverseRankingOrder,
  scheduleProgress,
  sortRanks,
  type GroupDef,
  type Heat,
  type RankDef,
  type RankStandings,
  type ScheduleProgress,
} from "@/lib/scoring";
import { groupOfRank, groupsOf, knockoutRounds, type CompetitionState, type Entry } from "./state";

/** Read-only views on the competition state, shared by the operator screen and the TV. */

export const ranksInShootingOrder = (state: CompetitionState): RankDef[] => sortRanks(state.snapshot.ranks);

/** The groups that shoot and are ranked apart, Junior first: the ranks, or Junior / Volwassenen on a WSA day. */
export const groupsInShootingOrder = (state: CompetitionState): GroupDef[] => groupsOf(state);

export function rankName(state: CompetitionState, rankCode: string): string {
  return state.snapshot.ranks.find((r) => r.code === rankCode)?.name ?? rankCode;
}

export function groupName(state: CompetitionState, groupCode: string): string {
  return groupsOf(state).find((g) => g.code === groupCode)?.name ?? rankName(state, groupCode);
}

/** Compact rank label for chips: "3de klasse" → "3de", "Ereklasse" → "Ere". */
export const rankShortName = (name: string) => name.replace(/\s*klasse$/i, "") || name;

/** Entries of one club rank (check-in lists them per rank, also on a WSA day). */
export function entriesOfRank(state: CompetitionState, rankCode: string, { includeWithdrawn = false } = {}): Entry[] {
  return [...state.entries.values()].filter((e) => e.rankCode === rankCode && (includeWithdrawn || !e.withdrawn));
}

export function entriesOfGroup(state: CompetitionState, groupCode: string, { includeWithdrawn = false } = {}): Entry[] {
  const ranks = new Set(groupsOf(state).find((g) => g.code === groupCode)?.rankCodes ?? [groupCode]);
  return [...state.entries.values()].filter((e) => ranks.has(e.rankCode) && (includeWithdrawn || !e.withdrawn));
}

export function entryName(state: CompetitionState, entryId: string): string {
  const entry = state.entries.get(entryId);
  const shooter = entry && state.shooters.get(entry.shooterId);
  return shooter ? fullName(shooter) : "Onbekend";
}

/** "Pieter D.": for tight spots on the operator screen. */
export function entryShortName(state: CompetitionState, entryId: string): string {
  const entry = state.entries.get(entryId);
  const shooter = entry && state.shooters.get(entry.shooterId);
  return shooter ? publicDisplayName(shooter, true) : "Onbekend";
}

/** The automatic order: reverse season ranking, random for shooters without season points. */
export function autoOrder(state: CompetitionState, groupCode: string): string[] {
  const entries = entriesOfGroup(state, groupCode);
  const entryByShooter = new Map(entries.map((e) => [e.shooterId, e.entryId]));
  const points = new Map(Object.entries(state.snapshot.seasonPoints));
  const seed = `${state.snapshot.competition.id}:${groupCode}`;
  return reverseRankingOrder([...entryByShooter.keys()], points, seed).map((shooterId) => entryByShooter.get(shooterId)!);
}

/**
 * The order a group shoots in: the stored order (once set or frozen at the start of round 1) without
 * removed/withdrawn shooters. Late arrivals go at the end, so heats that already shot stay intact.
 */
export function effectiveOrder(state: CompetitionState, groupCode: string): string[] {
  const auto = autoOrder(state, groupCode);
  const stored = state.orders.get(groupCode);
  if (!stored) return auto;
  const active = new Set(auto);
  const kept = stored.entryIds.filter((id) => active.has(id));
  const keptSet = new Set(kept);
  return [...kept, ...auto.filter((id) => !keptSet.has(id))];
}

/** One group's semi-final and final as far as they're known, and how far each shooter got. */
export interface KnockoutPlan {
  heats: Heat[];
  /** A tie on a cut line: nobody goes on until an afkamping with this `stage` settles it. */
  blocked: { stage: string; group: string[] } | null;
  /** How far each shooter got (0 qualification, 1 semi-final, 2 final, +1 per final series survived). */
  bands: Map<string, number>;
  /** Every stage of the group is shot: the standings are final (up to afkamping). */
  done: boolean;
}

// The state is rebuilt on every change and never mutated after buildState, so plans can be cached on it.
const planCache = new WeakMap<CompetitionState, Map<string, KnockoutPlan>>();

/**
 * Who shoots the semi-final and every final step of a group. Each stage appears once the one before is
 * fully shot: the best half (rounded down, at least the podium) goes on, then every final series the
 * last ones drop out until the podium is left. Frames go by running total, the leader on KD 1.
 */
export function knockoutPlan(state: CompetitionState, groupCode: string): KnockoutPlan {
  const cached = planCache.get(state)?.get(groupCode);
  if (cached) return cached;
  const plan = buildKnockoutPlan(state, groupCode);
  if (!planCache.has(state)) planCache.set(state, new Map());
  planCache.get(state)!.set(groupCode, plan);
  return plan;
}

function buildKnockoutPlan(state: CompetitionState, groupCode: string): KnockoutPlan {
  const ko = state.format.knockout;
  const { rounds } = state.snapshot.competition;
  const active = entriesOfGroup(state, groupCode).map((e) => e.entryId);
  const bands = new Map(active.map((id) => [id, 0]));
  const plan: KnockoutPlan = { heats: [], blocked: null, bands, done: false };

  const passesOf = new Map<string, { round: number; score: number }[]>();
  for (const p of state.passes.values()) passesOf.set(p.entryId, [...(passesOf.get(p.entryId) ?? []), p]);
  const shotIn = (id: string, round: number) => (passesOf.get(id) ?? []).filter((p) => p.round === round).length;
  const totalUpTo = (round: number) => (id: string) => (passesOf.get(id) ?? []).reduce((n, p) => (p.round <= round ? n + p.score : n), 0);
  const settled = (round: number) => state.shootoffs.filter((s) => s.rankCode === groupCode && s.stage === `cut:${round}`);
  const ranked = (ids: string[], round: number) => rankByTotal(ids, totalUpTo(round), settled(round));

  const qualified = active.length > 0 && active.every((id) => {
    for (let r = 1; r <= rounds; r++) if (shotIn(id, r) < state.format.seriesPerRound) return false;
    return true;
  });
  if (!ko || (!ko.semifinal && !ko.final)) return { ...plan, done: qualified };
  if (!qualified) return plan;

  const { semi, finalStart } = knockoutRounds(state);
  const heats = (round: number, ids: string[], series: number) =>
    groupHeats({ round, groupCode, order: ids, lanes: state.format.lanes, series, rotate: false });
  let field = active;
  let lastRound = rounds;

  /** The best half of `field` after `lastRound`, or null when a tie on the line blocks the cut. */
  const goOn = (): string[] | null => {
    const cut = cutAt(ranked(field, lastRound), advanceCount(field.length, ko.podium));
    if ("tie" in cut) {
      plan.blocked = { stage: `cut:${lastRound}`, group: cut.tie };
      return null;
    }
    return cut.through;
  };

  if (semi !== null) {
    const through = goOn();
    if (!through) return plan;
    for (const id of through) bands.set(id, 1);
    plan.heats.push(...heats(semi, through, ko.semiSeries));
    if (!through.every((id) => shotIn(id, semi) >= ko.semiSeries)) return plan;
    field = through;
    lastRound = semi;
  }

  if (finalStart !== null) {
    const through = goOn();
    if (!through) return plan;
    field = through;
    for (let round = finalStart, band = 2; ; round++, band++) {
      for (const id of field) bands.set(id, band);
      plan.heats.push(...heats(round, ranked(field, round - 1).flat(), 1));
      if (!field.every((id) => shotIn(id, round) >= 1)) return plan;
      if (field.length <= ko.podium) break; // that was the podium series
      const cut = cutAt(ranked(field, round), field.length - dropCount(field.length, ko.dropPerStep, ko.podium));
      if ("tie" in cut) {
        plan.blocked = { stage: `cut:${round}`, group: cut.tie };
        return plan;
      }
      field = cut.through;
    }
  }
  return { ...plan, done: true };
}

export function competitionSchedule(state: CompetitionState): Heat[] {
  const groups = groupsOf(state);
  const qualification = buildSchedule({
    groupOrder: groups.map((g) => g.code),
    ordersByGroup: Object.fromEntries(groups.map((g) => [g.code, effectiveOrder(state, g.code)])),
    rounds: state.snapshot.competition.rounds,
    format: state.format,
  });
  if (!state.format.knockout) return qualification;
  // The semi-finals of every group, then the finals group by group.
  const { semi } = knockoutRounds(state);
  const plans = groups.map((g) => knockoutPlan(state, g.code));
  return [
    ...qualification,
    ...plans.flatMap((p) => p.heats.filter((h) => h.round === semi)),
    ...plans.flatMap((p) => p.heats.filter((h) => h.round !== semi)),
  ];
}

export const donePassKeys = (state: CompetitionState) => new Set(state.passes.keys());

export function competitionProgress(state: CompetitionState, schedule = competitionSchedule(state)): ScheduleProgress {
  return scheduleProgress(schedule, donePassKeys(state));
}

/** Passes per shooter in the qualification rounds. */
export function expectedPasses(state: CompetitionState): number {
  return state.snapshot.competition.rounds * state.format.seriesPerRound;
}

export interface PassColumn {
  round: number;
  knockdown: number;
  /** "R1", "HF" (semi-final), "F2" (second final series). */
  head: string;
  /** "KD2" (Spanish), "reeks 2", or empty for a final series. */
  sub: string;
}

export const passLabel = (c: PassColumn, separator = " ") => [c.head, c.sub].filter(Boolean).join(separator);

/**
 * Every pass a standings table shows, in shooting order: the qualification rounds, then the semi-final
 * and the final series that are known (of one group, or of all of them).
 */
export function passColumns(state: CompetitionState, groupCode?: string): PassColumn[] {
  const { rounds } = state.snapshot.competition;
  const { lanes, seriesPerRound, rotate, knockout } = state.format;
  const cols: PassColumn[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let k = 1; k <= seriesPerRound; k++) cols.push({ round: r, knockdown: k, head: `R${r}`, sub: rotate && lanes > 1 ? `KD${k}` : `reeks ${k}` });
  }
  const { semi, finalStart } = knockoutRounds(state);
  if (semi !== null && knockout) for (let k = 1; k <= knockout.semiSeries; k++) cols.push({ round: semi, knockdown: k, head: "HF", sub: `reeks ${k}` });
  if (finalStart !== null) {
    const groups = groupCode ? [groupCode] : groupsOf(state).map((g) => g.code);
    const finalRounds = new Set(groups.flatMap((g) => knockoutPlan(state, g).heats.filter((h) => h.round >= finalStart).map((h) => h.round)));
    for (const r of [...finalRounds].sort((a, b) => a - b)) cols.push({ round: r, knockdown: 1, head: `F${r - finalStart + 1}`, sub: "" });
  }
  return cols;
}

/** Whether a shooter has (or had) a place on the line for this pass: knockout rounds are for those who went on. */
export function shootsPass(state: CompetitionState, entryId: string, round: number): boolean {
  if (round <= state.snapshot.competition.rounds) return true;
  const entry = state.entries.get(entryId);
  if (!entry) return false;
  return knockoutPlan(state, groupOfRank(state, entry.rankCode)).heats.some((h) => h.round === round && h.shooters.includes(entryId));
}

export function standingsFor(state: CompetitionState, groupCode: string): RankStandings {
  const entries = entriesOfGroup(state, groupCode, { includeWithdrawn: true });
  const ids = new Set(entries.map((e) => e.entryId));
  const knockout = state.format.knockout && (state.format.knockout.semifinal || state.format.knockout.final);
  const plan = knockout ? knockoutPlan(state, groupCode) : null;
  return rankStandings({
    entries: entries.map((e) => ({ entryId: e.entryId, withdrawn: e.withdrawn })),
    passes: [...state.passes.values()].filter((p) => ids.has(p.entryId)),
    expectedPasses: expectedPasses(state),
    // Ties on a cut line are settled for that cut only; these settle the final standings.
    shootoffs: state.shootoffs.filter((s) => s.rankCode === groupCode && !s.stage),
    ...(plan ? { bands: plan.bands, complete: plan.done } : {}),
  });
}

export function entryTotal(state: CompetitionState, entryId: string): number {
  let total = 0;
  for (const p of state.passes.values()) if (p.entryId === entryId) total += p.score;
  return total;
}

export const passOf = (state: CompetitionState, entryId: string, round: number, knockdown: number) =>
  state.passes.get(passKey(entryId, round, knockdown));

/** "ronde 2", "halve finale", "finale · reeks 3": which part of the day a round is. */
export function roundName(state: CompetitionState, round: number): string {
  const { semi, finalStart } = knockoutRounds(state);
  if (round === semi) return "halve finale";
  if (finalStart !== null && round >= finalStart) return `finale · reeks ${round - finalStart + 1}`;
  return `ronde ${round}`;
}

export const roundTitle = (state: CompetitionState, round: number) => {
  const name = roundName(state, round);
  return name.charAt(0).toUpperCase() + name.slice(1);
};

/** Heat identity that survives re-pairing: round, group and the shooters in it. */
export const heatKey = (heat: Heat) => `${heat.round}:${heat.groupCode}:${heat.shooters.join("+")}`;

/**
 * Ties that need (another) afkamping, in shooting order: a tie on a cut line blocks the next stage
 * (`stage` "cut:N"); the others settle the final standings once a group is complete.
 */
export function pendingShootoffs(state: CompetitionState): { groupCode: string; stage?: string; groups: string[][] }[] {
  return groupsOf(state).flatMap((g) => {
    const blocked = state.format.knockout ? knockoutPlan(state, g.code).blocked : null;
    const ties = standingsFor(state, g.code).pendingTies;
    return [
      ...(blocked ? [{ groupCode: g.code, stage: blocked.stage, groups: [blocked.group] }] : []),
      ...(ties.length ? [{ groupCode: g.code, groups: ties }] : []),
    ];
  });
}
