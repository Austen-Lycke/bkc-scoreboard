import { passKey } from "@/lib/scoring";
import type { EventPayload } from "./events";
import { passOf } from "./derive";
import type { CompetitionState } from "./state";

/**
 * "Ongedaan maken" on the scoring screen. The log is never edited: undoing a save records new
 * events that put its passes back as they were, so the TV, the server and the website follow.
 */

export interface SavedPass {
  entryId: string;
  round: number;
  knockdown: number;
  /** What the save recorded. */
  hits: string[];
  /** What was recorded before the save; null when the pass had not been shot yet. */
  previous: string[] | null;
}

/** The last "Opslaan" on the scoring screen, kept on the device until the next one. */
export interface LastSave {
  heatKey: string;
  phaseIndex: number;
  /** The operator had jumped to this heat instead of following the schedule. */
  focused: boolean;
  passes: SavedPass[];
  at: string;
}

export type UndoAction =
  | { type: "pass.recorded"; payload: EventPayload<"pass.recorded"> }
  | { type: "pass.cleared"; payload: EventPayload<"pass.cleared"> };

export const sameHits = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((h) => b.includes(h));

/**
 * The events that undo the save, or null when one of its passes changed since (corrected in the
 * standings, or a takeover brought in another device's score): undoing would overwrite that.
 */
export function undoActions(state: CompetitionState, save: LastSave): UndoAction[] | null {
  const actions: UndoAction[] = [];
  for (const p of save.passes) {
    const current = passOf(state, p.entryId, p.round, p.knockdown);
    if (!current || !sameHits(current.hits, p.hits)) return null;
    if (p.previous && sameHits(p.previous, p.hits)) continue;
    const at = { entryId: p.entryId, round: p.round, knockdown: p.knockdown };
    actions.push(p.previous ? { type: "pass.recorded", payload: { ...at, hits: p.previous } } : { type: "pass.cleared", payload: at });
  }
  return actions;
}

/** The taps to show again after undoing, so the operator only fixes what was wrong and saves. */
export const undoDrafts = (save: LastSave): Record<string, string[]> =>
  Object.fromEntries(save.passes.map((p) => [passKey(p.entryId, p.round, p.knockdown), p.hits]));
