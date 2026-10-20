import { z } from "zod";

/**
 * Everything the operator does is an event. The competition state is rebuilt from the server
 * snapshot plus these events, on the operator laptop (offline), on the TV and later on the server.
 * Payloads are validated with zod where they cross a trust boundary (the sync API).
 */

export const competitionStatus = z.enum(["prepared", "warmup", "round1", "break", "round2", "shootoff", "finished"]);
export type CompetitionStatus = z.infer<typeof competitionStatus>;

const shooterInfo = z.object({
  id: z.uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  /** Not asked at the table any more; club shooters from the admin may have one. */
  birthdate: z.iso.date().nullable(),
});

const round = z.number().int().min(1).max(10);
const knockdown = z.number().int().min(1).max(10);

export const eventPayloads = {
  /** Shooter reported at the table. `isNewShooter` = first time we see them (created offline). */
  "entry.checked_in": z.object({
    entryId: z.uuid(),
    shooter: shooterInfo,
    isNewShooter: z.boolean(),
    rankCode: z.string(),
    feePaid: z.boolean(),
    feeCents: z.number().int().min(0),
  }),
  "entry.updated": z.object({
    entryId: z.uuid(),
    rankCode: z.string().optional(),
    feePaid: z.boolean().optional(),
    feeCents: z.number().int().min(0).optional(),
    /** Left during the competition: keeps their scores, no longer scheduled or ranked. */
    withdrawn: z.boolean().optional(),
  }),
  /** Checked in by mistake; only allowed before they shot. */
  "entry.removed": z.object({ entryId: z.uuid() }),
  "order.set": z.object({
    rankCode: z.string(),
    entryIds: z.array(z.uuid()),
    source: z.enum(["reverse_ranking", "random", "manual"]),
    seed: z.string().optional(),
  }),
  /** One pass (7 shots on one knockdown). Recording the same pass again is a correction. */
  "pass.recorded": z.object({
    entryId: z.uuid(),
    round,
    knockdown,
    hits: z.array(z.string()).max(20),
  }),
  "pass.cleared": z.object({ entryId: z.uuid(), round, knockdown }),
  "shootoff.recorded": z.object({
    iterationId: z.uuid(),
    rankCode: z.string(),
    participants: z.array(z.uuid()).min(2),
    calls: z.array(z.object({ targetId: z.string(), points: z.number().int().min(0) })).min(1),
    results: z.record(z.string(), z.array(z.boolean())),
  }),
  "shootoff.cleared": z.object({ iterationId: z.uuid() }),
  "status.set": z.object({ status: competitionStatus }),
} as const;

export type EventType = keyof typeof eventPayloads;
export type EventPayload<T extends EventType> = z.infer<(typeof eventPayloads)[T]>;

interface EventEnvelope {
  id: string;
  competitionId: string;
  deviceId: string;
  /** Device clock, ISO. Single writer per competition, so this orders the log. */
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
      at: z.iso.datetime({ offset: true }),
      type: z.literal(type),
      payload: eventPayloads[type],
    }),
  ) as unknown as [z.ZodObject, ...z.ZodObject[]],
) as unknown as z.ZodType<CompetitionEvent>;

/** Stable log order: device time, then id (events from one device never share both). */
export function sortEvents<E extends { at: string; id: string }>(events: readonly E[]): E[] {
  return [...events].sort((a, b) => (a.at === b.at ? a.id.localeCompare(b.id) : a.at < b.at ? -1 : 1));
}
