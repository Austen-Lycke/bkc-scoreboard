import type { DisciplineType, Setup } from "./types";

interface Discipline {
  /** Score of one pass, given the ids of the targets that were knocked down. */
  scorePass(setup: Setup, hitTargetIds: readonly string[]): number;
  maxPassScore(setup: Setup): number;
}

/** Every plate knocked down scores its points. */
const knockdown: Discipline = {
  scorePass(setup, hitTargetIds) {
    const hits = new Set(hitTargetIds);
    for (const id of hits) {
      if (!setup.targets.some((t) => t.id === id)) {
        throw new Error(`Unknown target "${id}" for setup ${setup.id}`);
      }
    }
    return setup.targets.reduce((sum, t) => (hits.has(t.id) ? sum + t.points : sum), 0);
  },
  maxPassScore(setup) {
    return setup.targets.reduce((sum, t) => sum + t.points, 0);
  },
};

// All current variants score the same way; a variant with its own rules gets its own entry.
const DISCIPLINES: Record<DisciplineType, Discipline> = {
  spanish_knockdown: knockdown,
  wsa_v1: knockdown,
  wsa_v2: knockdown,
};

export function scorePass(setup: Setup, hitTargetIds: readonly string[]): number {
  return DISCIPLINES[setup.disciplineType].scorePass(setup, hitTargetIds);
}

export function maxPassScore(setup: Setup): number {
  return DISCIPLINES[setup.disciplineType].maxPassScore(setup);
}
