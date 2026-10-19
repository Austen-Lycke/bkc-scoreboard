"use client";

import Link from "next/link";
import { useOffline } from "next/offline";
import { useEffect, useState } from "react";
import {
  DEMO_COMPETITION_ID,
  effectiveOrder,
  pendingShootoffs,
  ranksInShootingOrder,
  type CompetitionSnapshot,
  type CompetitionStatus,
} from "@/lib/competition";
import { ACTIVE_COMPETITION_KEY, setMeta } from "@/lib/offline/db";
import { emitMany, resetDemo, saveSnapshot, useLocalCompetition } from "@/lib/offline/store";
import { openTvWindow } from "@/lib/offline/tv-window";
import { useQueryParam } from "@/lib/offline/url";
import { CompetitionContext, useComp } from "./context";
import { Badge, Button } from "./ui";
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

export async function downloadSnapshot(competitionId: string): Promise<CompetitionSnapshot> {
  let res: Response;
  try {
    res = await fetch(`/api/operator/competitions/${competitionId}/snapshot`, { cache: "no-store" });
  } catch {
    throw new Error("Geen internetverbinding. Deze wedstrijd staat nog niet op dit toestel: laad ze eerst terwijl je online bent.");
  }
  if (res.status === 401) throw new Error("Je bent niet aangemeld. Meld je aan via /login en open de wedstrijd opnieuw.");
  if (res.status === 403) throw new Error("Je account heeft geen toegang tot de wedstrijdleiding.");
  if (res.status === 404) throw new Error("Deze wedstrijd bestaat niet (meer).");
  if (!res.ok) throw new Error(`Downloaden mislukt (${res.status}).`);
  return res.json();
}

function Shell() {
  const { state, unsynced, id } = useComp();
  const offline = useOffline();
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
            <ConnectionBadge offline={offline} unsynced={unsynced} demo={!!state.snapshot.isDemo} />
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

function ConnectionBadge({ offline, unsynced, demo }: { offline: boolean; unsynced: number; demo: boolean }) {
  return (
    <span className="flex items-center gap-2 text-xs text-muted" aria-live="polite">
      <span className={`size-2 rounded-full ${offline ? "bg-red-500" : "bg-[var(--hit)]"}`} />
      {offline ? "Offline: alles wordt lokaal bewaard" : "Online"}
      {!demo && unsynced > 0 && <Badge>{unsynced} lokaal</Badge>}
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
