import "server-only";
import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { buildState, competitionEventSchema, type CompetitionEvent, type CompetitionState } from "@/lib/competition";
import { getDb, schema } from "@/lib/db";
import { buildSnapshot } from "./snapshot";
import { tags } from "./tags";

const { competitions, entries, events, passes, shooters, shooterSeasonRanks, shootoffIterations, startOrders } = schema;

export type SyncResult =
  | {
      kind: "ok";
      accepted: string[];
      invalid: { id: string; reason: string }[];
      rejected: { id: string; reason: string }[];
      status: string;
      /** Cache tags of public pages showing this competition. */
      tags: string[];
    }
  | { kind: "not_found" }
  | { kind: "lease"; holder: string; since: string | null };

/**
 * Receives events from the operator laptop. Events are stored idempotently (same id twice = no-op),
 * then the competition tables are rebuilt from the full event log with the same reducer the laptop
 * uses, in one transaction. Only the device holding the lease may write; another device has to take
 * over explicitly.
 */
export async function applySync(opts: {
  competitionId: string;
  deviceId: string;
  takeover: boolean;
  events: unknown[];
}): Promise<SyncResult> {
  const db = getDb();
  const comp = await db.query.competitions.findFirst({ where: eq(competitions.id, opts.competitionId) });
  if (!comp) return { kind: "not_found" };
  if (comp.operatorDeviceId && comp.operatorDeviceId !== opts.deviceId && !opts.takeover) {
    return { kind: "lease", holder: comp.operatorDeviceId, since: comp.operatorLeaseAt?.toISOString() ?? null };
  }

  const valid: CompetitionEvent[] = [];
  const invalid: { id: string; reason: string }[] = [];
  for (const raw of opts.events) {
    const parsed = competitionEventSchema.safeParse(raw);
    const id = String((raw as { id?: unknown })?.id ?? "?");
    if (!parsed.success) invalid.push({ id, reason: parsed.error.issues[0]?.message ?? "ongeldig" });
    else if (parsed.data.competitionId !== comp.id) invalid.push({ id, reason: "andere wedstrijd" });
    else if (parsed.data.deviceId !== opts.deviceId) invalid.push({ id, reason: "ander toestel" });
    else valid.push(parsed.data);
  }

  if (valid.length) {
    await db
      .insert(events)
      .values(
        valid.map((e) => ({
          id: e.id,
          competitionId: e.competitionId,
          deviceId: e.deviceId,
          type: e.type,
          payload: e.payload,
          clientCreatedAt: new Date(e.at),
        })),
      )
      .onConflictDoNothing();
  }

  // Rebuild from the complete log (buildSnapshot includes every stored event).
  const snapshot = (await buildSnapshot(comp.id))!;
  const state = buildState(snapshot);
  await materialize(state, {
    deviceId: opts.deviceId,
    keepPublished: comp.status === "published",
  });

  return {
    kind: "ok",
    accepted: valid.map((e) => e.id),
    invalid,
    rejected: state.rejected.map((r) => ({ id: r.event.id, reason: r.reason })),
    status: state.status,
    tags: [tags.competitions, tags.competition(comp.id), tags.season(comp.seasonYear), tags.shooters],
  };
}

/** Writes the derived tables (entries, passes, orders, afkamping, new shooters, season ranks) in one transaction. */
async function materialize(state: CompetitionState, opts: { deviceId: string; keepPublished: boolean }) {
  const db = getDb();
  const comp = state.snapshot.competition;
  const juniorRanks = new Set(state.snapshot.ranks.filter((r) => r.isJunior).map((r) => r.code));
  const entryList = [...state.entries.values()];
  const ops: BatchItem<"pg">[] = [];

  // Walk-ins created on the laptop become club shooters.
  const known = new Set(state.snapshot.shooters.map((s) => s.id));
  const walkIns = [...state.shooters.values()].filter((s) => !known.has(s.id));
  if (walkIns.length) {
    ops.push(
      db
        .insert(shooters)
        .values(walkIns.map((s) => ({ id: s.id, firstName: s.firstName, lastName: s.lastName, birthdate: s.birthdate })))
        .onConflictDoNothing(),
    );
  }

  // The rank someone shoots in is their rank for the season.
  if (entryList.length) {
    ops.push(
      db
        .insert(shooterSeasonRanks)
        .values(
          entryList.map((e) => ({
            shooterId: e.shooterId,
            seasonYear: comp.seasonYear,
            rankCode: e.rankCode,
            reason: juniorRanks.has(e.rankCode) ? ("junior" as const) : ("start" as const),
          })),
        )
        .onConflictDoUpdate({
          target: [shooterSeasonRanks.shooterId, shooterSeasonRanks.seasonYear],
          set: { rankCode: sql`excluded.rank_code` },
        }),
    );
  }

  ops.push(db.delete(entries).where(eq(entries.competitionId, comp.id))); // cascades to passes
  ops.push(db.delete(startOrders).where(eq(startOrders.competitionId, comp.id)));
  ops.push(db.delete(shootoffIterations).where(eq(shootoffIterations.competitionId, comp.id)));

  if (entryList.length) {
    ops.push(
      db.insert(entries).values(
        entryList.map((e) => ({
          id: e.entryId,
          competitionId: comp.id,
          shooterId: e.shooterId,
          rankCode: e.rankCode,
          checkedInAt: new Date(e.checkedInAt),
          feePaid: e.feePaid,
          feeCents: e.feeCents,
          withdrawn: e.withdrawn,
        })),
      ),
    );
  }
  const passList = [...state.passes.values()];
  if (passList.length) {
    ops.push(
      db.insert(passes).values(
        passList.map((p) => ({
          id: crypto.randomUUID(),
          competitionId: comp.id,
          entryId: p.entryId,
          round: p.round,
          knockdown: p.knockdown,
          hits: p.hits,
          score: p.score,
          enteredAt: new Date(p.at),
        })),
      ),
    );
  }
  if (state.orders.size) {
    ops.push(
      db.insert(startOrders).values(
        [...state.orders.entries()].map(([rankCode, o]) => ({
          competitionId: comp.id,
          rankCode,
          entryIds: o.entryIds,
          source: o.source as "reverse_ranking" | "random" | "manual",
          seed: o.seed,
        })),
      ),
    );
  }
  if (state.shootoffs.length) {
    ops.push(
      db.insert(shootoffIterations).values(
        state.shootoffs.map((s, i) => ({
          id: s.id,
          competitionId: comp.id,
          rankCode: s.rankCode,
          seq: i + 1,
          participants: s.participants,
          calls: s.calls,
          results: s.results,
        })),
      ),
    );
  }

  ops.push(
    db
      .update(competitions)
      .set({
        status: opts.keepPublished && state.status === "finished" ? "published" : state.status,
        lastEventAt: state.lastEventAt ? new Date(state.lastEventAt) : null,
        operatorDeviceId: opts.deviceId,
        operatorLeaseAt: new Date(),
      })
      .where(eq(competitions.id, comp.id)),
  );

  // neon-http runs a batch as a single transaction.
  await db.batch(ops as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
}
