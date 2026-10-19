"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEMO_COMPETITION_ID,
  effectiveOrder,
  pendingShootoffs,
  ranksInShootingOrder,
  type CompetitionStatus,
} from "@/lib/competition";
import { downloadSnapshot } from "@/lib/offline/api";
import { ACTIVE_COMPETITION_KEY, setMeta } from "@/lib/offline/db";
import { emitMany, resetDemo, saveSnapshot, useLocalCompetition } from "@/lib/offline/store";
import { syncNow, useSyncLoop, useSyncStatus, type SyncStatus } from "@/lib/offline/sync";
import { openTvWindow } from "@/lib/offline/tv-window";
import { useQueryParam } from "@/lib/offline/url";
import { CompetitionContext, useComp } from "./context";
import { Badge, Button } from "@/components/ui";
import { CheckInView } from "./views/check-in";
import { CloseView } from "./views/close";
import { OrderView } from "./views/order";
import { PrepareView } from "./views/prepare";
import { ScoringView } from "./views/scoring";
import { ShootoffView } from "./views/shootoff";
import { StandingsView } from "./views/standings";

type Tab = "prepare" | "checkin" | "order" | "scoring" | "standings" | "shootoff" | "close";

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

function Shell() {
  const { state, unsynced, id } = useComp();
  const demo = !!state.snapshot.isDemo;
  useSyncLoop(id, !demo, unsynced);
  const sync = useSyncStatus(id);
  const pending = pendingShootoffs(state).reduce((n, r) => n + r.groups.length, 0);
  const [tab, setTab] = useState<Tab>(() =>
    state.status === "prepared" ? "checkin" : state.status === "finished" ? "close" : "scoring",
  );
  const comp = state.snapshot.competition;

  const tabs: { id: Tab; label: string; badge?: string | number }[] = [
    { id: "prepare", label: "Voorbereiden" },
    { id: "checkin", label: "Inschrijving", badge: state.entries.size },
    { id: "order", label: "Volgorde" },
    { id: "scoring", label: "Scoren" },
    { id: "standings", label: "Stand" },
    { id: "shootoff", label: "Afkamping", badge: pending || undefined },
    { id: "close", label: "Afronden" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
          <div className="min-w-0">
            <Link href="/operator" className="text-xs font-semibold uppercase tracking-widest text-gold">
              ← Wedstrijdleiding
            </Link>
            <h1 className="truncate text-lg font-semibold leading-tight">
              {comp.name} {state.snapshot.isDemo && <Badge tone="gold">demo</Badge>}
            </h1>
          </div>
          <StatusControl />
          <div className="ml-auto flex items-center gap-3">
            <SyncBadge sync={sync} unsynced={unsynced} demo={demo} />
            <Button tone="primary" onClick={() => openTvWindow(id)}>
              TV openen
            </Button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3" aria-label="Onderdelen">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
                tab === t.id ? "border-gold text-foreground" : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {t.badge !== undefined && <Badge tone={t.id === "shootoff" ? "red" : "neutral"}>{t.badge}</Badge>}
            </button>
          ))}
        </nav>
      </header>
      {sync.state === "lease" && (
        <div className="flex flex-wrap items-center gap-3 border-b border-amber-300 bg-amber-50 px-5 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Een ander toestel beheert deze wedstrijd{sync.message ? ` (${sync.message})` : ""}. Wat je hier invoert wordt pas gedeeld als je overneemt.
          <Button
            size="sm"
            onClick={() => confirm("Deze wedstrijd overnemen? Het andere toestel kan dan niets meer doorsturen.") && syncNow(id, { takeover: true })}
          >
            Overnemen
          </Button>
        </div>
      )}
      {sync.state === "auth" && (
        <p className="border-b border-amber-300 bg-amber-50 px-5 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Je sessie is verlopen: alles blijft lokaal bewaard. <Link href="/login" target="_blank" className="underline">Meld opnieuw aan</Link> om weer te synchroniseren.
        </p>
      )}
      {state.rejected.length > 0 && (
        <p className="border-b border-red-300 bg-red-50 px-5 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {state.rejected.length} actie(s) konden niet toegepast worden: {state.rejected.at(-1)!.reason}
        </p>
      )}
      <main className="flex-1 p-5">
        {tab === "prepare" && <PrepareView />}
        {tab === "checkin" && <CheckInView />}
        {tab === "order" && <OrderView />}
        {tab === "scoring" && <ScoringView />}
        {tab === "standings" && <StandingsView />}
        {tab === "shootoff" && <ShootoffView />}
        {tab === "close" && <CloseView />}
      </main>
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
  const { id, state } = useComp();

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
  }

  return (
    <div role="radiogroup" aria-label="Fase" className="flex flex-wrap rounded-lg border border-border p-0.5">
      {STATUSES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={state.status === s.id}
          onClick={() => setStatus(s.id)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
            state.status === s.id ? "bg-navy text-white dark:bg-gold dark:text-navy" : "text-muted hover:text-foreground"
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

const timeOnly = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" });

/** Connection and sharing state, based on the last sync attempt (more reliable than navigator.onLine). */
function SyncBadge({ sync, unsynced, demo }: { sync: SyncStatus; unsynced: number; demo: boolean }) {
  if (demo) return <span className="text-xs text-muted">Demo: niet gedeeld</span>;
  const label: Record<SyncStatus["state"], string> = {
    idle: "Verbinden…",
    syncing: "Synchroniseren…",
    synced: sync.lastSyncAt ? `Gesynchroniseerd ${timeOnly.format(new Date(sync.lastSyncAt))}` : "Gesynchroniseerd",
    offline: "Offline: alles wordt lokaal bewaard",
    lease: "Ander toestel actief",
    auth: "Niet aangemeld",
    error: sync.message ?? "Synchronisatie mislukt",
  };
  const dot = sync.state === "synced" ? "bg-[var(--hit)]" : sync.state === "offline" || sync.state === "error" ? "bg-red-500" : "bg-amber-500";
  return (
    <span className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span className={`size-2 rounded-full ${dot}`} />
      {label[sync.state]}
      {unsynced > 0 && <Badge>{unsynced} nog te delen</Badge>}
    </span>
  );
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center gap-3 px-6 py-24">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children && <p className="text-muted">{children}</p>}
      <Link href="/operator" className="text-gold underline underline-offset-4">
        Naar de wedstrijdleiding
      </Link>
    </main>
  );
}
