import { z } from "zod";

/**
 * Everything the operator does is an event. The competition state is rebuilt from the server
 * snapshot plus these events, on the operator laptop (offline), on the TV and later on the server.
 * Payloads are validated with zod where they cross a trust boundary (the sync API).
 */

export const competitionStatus = z.enum(["prepared", "warmup", "round1", "break", "round2", "semifinal", "final", "shootoff", "finished"]);
export type CompetitionStatus = z.infer<typeof competitionStatus>;

/** The phases in which shooters are on the line (and the TV shows the heat). */
export const isShootingStatus = (status: string) => status === "round1" || status === "round2" || status === "semifinal" || status === "final";

const shooterInfo = z.object({
  id: z.uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  /** Not asked at the table any more; club shooters from the admin may have one. */
  birthdate: z.iso.date().nullable(),
});

/** Up to 50: after qualification come the semi-final and the final's one-series steps. */
const round = z.number().int().min(1).max(50);
const knockdown = z.number().int().min(1).max(10);
const rankCode = z.string().min(1).max(40);
const feeCents = z.number().int().min(0).max(100_000);
/** Tie groups are small; the cap only keeps a forged event from bloating every rebuild. */
const MAX_SHOOTOFF = 50;

export const eventPayloads = {
  /** Shooter reported at the table. `isNewShooter` = first time we see them (created offline). */
  "entry.checked_in": z.object({
    entryId: z.uuid(),
    shooter: shooterInfo,
    isNewShooter: z.boolean(),
    rankCode,
    feePaid: z.boolean(),
    feeCents,
  }),
  "entry.updated": z.object({
    entryId: z.uuid(),
    rankCode: rankCode.optional(),
    feePaid: z.boolean().optional(),
    feeCents: feeCents.optional(),
    /** Left during the competition: keeps their scores, no longer scheduled or ranked. */
    withdrawn: z.boolean().optional(),
  }),
  /** Checked in by mistake; only allowed before they shot. */
  "entry.removed": z.object({ entryId: z.uuid() }),
  /** The shooting order of a group (a rank, unless the format groups ranks). */
  "order.set": z.object({
    rankCode,
    entryIds: z.array(z.uuid()).max(500),
    source: z.enum(["reverse_ranking", "random", "manual"]),
    seed: z.string().max(200).optional(),
  }),
  /**
   * One pass: 7 shots on one knockdown (Spanish) or one series (WSA). Recording the same pass again is
   * a correction. `knockdown` is the pass number within the round. A setup scored in points (WSA,
   * from the scorecard) sends `score` and no hits.
   */
  "pass.recorded": z.object({
    entryId: z.uuid(),
    round,
    knockdown,
    hits: z.array(z.string().max(40)).max(20),
    score: z.number().int().min(0).max(1000).optional(),
    /** Why a correction was made (from Stand), for questions afterwards. */
    note: z.string().trim().max(200).optional(),
  }),
  "pass.cleared": z.object({ entryId: z.uuid(), round, knockdown }),
  /** `rankCode` is the group the tie is in. `stage` "cut:N": the tie decides who goes on after round N. */
  "shootoff.recorded": z.object({
    iterationId: z.uuid(),
    rankCode,
    stage: z.string().max(40).optional(),
    participants: z
      .array(z.uuid())
      .min(2)
      .max(MAX_SHOOTOFF)
      .refine((ids) => new Set(ids).size === ids.length, "Dubbele schutter in afkamping"),
    calls: z.array(z.object({ targetId: z.string().max(40), points: z.number().int().min(0).max(100) })).min(1).max(MAX_SHOOTOFF),
    results: z.record(z.uuid(), z.array(z.boolean()).max(MAX_SHOOTOFF)),
  }),
  "shootoff.cleared": z.object({ iterationId: z.uuid() }),
  /**
   * The jury chose not to afkamp a tie of the final standings: these shooters share the place.
   * `waived: false` takes that back (the tie needs an afkamping again).
   */
  "shootoff.waived": z.object({
    rankCode,
    participants: z
      .array(z.uuid())
      .min(2)
      .max(MAX_SHOOTOFF)
      .refine((ids) => new Set(ids).size === ids.length, "Dubbele schutter in afkamping"),
    waived: z.boolean(),
  }),
  "status.set": z.object({ status: competitionStatus }),
  /** Semi-final and final on or off, decided on the day; only before either has a score. */
  "knockout.set": z.object({ semifinal: z.boolean(), final: z.boolean() }),
} as const;

export type EventType = keyof typeof eventPayloads;
export type EventPayload<T extends EventType> = z.infer<(typeof eventPayloads)[T]>;

interface EventEnvelope {
  id: string;
  competitionId: string;
  deviceId: string;
  /**
   * Device clock as `toISOString()` gives it (UTC, milliseconds), so comparing strings compares
   * times. Orders the log: the device never issues a time before an event it already knows
   * (see `emit` in lib/offline/store.ts), so a clock that is behind can't reorder history.
   */
  at: string;
}

export type CompetitionEvent = {
  [T in EventType]: EventEnvelope & { type: T; payload: EventPayload<T> };
}[EventType];

export const competitionEventSchema = z.discriminatedUnion(
  "type",
  (Object.keys(eventPayloads) as EventType[]).map((type) =>
    z.object({
      id: z.uuid(),
      competitionId: z.string(),
      deviceId: z.string().min(1).max(100),
      at: z.iso.datetime({ precision: 3 }),
      type: z.literal(type),
      payload: eventPayloads[type],
    }),
  ) as unknown as [z.ZodObject, ...z.ZodObject[]],
) as unknown as z.ZodType<CompetitionEvent>;

/** Stable log order: device time, then id (events from one device never share both). */
export function sortEvents<E extends { at: string; id: string }>(events: readonly E[]): E[] {
  return [...events].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1));
}
