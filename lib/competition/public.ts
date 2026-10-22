import { ageOn, JUNIOR_AGE_LIMIT, maxPassScore, passKey, publicDisplayName, type Setup, type TieState } from "@/lib/scoring";
import {
  competitionProgress,
  competitionSchedule,
  expectedPasses,
  groupName,
  groupsInShootingOrder,
  passColumns,
  passLabel,
  passOf,
  roundTitle,
  standingsFor,
} from "./derive";
import { groupOfRank, setupFor, type CompetitionState } from "./state";

/**
 * What the public may see of a competition. Built on the server from the same state as the
 * operator screen. Minors are shortened to "Voornaam L." here, so their full names (and nobody's
 * birthdate) ever leave the server.
 */

export interface PublicRow {
  position: number | null;
  shooterId: string;
  name: string;
  total: number;
  /** Score per pass in round/knockdown order (see `passLabels`); null = not shot yet. */
  passes: (number | null)[];
  tie: TieState;
  withdrawn: boolean;
}

/** One ranking of the competition: a rank, or a group of ranks on a WSA day (Junior / Volwassenen). */
export interface PublicRank {
  code: string;
  name: string;
  complete: boolean;
  /** Maximum score of each pass (aligned with `passLabels`): a "perfect" pass. */
  maxPasses: number[];
  rows: PublicRow[];
}

export interface PublicView {
  competition: {
    slug: string;
    name: string;
    date: string;
    location: string | null;
    status: CompetitionState["status"];
    seasonYear: number;
  };
  updatedAt: string | null;
  passLabels: string[];
  /** "4 passages per schutter", or how a WSA day goes on after qualification. */
  passNote: string;
  /** The heat on the line now (from saved passes; taps before saving stay on the venue TV). */
  current: {
    round: number;
    /** "Ronde 2", "Halve finale", "Finale · reeks 3". */
    roundLabel: string;
    rankName: string;
    heatNumber: number;
    heatsInRank: number;
    swapped: boolean;
    /** `lane`: the knockdown (frame) they stand at; `col`: their pass in `passLabels`. */
    shooters: { shooterId: string; name: string; knockdown: number; lane: number; col: number; total: number; position: number | null }[];
  } | null;
  next: { round: number; roundLabel: string; rankName: string; heatNumber: number; shooterIds: string[]; names: string[] }[];
  lastPasses: { name: string; rankName: string; round: number; knockdown: number; score: number; hits: string[]; setup: Setup; at: string }[];
  ranks: PublicRank[];
  progress: {
    done: number;
    total: number;
    /** The round of every heat in shooting order, and the heat on the line (null when all are shot). */
    heatRounds: number[];
    heatIndex: number | null;
    /** Under the end of the progress bar: "Ronde 2", or "Finale · reeks 3" on a knockout day. */
    endLabel?: string;
  };
}

/** Public name: shortened for juniors and anyone under 18 on the reference date. */
export function publicName(
  shooter: { firstName: string; lastName: string; birthdate: string | null },
  opts: { isJuniorRank: boolean; onDate: string },
): string {
  const minor = opts.isJuniorRank || (!!shooter.birthdate && ageOn(shooter.birthdate, opts.onDate) < JUNIOR_AGE_LIMIT);
  return publicDisplayName(shooter, minor);
}

/** The name the venue TV shows: like the website, juniors never with their full name. */
export function tvName(state: CompetitionState, entryId: string): string {
  const entry = state.entries.get(entryId);
  const shooter = entry && state.shooters.get(entry.shooterId);
  if (!entry || !shooter) return "Onbekend";
  const isJuniorRank = !!state.snapshot.ranks.find((r) => r.code === entry.rankCode)?.isJunior;
  return publicName(shooter, { isJuniorRank, onDate: state.snapshot.competition.date });
}

export function publicView(state: CompetitionState): PublicView {
  const comp = state.snapshot.competition;
  const juniorRanks = new Set(state.snapshot.ranks.filter((r) => r.isJunior).map((r) => r.code));
  const nameOf = (entryId: string) => {
    const entry = state.entries.get(entryId);
    const shooter = entry && state.shooters.get(entry.shooterId);
    if (!entry || !shooter) return "Onbekend";
    return publicName(shooter, { isJuniorRank: juniorRanks.has(entry.rankCode), onDate: comp.date });
  };
  const shooterIdOf = (entryId: string) => state.entries.get(entryId)?.shooterId ?? "";

  const passCols = passColumns(state);

  const ranks: PublicRank[] = groupsInShootingOrder(state)
    .map((group) => {
      const standings = standingsFor(state, group.code);
      return {
        code: group.code,
        name: group.name,
        complete: standings.complete,
        maxPasses: passCols.map((c) => maxPassScore(setupFor(state, group.code, c.round))),
        rows: standings.rows.map((row) => ({
          position: row.position,
          shooterId: shooterIdOf(row.entryId),
          name: nameOf(row.entryId),
          total: row.total,
          passes: passCols.map((c) => passOf(state, row.entryId, c.round, c.knockdown)?.score ?? null),
          tie: row.tie,
          withdrawn: row.withdrawn,
        })),
      };
    })
    .filter((r) => r.rows.length > 0);

  const schedule = competitionSchedule(state);
  const progress = competitionProgress(state, schedule);
  const heat = progress.heatIndex === null ? null : schedule[progress.heatIndex];
  let current: PublicView["current"] = null;
  if (heat) {
    const standings = standingsFor(state, heat.groupCode);
    const phase = heat.phases[progress.phaseIndex ?? 0];
    current = {
      round: heat.round,
      roundLabel: roundTitle(state, heat.round),
      rankName: groupName(state, heat.groupCode),
      heatNumber: heat.index + 1,
      heatsInRank: schedule.filter((h) => h.round === heat.round && h.groupCode === heat.groupCode).length,
      swapped: state.format.rotate && (progress.phaseIndex ?? 0) > 0,
      shooters: phase.map((s) => ({
        shooterId: shooterIdOf(s.entryId),
        name: nameOf(s.entryId),
        knockdown: s.knockdown,
        lane: s.lane,
        col: passCols.findIndex((c) => c.round === heat.round && c.knockdown === s.knockdown),
        total: standings.rows.find((r) => r.entryId === s.entryId)?.total ?? 0,
        position: standings.rows.find((r) => r.entryId === s.entryId)?.position ?? null,
      })),
    };
  }

  const lastPasses = [...state.passes.values()]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 4)
    .map((p) => {
      const groupCode = groupOfRank(state, state.entries.get(p.entryId)!.rankCode);
      return {
        name: nameOf(p.entryId),
        rankName: groupName(state, groupCode),
        round: p.round,
        knockdown: p.knockdown,
        score: p.score,
        hits: p.hits,
        setup: setupFor(state, groupCode, p.round),
        at: p.at,
      };
    });

  // Every place on the line known so far: on a knockout day the semi-final and final grow as they're decided.
  const spots = schedule.flatMap((h) => h.phases.flat().map((s) => passKey(s.entryId, h.round, s.knockdown)));
  const ko = state.format.knockout;
  const stages = [ko?.semifinal && "halve finale", ko?.final && "finale"].filter(Boolean).join(" en ");
  const unit = state.format.rotate ? "passages" : "reeksen";
  const passNote = stages ? `${expectedPasses(state)} ${unit} per schutter, dan ${stages}` : `${expectedPasses(state)} ${unit} per schutter`;

  return {
    competition: {
      slug: comp.slug,
      name: comp.name,
      date: comp.date,
      location: comp.location,
      status: state.status,
      seasonYear: comp.seasonYear,
    },
    updatedAt: state.lastEventAt,
    passLabels: passCols.map((c) => passLabel(c)),
    passNote,
    current,
    next: (progress.heatIndex === null ? [] : schedule.slice(progress.heatIndex + 1, progress.heatIndex + 4)).map((h) => ({
      round: h.round,
      roundLabel: roundTitle(state, h.round),
      rankName: groupName(state, h.groupCode),
      heatNumber: h.index + 1,
      shooterIds: h.shooters.map(shooterIdOf),
      names: h.shooters.map(nameOf),
    })),
    lastPasses,
    ranks,
    progress: {
      done: spots.filter((key) => state.passes.has(key)).length,
      total: spots.length,
      heatRounds: schedule.map((h) => h.round),
      heatIndex: progress.heatIndex,
      endLabel: schedule.length ? roundTitle(state, schedule.at(-1)!.round) : undefined,
    },
  };
}
