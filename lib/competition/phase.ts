import { effectiveOrder, groupsInShootingOrder } from "./derive";
import type { CompetitionStatus, EventPayload, EventType } from "./events";
import { stageOfRound, type CompetitionState } from "./state";

/** The phases of a day in the order they happen. */
const PHASE_ORDER: CompetitionStatus[] = ["prepared", "warmup", "round1", "break", "round2", "semifinal", "final", "shootoff", "finished"];

const phaseIndex = (status: CompetitionStatus) => PHASE_ORDER.indexOf(status);

/** The phase in which a round is shot: "round1", "round2", "semifinal" or "final". */
export function statusForRound(state: Pick<CompetitionState, "snapshot" | "format">, round: number): CompetitionStatus {
  const stage = stageOfRound(state, round);
  if (stage === "semifinal") return "semifinal";
  if (stage === "final") return "final";
  return round <= 1 ? "round1" : "round2";
}

/**
 * The phase scoring a round moves the day to, or null when it stays: only forwards, and never out of
 * an afkamping or the end. So the TV follows the line without the operator switching phases.
 */
export function autoStatus(state: CompetitionState, round: number): CompetitionStatus | null {
  if (state.status === "shootoff" || state.status === "finished") return null;
  const target = statusForRound(state, round);
  return phaseIndex(target) > phaseIndex(state.status) ? target : null;
}

/**
 * The next heat is in a later phase than the one running (round 1 is done, round 2 is next): the
 * operator chooses between a break and going straight on.
 */
export function phaseDone(state: CompetitionState, nextRound: number): boolean {
  const target = statusForRound(state, nextRound);
  return (
    (state.status === "round1" || state.status === "round2" || state.status === "semifinal") && phaseIndex(target) > phaseIndex(state.status)
  );
}

type Action = { type: EventType; payload: EventPayload<EventType> };

/** Switching to a phase. Starting freezes the shooting order of every group, so late arrivals don't reshuffle heats. */
export function statusActions(state: CompetitionState, status: CompetitionStatus): Action[] {
  const freeze =
    status === "warmup" || status === "round1"
      ? groupsInShootingOrder(state)
          .filter((r) => !state.orders.has(r.code))
          .map((r) => ({
            type: "order.set" as const,
            payload: { rankCode: r.code, entryIds: effectiveOrder(state, r.code), source: "reverse_ranking" as const },
          }))
      : [];
  return [...freeze, { type: "status.set" as const, payload: { status } }];
}
