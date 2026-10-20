"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  competitionProgress,
  competitionSchedule,
  DEMO_COMPETITION_ID,
  effectiveOrder,
  pendingShootoffs,
  ranksInShootingOrder,
  type CompetitionStatus,
} from "@/lib/competition";
import { downloadSnapshot } from "@/lib/offline/api";
import { ACTIVE_COMPETITION_KEY, setMeta } from "@/lib/offline/db";
import { emitMany, resetDemo, saveSnapshot, updateLive, useLocalCompetition } from "@/lib/offline/store";
import { syncNow, useSyncLoop, useSyncStatus, type SyncStatus } from "@/lib/offline/sync";
import { openTvWindow } from "@/lib/offline/tv-window";
import { useQueryParam } from "@/lib/offline/url";
import { CompetitionContext, NavContext, useComp, type Tab } from "./context";
import { HeatProgress } from "@/components/heat-progress";
import { Pill } from "@/components/ui";
import { formatClock, useNow } from "@/components/use-now";
import { CheckInView } from "./views/check-in";
import { CloseView } from "./views/close";
import { OrderView } from "./views/order";
import { PrepareView } from "./views/prepare";
import { ScoringView } from "./views/scoring";
import { ShootoffView } from "./views/shootoff";
import { StandingsView } from "./views/standings";
import { CLUB_TIME_ZONE } from "@/components/public/format";

export function OperatorApp() {
  const competitionId = useQueryParam("c");
  const local = useLocalCompetition(competitionId ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // First visit on this device: create the demo, or download the competition.
  useEffect(() => {
    if (!competitionId || local !== null) return;
    if (competitionId === DEMO_COMPETITION_ID) {
      void resetDemo();
      return;
    }
    downloadSnapshot(competitionId).then(
      (snapshot) => saveSnapshot(snapshot),
      (err: Error) => setLoadError(err.message),
    );
  }, [competitionId, local]);

  useEffect(() => {
    if (competitionId && local) void setMeta(ACTIVE_COMPETITION_KEY, competitionId);
  }, [competitionId, local]);

  if (competitionId === null) return <Message title="Geen wedstrijd gekozen">Open een wedstrijd via de wedstrijdleiding.</Message>;
  if (local === null && loadError) return <Message title="Wedstrijd niet geladen">{loadError}</Message>;
  if (!competitionId || !local) return <Message title="Laden…" />;

  return (
    <CompetitionContext.Provider value={{ id: competitionId, ...local }}>
      <Shell />
    </CompetitionContext.Provider>
  );
}

const TABS: { id: Tab; label: string }[] = [
  { id: "prepare", label: "Voorbereiden" },
  { id: "checkin", label: "Inschrijving" },
  { id: "order", label: "Volgorde" },
  { id: "scoring", label: "Scoren" },
  { id: "standings", label: "Stand" },
  { id: "shootoff", label: "Afkamping" },
  { id: "close", label: "Afronden" },
];

function Shell() {
  const { state, unsynced, id, live } = useComp();
  const demo = !!state.snapshot.isDemo;
  useSyncLoop(id, !demo, unsynced);
  const sync = useSyncStatus(id);
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const pending = pendingShootoffs(state).reduce((n, r) => n + r.groups.length, 0);
  const active = [...state.entries.values()].filter((e) => !e.withdrawn).length;
  const [tab, setTab] = useState<Tab>(() =>
    state.status === "prepared" ? "checkin" : state.status === "finished" ? "close" : "scoring",
  );
  const [activeKd, setActiveKd] = useState(1);
  const showTimer = state.status === "break" || !!live?.pauseEndsAt;
  const nav = useMemo(
    () => ({
      goTo: (t: Tab, kd?: number) => {
        setTab(t);
        if (kd) setActiveKd(kd);
      },
    }),
    [],
  );

  const badges: Partial<Record<Tab, number>> = { checkin: active, shootoff: pending };

  return (
    <NavContext.Provider value={nav}>
      <div className="flex h-screen min-h-[48.75rem] flex-col bg-background">
        <header className="flex flex-none items-center gap-6 px-8 pb-3 pt-[1.125rem]">
          <Link href="/operator" title="Naar de wedstrijdleiding" className="text-[0.8125rem] font-bold tracking-[0.2em]">
            BKC
          </Link>
          <span className="max-w-[16rem] truncate text-[0.9375rem] text-muted">
            {state.snapshot.competition.name}
            {demo && " · demo"}
          </span>
          <HeatProgress
            variant="operator"
            rounds={schedule.map((h) => h.round)}
            current={progress.heatIndex}
            className="mx-auto max-w-[35rem] flex-1"
          />
          <SyncBadge sync={sync} unsynced={unsynced} demo={demo} />
          <button
            type="button"
            onClick={() => openTvWindow(id)}
            title="TV-scherm openen"
            className="cursor-pointer rounded-full border-[1.5px] border-ink px-[0.875rem] py-1.5 text-[0.8125rem] font-semibold hover:bg-hover"
          >
            TV
          </button>
        </header>
        <nav className="flex flex-none flex-wrap items-center gap-1 px-8 pb-2.5" aria-label="Onderdelen">
          {TABS.map((t) => {
            const on = t.id === tab;
            const badge = badges[t.id];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={on ? "page" : undefined}
                className={`flex cursor-pointer items-center gap-[0.4375rem] rounded-full px-[0.875rem] py-[0.4375rem] text-sm font-semibold transition ${
                  on ? "bg-ink text-white" : "text-muted hover:text-ink"
                }`}
              >
                {t.label}
                {!!badge && (
                  <span
                    className={`box-border grid h-[1.125rem] min-w-[1.125rem] place-items-center rounded-full px-[0.3125rem] text-[0.6875rem] ${
                      t.id === "shootoff" ? "bg-alert text-white" : on ? "bg-white/20 text-white" : "bg-[#e9e9e4] text-ink"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
            {showTimer && <PauseTimer />}
            <StatusControl />
          </div>
        </nav>
        <Notices sync={sync} />
        <main className="flex min-h-0 flex-1 flex-col">
          {tab === "prepare" && <PrepareView />}
          {tab === "checkin" && <CheckInView />}
          {tab === "order" && <OrderView />}
          {tab === "scoring" && <ScoringView activeKd={activeKd} setActiveKd={setActiveKd} />}
          {tab === "standings" && <StandingsView />}
          {tab === "shootoff" && <ShootoffView />}
          {tab === "close" && <CloseView />}
        </main>
      </div>
    </NavContext.Provider>
  );
}

/** Lease, login and rejected-action messages: rare, but they must be impossible to miss. */
function Notices({ sync }: { sync: SyncStatus }) {
  const { id, state, live } = useComp();
  const items = [];
  if (sync.state === "lease") {
    items.push(
      <div key="lease" className="flex flex-wrap items-center gap-3 rounded-2xl bg-yellow-light px-4 py-2.5 text-sm font-semibold">
        <span className="flex-1">
          Een ander toestel beheert deze wedstrijd{sync.message ? ` (${sync.message})` : ""}. Wat je hier invoert wordt pas gedeeld als je overneemt.
        </span>
        <Pill
          tone="ink"
          size="sm"
          onClick={() => confirm("Deze wedstrijd overnemen? Het andere toestel kan dan niets meer doorsturen.") && syncNow(id, { takeover: true })}
        >
          Overnemen
        </Pill>
      </div>,
    );
  }
  if (sync.state === "auth") {
    items.push(
      <p key="auth" className="rounded-2xl bg-yellow-light px-4 py-2.5 text-sm font-semibold">
        Je sessie is verlopen: alles blijft lokaal bewaard.{" "}
        <Link href="/login" target="_blank" className="underline underline-offset-2">
          Meld opnieuw aan
        </Link>{" "}
        om weer te synchroniseren.
      </p>,
    );
  }
  if (state.rejected.length > 0) {
    items.push(
      <p key="rejected" className="rounded-2xl bg-error-light px-4 py-2.5 text-sm font-semibold text-error">
        {state.rejected.length} actie(s) konden niet toegepast worden: {state.rejected.at(-1)!.reason}
      </p>,
    );
  }
  if (live?.refused) {
    items.push(
      <div key="refused" className="flex flex-wrap items-center gap-3 rounded-2xl bg-error-light px-4 py-2.5 text-sm font-semibold text-error">
        <span className="flex-1">
          De server weigerde {live.refused.count} actie(s) ({live.refused.reason}). Ze staan op dit toestel, maar niet op de website.
        </span>
        <Pill tone="ink" size="sm" onClick={() => updateLive(id, { refused: null })}>
          Begrepen
        </Pill>
      </div>,
    );
  }
  if (!items.length) return null;
  return <div className="flex flex-none flex-col gap-2 px-8 pb-2.5">{items}</div>;
}

const startPause = (competitionId: string, minutes: number) =>
  updateLive(competitionId, { pauseEndsAt: new Date(Date.now() + minutes * 60_000).toISOString() });

/** The break countdown the TV shows. Kept in the live record, so it never ends up in the results. */
function PauseTimer() {
  const { id, live } = useComp();
  const end = live?.pauseEndsAt ? Date.parse(live.pauseEndsAt) : null;
  const now = useNow(1000, end !== null);
  const left = end === null ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
  const done = end !== null && left === 0;

  return (
    <div
      className={`flex items-center gap-2 rounded-full border-[1.5px] border-border py-[0.1875rem] pl-[0.875rem] pr-[0.1875rem] text-xs font-semibold ${
        done ? "bg-yellow" : "bg-surface"
      }`}
    >
      <span className="font-medium text-faint">Pauzetimer op TV</span>
      {end === null ? (
        <div className="flex gap-0.5">
          {[5, 10, 15, 20].map((m) => (
            <button key={m} type="button" onClick={() => startPause(id, m)} className="cursor-pointer rounded-full px-2.5 py-[0.3125rem] hover:bg-fill">
              {m} min
            </button>
          ))}
        </div>
      ) : (
        <>
          <span className="px-1 text-sm tabular-nums">{done ? "Pauze voorbij" : formatClock(left)}</span>
          <button
            type="button"
            onClick={() =>
              updateLive(id, (current) => ({
                pauseEndsAt: new Date(Math.max(Date.parse(current.pauseEndsAt ?? ""), Date.now()) + 5 * 60_000).toISOString(),
              }))
            }
            className="cursor-pointer rounded-full border-[1.5px] border-border px-2.5 py-[0.3125rem]"
          >
            +5 min
          </button>
          <button type="button" onClick={() => updateLive(id, { pauseEndsAt: null })} className="cursor-pointer rounded-full bg-ink px-2.5 py-[0.3125rem] text-white">
            Stop
          </button>
        </>
      )}
    </div>
  );
}

const STATUSES: { id: CompetitionStatus; label: string }[] = [
  { id: "prepared", label: "Klaar" },
  { id: "warmup", label: "Opwarming" },
  { id: "round1", label: "Ronde 1" },
  { id: "break", label: "Pauze" },
  { id: "round2", label: "Ronde 2" },
  { id: "shootoff", label: "Afkamping" },
  { id: "finished", label: "Einde" },
];

/** The phase of the day. Drives what the TV shows; scoring itself follows the schedule. */
function StatusControl() {
  const { id, state, live } = useComp();

  async function setStatus(status: CompetitionStatus) {
    if (status === state.status) return;
    // Starting: freeze the shooting order of every rank, so late arrivals don't reshuffle pairs.
    const freeze =
      status === "warmup" || status === "round1"
        ? ranksInShootingOrder(state)
            .filter((r) => !state.orders.has(r.code))
            .map((r) => ({
              type: "order.set" as const,
              payload: { rankCode: r.code, entryIds: effectiveOrder(state, r.code), source: "reverse_ranking" as const },
            }))
        : [];
    await emitMany(id, [...freeze, { type: "status.set", payload: { status } }]);
    if (status !== "break" && live?.pauseEndsAt) await updateLive(id, { pauseEndsAt: null });
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="text-xs text-faint">Fase</span>
      <div role="radiogroup" aria-label="Fase" className="flex gap-0.5 rounded-full border-[1.5px] border-border bg-surface p-[0.1875rem] text-xs font-semibold">
        {STATUSES.map((s) => {
          const on = state.status === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStatus(s.id)}
              className={`cursor-pointer rounded-full px-2.5 py-[0.3125rem] transition ${on ? "bg-yellow text-ink" : "text-muted hover:text-ink"}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const timeOnly = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });

/** Connection and sharing state, based on the last sync attempt (more reliable than navigator.onLine). */
function SyncBadge({ sync, unsynced, demo }: { sync: SyncStatus; unsynced: number; demo: boolean }) {
  const label: Record<SyncStatus["state"], string> = {
    idle: "Verbinden…",
    syncing: "Synchroniseren…",
    synced: "Online",
    offline: "Offline",
    lease: "Ander toestel actief",
    auth: "Niet aangemeld",
    error: sync.message ?? "Synchronisatie mislukt",
  };
  const dot = demo ? "var(--plate)" : sync.state === "synced" ? "var(--online)" : sync.state === "offline" || sync.state === "error" ? "var(--alert)" : "var(--yellow)";
  const title =
    sync.state === "synced" && sync.lastSyncAt
      ? `Gesynchroniseerd om ${timeOnly.format(new Date(sync.lastSyncAt))}`
      : sync.state === "offline"
        ? "Alles wordt lokaal bewaard en gedeeld zodra er verbinding is."
        : undefined;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-[0.8125rem] text-muted" aria-live="polite" title={title}>
      <span className="size-[0.4375rem] rounded-full" style={{ background: dot }} />
      {demo ? "Demo · niet gedeeld" : label[sync.state]}
      {!demo && unsynced > 0 && <span className="text-faint">· {unsynced} nog te delen</span>}
    </span>
  );
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center gap-3 px-6 py-24">
      <span className="text-[0.8125rem] font-bold tracking-[0.2em]">BKC</span>
      <h1 className="text-[1.75rem] font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-muted">{children}</p>}
      <Link href="/operator" className="font-semibold underline decoration-yellow decoration-2 underline-offset-4">
        Naar de wedstrijdleiding
      </Link>
    </main>
  );
}
