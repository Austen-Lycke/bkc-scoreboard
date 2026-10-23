import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { buildState, competitionEventSchema, type CompetitionEvent, type CompetitionState } from "@/lib/competition";
import { getDb, schema } from "@/lib/db";
import { buildSnapshot } from "./snapshot";
import { tags } from "./tags";

const { competitions, entries, events, passes, seasons, shooters, shooterSeasonRanks, shootoffIterations, startOrders } = schema;

export type SyncResult =
  | {
      kind: "ok";
      accepted: string[];
      invalid: { id: string; reason: string }[];
      rejected: { id: string; reason: string }[];
      status: string;
      /** Cache tags of public pages showing this competition; empty when nothing changed. */
      tags: string[];
    }
  | { kind: "not_found" }
  | { kind: "lease"; holder: string; since: string | null }
  /** The season is closed (promotions are done): only an admin can still change its competitions. */
  | { kind: "closed"; seasonYear: number };

/**
 * Receives events from the operator laptop. The competition is rebuilt from the stored log plus the
 * new events with the same reducer the laptop uses, and the new events and the tables built from
 * them are written in one transaction, so they never get out of step. Events already stored are a
 * no-op; a sync with nothing new (the heartbeat) only renews the lease. Only the device holding the
 * lease may write; another device has to take over explicitly.
 */
export async function applySync(opts: {
  competitionId: string;
  deviceId: string;
  takeover: boolean;
  events: unknown[];
  /** Admins may still correct a competition of a closed season. */
  mayEditClosedSeason: boolean;
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

  const [snapshot, season] = await Promise.all([
    buildSnapshot(comp.id),
    db.query.seasons.findFirst({ where: eq(seasons.year, comp.seasonYear), columns: { status: true } }),
  ]);
  if (!snapshot) return { kind: "not_found" };
  const stored = new Set(snapshot.events.map((e) => e.id));
  const unseen = valid.filter((e) => !stored.has(e.id));
  // An id another competition already uses would be skipped by the insert, yet counted below.
  const taken = new Set<string>();
  if (unseen.length) {
    const rows = await db
      .select({ id: events.id })
      .from(events)
      .where(and(inArray(events.id, unseen.map((e) => e.id)), ne(events.competitionId, comp.id)));
    for (const { id } of rows) {
      taken.add(id);
      invalid.push({ id, reason: "id al in gebruik" });
    }
  }
  const fresh = unseen.filter((e) => !taken.has(e.id));
  const closed = season?.status === "closed" && !opts.mayEditClosedSeason;
  if (closed && fresh.length) return { kind: "closed", seasonYear: comp.seasonYear };

  const state = buildState(snapshot, fresh);
  const result = {
    kind: "ok" as const,
    accepted: valid.filter((e) => !taken.has(e.id)).map((e) => e.id),
    invalid,
    rejected: state.rejected.map((r) => ({ id: r.event.id, reason: r.reason })),
    status: state.status,
  };

  // Looking at a closed season's competition is fine; it just isn't written to.
  if (closed) return { ...result, tags: [] };
  // Two overlapping syncs can each rebuild from a log without the other's events; the count catches that.
  const logSize = snapshot.events.length + fresh.length;
  const inStep = comp.materializedEvents === logSize;
  if (!fresh.length && comp.operatorDeviceId === opts.deviceId && inStep) {
    // Heartbeat: nothing new, so the tables and the public pages stay as they are.
    await db.update(competitions).set({ operatorLeaseAt: new Date() }).where(eq(competitions.id, comp.id));
    return { ...result, tags: [] };
  }

  const insert = fresh.length
    ? [
        db
          .insert(events)
          .values(
            fresh.map((e) => ({
              id: e.id,
              competitionId: e.competitionId,
              deviceId: e.deviceId,
              type: e.type,
              payload: e.payload,
              clientCreatedAt: new Date(e.at),
            })),
          )
          .onConflictDoNothing(),
      ]
    : [];
  // neon-http runs a batch as a single transaction.
  const ops = [...insert, ...materialize(state, { deviceId: opts.deviceId, keepPublished: comp.status === "published", logSize })];
  await db.batch(ops as [BatchItem<"pg">, ...BatchItem<"pg">[]]);

  return { ...result, tags: [tags.competitions, tags.competition(comp.id), tags.season(comp.seasonYear), tags.shooters] };
}

/** The statements that rewrite the derived tables (entries, passes, orders, afkamping, new shooters, season ranks). */
function materialize(state: CompetitionState, opts: { deviceId: string; keepPublished: boolean; logSize: number }): BatchItem<"pg">[] {
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

  // The rank someone shoots in becomes their rank for the season, once they've shot.
  const shot = new Set([...state.passes.values()].map((p) => p.entryId));
  const ranked = entryList.filter((e) => shot.has(e.entryId));
  if (ranked.length) {
    ops.push(
      db
        .insert(shooterSeasonRanks)
        .values(
          ranked.map((e) => ({
            shooterId: e.shooterId,
            seasonYear: comp.seasonYear,
            rankCode: e.rankCode,
            reason: juniorRanks.has(e.rankCode) ? ("junior" as const) : ("start" as const),
          })),
        )
        .onConflictDoUpdate({
          target: [shooterSeasonRanks.shooterId, shooterSeasonRanks.seasonYear],
          set: { rankCode: sql`excluded.rank_code`, reason: sql`excluded.reason` },
          // Same rank as already set (e.g. by a promotion): leave the row and its reason alone.
          setWhere: sql`${shooterSeasonRanks.rankCode} <> excluded.rank_code`,
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
        materializedEvents: opts.logSize,
      })
      .where(eq(competitions.id, comp.id)),
  );

  return ops;
}
