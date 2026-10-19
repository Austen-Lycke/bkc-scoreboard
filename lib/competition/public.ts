import { ageOn, JUNIOR_AGE_LIMIT, maxPassScore, publicDisplayName, sortRanks, type Setup, type TieState } from "@/lib/scoring";
import {
  competitionProgress,
  competitionSchedule,
  entriesOfRank,
  expectedPasses,
  passOf,
  rankName,
  ranksInShootingOrder,
  standingsFor,
} from "./derive";
import { setupForRank, type CompetitionState } from "./state";

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

export interface PublicRank {
  code: string;
  name: string;
  complete: boolean;
  /** Maximum score of one pass on this rank's setup (a "perfect" pass). */
  maxPass: number;
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
  /** The heat on the line now (from saved passes; taps before saving stay on the venue TV). */
  current: {
    round: number;
    rankName: string;
    heatNumber: number;
    heatsInRank: number;
    swapped: boolean;
    shooters: { shooterId: string; name: string; knockdown: number; total: number; position: number | null }[];
  } | null;
  next: { round: number; rankName: string; names: string[] }[];
  lastPasses: { name: string; rankName: string; round: number; knockdown: number; score: number; hits: string[]; setup: Setup; at: string }[];
  ranks: PublicRank[];
  progress: { done: number; total: number };
}

/** Public name: shortened for juniors and anyone under 18 on the reference date. */
export function publicName(
  shooter: { firstName: string; lastName: string; birthdate: string },
  opts: { isJuniorRank: boolean; onDate: string },
): string {
  const minor = opts.isJuniorRank || ageOn(shooter.birthdate, opts.onDate) < JUNIOR_AGE_LIMIT;
  return publicDisplayName(shooter, minor);
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

  const passCols: [number, number][] = [];
  for (let r = 1; r <= comp.rounds; r++) for (let k = 1; k <= comp.knockdowns; k++) passCols.push([r, k]);

  const ranks: PublicRank[] = ranksInShootingOrder(state)
    .map((rank) => {
      const standings = standingsFor(state, rank.code);
      return {
        code: rank.code,
        name: rank.name,
        complete: standings.complete,
        maxPass: maxPassScore(setupForRank(state.snapshot, rank.code)),
        rows: standings.rows.map((row) => ({
          position: row.position,
          shooterId: shooterIdOf(row.entryId),
          name: nameOf(row.entryId),
          total: row.total,
          passes: passCols.map(([r, k]) => passOf(state, row.entryId, r, k)?.score ?? null),
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
    const standings = standingsFor(state, heat.rankCode);
    const phase = heat.phases[progress.phaseIndex ?? 0];
    current = {
      round: heat.round,
      rankName: rankName(state, heat.rankCode),
      heatNumber: heat.index + 1,
      heatsInRank: schedule.filter((h) => h.round === heat.round && h.rankCode === heat.rankCode).length,
      swapped: (progress.phaseIndex ?? 0) > 0,
      shooters: phase.map((s) => ({
        shooterId: shooterIdOf(s.entryId),
        name: nameOf(s.entryId),
        knockdown: s.knockdown,
        total: standings.rows.find((r) => r.entryId === s.entryId)?.total ?? 0,
        position: standings.rows.find((r) => r.entryId === s.entryId)?.position ?? null,
      })),
    };
  }

  const lastPasses = [...state.passes.values()]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, 4)
    .map((p) => {
      const rankCode = state.entries.get(p.entryId)!.rankCode;
      return {
        name: nameOf(p.entryId),
        rankName: rankName(state, rankCode),
        round: p.round,
        knockdown: p.knockdown,
        score: p.score,
        hits: p.hits,
        setup: setupForRank(state.snapshot, rankCode),
        at: p.at,
      };
    });

  const activeShooters = sortRanks(state.snapshot.ranks).reduce((n, r) => n + entriesOfRank(state, r.code).length, 0);

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
    passLabels: passCols.map(([r, k]) => `R${r} KD${k}`),
    current,
    next: (progress.heatIndex === null ? [] : schedule.slice(progress.heatIndex + 1, progress.heatIndex + 4)).map((h) => ({
      round: h.round,
      rankName: rankName(state, h.rankCode),
      names: h.shooters.map(nameOf),
    })),
    lastPasses,
    ranks,
    progress: { done: state.passes.size, total: activeShooters * expectedPasses(state) },
  };
}
