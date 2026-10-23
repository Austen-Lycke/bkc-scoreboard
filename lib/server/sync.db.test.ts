import { asc, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import type { CompetitionEvent, EventPayload, EventType } from "@/lib/competition";
import { getDb, schema } from "@/lib/db";
import { DEFAULT_RANKS, SPANISH_KNOCKDOWN } from "@/lib/scoring";
import { applySync } from "./sync";

const { competitions, passes, seasons } = schema;

const YEAR = 2026;
const DEVICE = "laptop-a";
const ALL_HITS = SPANISH_KNOCKDOWN.targets.map((t) => t.id);
const SHOOTERS = [
  { id: crypto.randomUUID(), firstName: "Jens", lastName: "Vermeulen", birthdate: "1988-05-19" },
  { id: crypto.randomUUID(), firstName: "Elien", lastName: "Maes", birthdate: "1995-11-02" },
];

let competitionId: string;

/** Event factory with a strictly increasing clock, like the one in state.test.ts. */
function makeEvents(device = DEVICE) {
  let t = Date.parse(`${YEAR}-11-07T10:00:00Z`);
  const make = <T extends EventType>(type: T, payload: EventPayload<T>, overrides: Partial<CompetitionEvent> = {}) => {
    t += 1000;
    return { id: crypto.randomUUID(), competitionId, deviceId: device, at: new Date(t).toISOString(), type, payload, ...overrides } as CompetitionEvent;
  };
  return { make };
}

/** Both shooters checked in to Klasse 3; returns their entry ids too. */
function checkIns(make: ReturnType<typeof makeEvents>["make"]) {
  const entryIds = SHOOTERS.map(() => crypto.randomUUID());
  const events = SHOOTERS.map((shooter, i) =>
    make("entry.checked_in", { entryId: entryIds[i], shooter, isNewShooter: false, rankCode: "klasse3", feePaid: true, feeCents: 0 }),
  );
  return { entryIds, events };
}

const sync = (events: unknown[], opts: Partial<Parameters<typeof applySync>[0]> = {}) =>
  applySync({ competitionId, deviceId: DEVICE, takeover: false, events, mayEditClosedSeason: false, ...opts });

const passRows = () =>
  getDb().select().from(passes).where(eq(passes.competitionId, competitionId)).orderBy(asc(passes.entryId), asc(passes.round), asc(passes.knockdown));

const competition = async () => (await getDb().query.competitions.findFirst({ where: eq(competitions.id, competitionId) }))!;

describe("applySync (database)", () => {
  beforeEach(async () => {
    const db = getDb();
    await db.execute(
      sql`TRUNCATE events, passes, entries, start_orders, shootoff_iterations, shooter_season_ranks, competitions, shooters, seasons CASCADE`,
    );
    await db.insert(seasons).values({ year: YEAR, rankingRule: { type: "sum" } });
    await db
      .insert(schema.ranks)
      .values(DEFAULT_RANKS.map((r) => ({ code: r.code, name: r.name, order: r.order, isJunior: !!r.isJunior })))
      .onConflictDoNothing();
    await db.insert(schema.setups).values({ id: SPANISH_KNOCKDOWN.id, name: SPANISH_KNOCKDOWN.name, definition: SPANISH_KNOCKDOWN }).onConflictDoNothing();
    await db.insert(schema.shooters).values(SHOOTERS);
    const [comp] = await db
      .insert(competitions)
      .values({
        slug: `${YEAR}-11-07-test`,
        seasonYear: YEAR,
        name: "Testwedstrijd",
        date: `${YEAR}-11-07`,
        status: "prepared",
        setupByRank: Object.fromEntries(DEFAULT_RANKS.map((r) => [r.code, SPANISH_KNOCKDOWN])),
      })
      .returning({ id: competitions.id });
    competitionId = comp.id;
  });

  it("claims the lease on the first sync; another device needs a takeover", async () => {
    const { make } = makeEvents();
    expect((await sync(checkIns(make).events)).kind).toBe("ok");
    expect((await competition()).operatorDeviceId).toBe(DEVICE);

    const other = await sync([], { deviceId: "laptop-b" });
    expect(other).toMatchObject({ kind: "lease", holder: DEVICE });

    expect((await sync([], { deviceId: "laptop-b", takeover: true })).kind).toBe("ok");
    expect((await competition()).operatorDeviceId).toBe("laptop-b");
  });

  it("changes nothing when the same batch arrives twice", async () => {
    const { make } = makeEvents();
    const { entryIds, events } = checkIns(make);
    const batch = [...events, make("pass.recorded", { entryId: entryIds[0], round: 1, knockdown: 1, hits: ALL_HITS })];

    const first = await sync(batch);
    const rows = await passRows();
    const second = await sync(batch);

    expect(rows).toHaveLength(1);
    expect(await passRows()).toEqual(rows);
    expect(second.kind === "ok" && second.accepted).toEqual(first.kind === "ok" && first.accepted);
  });

  it("refuses events for another competition or from another device", async () => {
    const { make } = makeEvents();
    const foreign = make("status.set", { status: "warmup" }, { competitionId: crypto.randomUUID() });
    const otherDevice = make("status.set", { status: "warmup" }, { deviceId: "laptop-b" });

    const result = await sync([foreign, otherDevice]);

    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.invalid.map((i) => i.id).sort()).toEqual([foreign.id, otherDevice.id].sort());
    expect(result.accepted).toEqual([]);
  });

  it("only lets an admin write to a closed season", async () => {
    await getDb().update(seasons).set({ status: "closed" }).where(eq(seasons.year, YEAR));
    const { make } = makeEvents();
    const { entryIds, events } = checkIns(make);
    const batch = [...events, make("pass.recorded", { entryId: entryIds[0], round: 1, knockdown: 1, hits: ALL_HITS })];

    expect(await sync(batch)).toEqual({ kind: "closed", seasonYear: YEAR });
    expect(await passRows()).toHaveLength(0);

    expect((await sync(batch, { mayEditClosedSeason: true })).kind).toBe("ok");
    expect(await passRows()).toHaveLength(1);
  });

  it("keeps a published competition published after a sync with nothing new", async () => {
    const { make } = makeEvents();
    await sync(checkIns(make).events);
    await getDb().update(competitions).set({ status: "published" }).where(eq(competitions.id, competitionId));

    await sync([]);
    expect((await competition()).status).toBe("published");

    // Also when the heartbeat has to rebuild the tables.
    await getDb().update(competitions).set({ materializedEvents: 0 }).where(eq(competitions.id, competitionId));
    await sync([]);
    const comp = await competition();
    expect(comp.status).toBe("published");
    expect(comp.materializedEvents).toBe(SHOOTERS.length);
  });

  it("rebuilds tables a sync wrote from a stale log on the next heartbeat", async () => {
    const { make } = makeEvents();
    const { entryIds, events } = checkIns(make);
    const a = make("pass.recorded", { entryId: entryIds[0], round: 1, knockdown: 1, hits: ALL_HITS });
    const b = make("pass.recorded", { entryId: entryIds[1], round: 1, knockdown: 1, hits: ALL_HITS.slice(0, 3) });
    await sync([...events, a]);
    await sync([b]);
    // What a sync that read the log before `a` was stored leaves behind: its tables without `a`.
    const db = getDb();
    await db.delete(passes).where(eq(passes.entryId, entryIds[0]));
    await db.update(competitions).set({ materializedEvents: events.length + 1 }).where(eq(competitions.id, competitionId));

    await sync([]);

    expect((await passRows()).map((p) => p.entryId).sort()).toEqual([...entryIds].sort());
    expect((await competition()).materializedEvents).toBe(events.length + 2);
  });

  it("ends up with every score after two overlapping syncs and a heartbeat", async () => {
    const { make } = makeEvents();
    const { entryIds, events } = checkIns(make);
    await sync(events);

    const a = [make("pass.recorded", { entryId: entryIds[0], round: 1, knockdown: 1, hits: ALL_HITS })];
    const b = [make("pass.recorded", { entryId: entryIds[1], round: 1, knockdown: 1, hits: ALL_HITS.slice(0, 3) })];
    const settled = await Promise.allSettled([sync(a), sync(b)]);
    // Fully overlapping rewrites collide on the entries' keys, so one sync fails and rolls back (its
    // events too); the laptop sends it again on its next sync.
    for (const [i, s] of settled.entries()) if (s.status === "rejected") await sync([a, b][i]);
    await sync([]);

    const rows = await passRows();
    expect(rows.map((p) => p.entryId).sort()).toEqual([...entryIds].sort());
    expect((await competition()).materializedEvents).toBe(events.length + 2);
  });
});
