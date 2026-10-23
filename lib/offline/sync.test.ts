import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoSnapshot, buildState, type CompetitionEvent, type CompetitionSnapshot } from "@/lib/competition";
import { offlineDb } from "./db";
import { emit, saveSnapshot } from "./store";
import { syncNow, syncStatus } from "./sync";

function snapshotFor(id: string): CompetitionSnapshot {
  const demo = buildDemoSnapshot();
  return { ...demo, isDemo: false, competition: { ...demo.competition, id }, events: [] };
}

async function pendingIds(id: string) {
  return (await offlineDb().events.where("[competitionId+synced]").equals([id, 0]).toArray()).map((e) => e.id);
}

const ok = (body: object) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

describe("syncNow", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    await Promise.all([offlineDb().events.clear(), offlineDb().snapshots.clear(), offlineDb().live.clear()]);
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("pushes pending events in order and marks them synced", async () => {
    const id = crypto.randomUUID();
    await saveSnapshot(snapshotFor(id));
    await emit(id, "status.set", { status: "warmup" });
    await emit(id, "status.set", { status: "round1" });
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      return ok({ accepted: body.events.map((e: { id: string }) => e.id), invalid: [], rejected: [], status: "round1" });
    });

    await syncNow(id);
    const sent = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/operator/competitions/${id}/sync`);
    expect(sent.events.map((e: { payload: { status: string } }) => e.payload.status)).toEqual(["warmup", "round1"]);
    expect(sent.events[0]).not.toHaveProperty("synced");
    expect(await pendingIds(id)).toEqual([]);
    expect(syncStatus(id).state).toBe("synced");
  });

  it("keeps everything locally when offline", async () => {
    const id = crypto.randomUUID();
    await emit(id, "status.set", { status: "warmup" });
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await syncNow(id);
    expect(syncStatus(id).state).toBe("offline");
    expect(await pendingIds(id)).toHaveLength(1);
  });

  it("treats a request that times out as offline and keeps the events", async () => {
    const id = crypto.randomUUID();
    await emit(id, "status.set", { status: "warmup" });
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"));
    await syncNow(id);
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(syncStatus(id).state).toBe("offline");
    expect(await pendingIds(id)).toHaveLength(1);
  });

  it("stops at a lease held by another device and only overrides it on takeover", async () => {
    const id = crypto.randomUUID();
    await saveSnapshot(snapshotFor(id));
    await emit(id, "status.set", { status: "warmup" });
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ holder: "dev-x", since: null }), { status: 409 }));
    await syncNow(id);
    expect(syncStatus(id).state).toBe("lease");
    expect(await pendingIds(id)).toHaveLength(1);

    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/snapshot")) return ok(snapshotFor(id));
      const body = JSON.parse(String(init!.body));
      expect(body.takeover).toBe(true);
      return ok({ accepted: body.events.map((e: { id: string }) => e.id), invalid: [], rejected: [], status: "warmup" });
    });
    await syncNow(id, { takeover: true });
    expect(syncStatus(id).state).toBe("synced");
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/snapshot"))).toBe(true);
  });

  it("sends large backlogs in batches and unblocks events the server can never accept", async () => {
    const id = crypto.randomUUID();
    for (let i = 0; i < 450; i++) await emit(id, "status.set", { status: "round1" });
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const ids: string[] = JSON.parse(String(init.body)).events.map((e: { id: string }) => e.id);
      return ok({ accepted: ids.slice(1), invalid: [{ id: ids[0], reason: "ongeldig" }], rejected: [], status: "round1" });
    });
    await syncNow(id);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await pendingIds(id)).toEqual([]);
    // …but the operator is told, since the website won't have them.
    expect((await offlineDb().live.get(id))?.refused).toEqual({ count: 3, reason: "ongeldig" });
  });

  it("orders new actions after everything the device knows, even with a clock that is behind", async () => {
    const id = crypto.randomUUID();
    const now = Date.now();
    // Taken over from a laptop whose clock ran an hour ahead.
    const fromOtherDevice: CompetitionEvent = {
      id: crypto.randomUUID(),
      competitionId: id,
      deviceId: "dev-other",
      at: new Date(now + 3_600_000).toISOString(),
      type: "status.set",
      payload: { status: "round1" },
    };
    const snapshot = { ...snapshotFor(id), events: [fromOtherDevice] };
    await saveSnapshot(snapshot);
    await emit(id, "status.set", { status: "break" });
    vi.spyOn(Date, "now").mockReturnValue(now - 60_000); // and this clock steps back a minute
    await emit(id, "status.set", { status: "round2" });

    const local = await offlineDb().events.where("competitionId").equals(id).sortBy("seq");
    expect(local[0].at > fromOtherDevice.at).toBe(true);
    expect(local[1].at > local[0].at).toBe(true);
    expect(buildState(snapshot, local).status).toBe("round2");
  });

  it("reports an expired login without losing events", async () => {
    const id = crypto.randomUUID();
    await emit(id, "status.set", { status: "warmup" });
    fetchMock.mockResolvedValue(new Response("{}", { status: 401 }));
    await syncNow(id);
    expect(syncStatus(id).state).toBe("auth");
    expect(await pendingIds(id)).toHaveLength(1);
  });
});
