"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  competitionProgress,
  competitionSchedule,
  isDemoId,
  effectiveOrder,
  groupsInShootingOrder,
  pendingShootoffs,
  roundTitle,
  type CompetitionState,
  type CompetitionStatus,
} from "@/lib/competition";
import { downloadSnapshot } from "@/lib/offline/api";
import { ACTIVE_COMPETITION_KEY, setMeta } from "@/lib/offline/db";
import { emitMany, resetDemo, saveSnapshot, updateLive, useLocalCompetition } from "@/lib/offline/store";
import { syncNow, useSyncLoop, useSyncStatus, type SyncStatus } from "@/lib/offline/sync";
import { openTvWindow } from "@/lib/offline/tv-window";
import { useQueryParam } from "@/lib/offline/url";
import { CompetitionContext, NavContext, useComp, useNav, type Tab } from "./context";
import { HeatProgress } from "@/components/heat-progress";
import { ScrollRow } from "@/components/scroll-row";
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
    if (isDemoId(competitionId)) {
      void resetDemo(competitionId);
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
  // Afronden's "beëindigen?" question; it closes again when the operator leaves that tab.
  const [askingFinish, setAskingFinish] = useState(false);
  const showTimer = state.status === "break" || state.status === "warmup" || !!live?.pauseEndsAt;
  const nav = useMemo(
    () => ({
      goTo: (t: Tab, kd?: number) => {
        setTab(t);
        setAskingFinish(false);
        if (kd) setActiveKd(kd);
      },
      askToFinish: () => {
        setTab("close");
        setAskingFinish(true);
      },
    }),
    [],
  );

  const badges: Partial<Record<Tab, number>> = { checkin: active, shootoff: pending };

  return (
    <NavContext.Provider value={nav}>
      {/*
        From a tablet up the app fills the screen and each view scrolls on its own, so the save
        button stays in view. On a phone the page simply scrolls.
      */}
      <div className="touch-targets flex min-h-dvh flex-col bg-background md:h-dvh md:min-h-[40rem]">
        <header className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2.5 px-4 pb-3 pt-4 sm:gap-x-6 sm:px-8 sm:pt-[1.125rem]">
          <Link href="/operator" title="Naar de wedstrijdleiding" className="text-[0.8125rem] font-bold tracking-[0.2em]">
            BKC
          </Link>
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] text-muted md:max-w-[16rem] md:flex-none">
            {state.snapshot.competition.name}
            {demo && " · demo"}
          </span>
          {/* Phone: on a line of its own under the header, full width. */}
          <HeatProgress
            variant="operator"
            rounds={schedule.map((h) => h.round)}
            current={progress.heatIndex}
            endLabel={schedule.length ? roundTitle(state, schedule.at(-1)!.round) : undefined}
            className="order-last basis-full md:order-none md:mx-auto md:max-w-[35rem] md:flex-1 md:basis-auto"
          />
          <SyncBadge sync={sync} unsynced={unsynced} demo={demo} onSync={() => syncNow(id)} />
          <button
            type="button"
            onClick={() => openTvWindow(id)}
            title="TV-scherm openen"
            className="cursor-pointer rounded-full border-[0.09375rem] border-ink px-[0.875rem] py-1.5 text-[0.8125rem] font-semibold hover:bg-hover"
          >
            TV
          </button>
        </header>
        <nav className="flex flex-none flex-wrap items-center gap-x-1 gap-y-2 px-4 pb-2.5 sm:px-8" aria-label="Onderdelen">
          {/* Phone: the tabs and the phase each scroll sideways on one line. From a tablet up they wrap. */}
          <ScrollRow active={tab} className={`flex gap-1 ${BLEED} md:contents`}>
            {TABS.map((t) => {
              const on = t.id === tab;
              const badge = badges[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => nav.goTo(t.id)}
                  aria-current={on ? "page" : undefined}
                  className={`flex flex-none cursor-pointer items-center gap-[0.4375rem] whitespace-nowrap rounded-full px-[0.875rem] py-[0.4375rem] text-sm font-semibold transition ${
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
          </ScrollRow>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 max-md:w-full md:ml-auto md:justify-end">
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
          {tab === "close" && <CloseView asking={askingFinish} setAsking={setAskingFinish} />}
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
  return <div className="flex flex-none flex-col gap-2 px-4 pb-2.5 sm:px-8">{items}</div>;
}

/** A scrolling line runs to the edges of the screen, past the page padding (PHONE_BLEED: below md only). */
const BLEED = "-mx-4 w-[calc(100%+2rem)] px-4 sm:-mx-8 sm:w-[calc(100%+4rem)] sm:px-8";
const PHONE_BLEED =
  "max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:px-4 max-md:sm:-mx-8 max-md:sm:w-[calc(100%+4rem)] max-md:sm:px-8";

const startPause = (competitionId: string, minutes: number) =>
  updateLive(competitionId, { pauseEndsAt: new Date(Date.now() + minutes * 60_000).toISOString() });

/** The break (or warmup) countdown the TV shows. Kept in the live record, so it never ends up in the results. */
function PauseTimer() {
  const { id, state, live } = useComp();
  const warmup = state.status === "warmup";
  const end = live?.pauseEndsAt ? Date.parse(live.pauseEndsAt) : null;
  const now = useNow(1000, end !== null);
  const left = end === null ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
  const done = end !== null && left === 0;

  return (
    <div
      className={`scroll-row flex max-w-full items-center gap-2 rounded-full border-[0.09375rem] border-border py-[0.1875rem] pl-[0.875rem] pr-[0.1875rem] text-xs font-semibold ${
        done ? "bg-yellow" : "bg-surface"
      }`}
    >
      <span className="flex-none font-medium text-faint">
        <span className="max-sm:hidden">{warmup ? "Opwarmtimer op TV" : "Pauzetimer op TV"}</span>
        <span className="sm:hidden">Timer</span>
      </span>
      {end === null ? (
        <div className="flex gap-0.5">
          {(warmup ? [5] : [5, 10, 15, 20]).map((m) => (
            <button key={m} type="button" onClick={() => startPause(id, m)} className="cursor-pointer rounded-full px-2.5 py-[0.3125rem] hover:bg-fill">
              {m} min
            </button>
          ))}
        </div>
      ) : (
        <>
          <span className="px-1 text-sm tabular-nums">{done ? (warmup ? "Opwarming voorbij" : "Pauze voorbij") : formatClock(left)}</span>
          <button
            type="button"
            onClick={() =>
              updateLive(id, (current) => ({
                pauseEndsAt: new Date(Math.max(Date.parse(current.pauseEndsAt ?? ""), Date.now()) + 5 * 60_000).toISOString(),
              }))
            }
            className="cursor-pointer rounded-full border-[0.09375rem] border-border px-2.5 py-[0.3125rem]"
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
  { id: "semifinal", label: "Halve finale" },
  { id: "final", label: "Finale" },
  { id: "shootoff", label: "Afkamping" },
  { id: "finished", label: "Einde" },
];

/** The phases of this day: the semi-final and final only when the format has them switched on. */
function statusesOf(state: CompetitionState) {
  const ko = state.format.knockout;
  return STATUSES.filter((s) => (s.id === "semifinal" ? !!ko?.semifinal : s.id === "final" ? !!ko?.final : true));
}

/**
 * The phase of the day. Drives what the TV shows; scoring itself follows the schedule.
 * "Einde" locks scoring, so it asks first, on Afronden, where the open passages and ties are listed.
 */
function StatusControl() {
  const { id, state, live } = useComp();
  const { askToFinish } = useNav();

  async function setStatus(status: CompetitionStatus) {
    if (status === state.status) return;
    if (status === "finished") return askToFinish();
    // Starting: freeze the shooting order of every group, so late arrivals don't reshuffle heats.
    const freeze =
      status === "warmup" || status === "round1"
        ? groupsInShootingOrder(state)
            .filter((r) => !state.orders.has(r.code))
            .map((r) => ({
              type: "order.set" as const,
              payload: { rankCode: r.code, entryIds: effectiveOrder(state, r.code), source: "reverse_ranking" as const },
            }))
        : [];
    await emitMany(id, [...freeze, { type: "status.set", payload: { status } }]);
    // A timed day (WSA) counts the warmup down on the TV right away; any other phase stops a countdown.
    const warmup = state.format.timing?.warmupSeconds;
    if (status === "warmup" && warmup) await startPause(id, warmup / 60);
    else if (status !== "break" && live?.pauseEndsAt) await updateLive(id, { pauseEndsAt: null });
  }

  return (
    <ScrollRow active={state.status} className={`flex items-center gap-2.5 ${PHONE_BLEED}`}>
      <span className="flex-none text-xs text-faint">Fase</span>
      <div role="radiogroup" aria-label="Fase" className="flex flex-none gap-0.5 rounded-full border-[0.09375rem] border-border bg-surface p-[0.1875rem] text-xs font-semibold">
        {statusesOf(state).map((s) => {
          const on = state.status === s.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setStatus(s.id)}
              className={`cursor-pointer whitespace-nowrap rounded-full px-2.5 py-[0.3125rem] transition ${on ? "bg-yellow text-ink" : "text-muted hover:text-ink"}`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </ScrollRow>
  );
}

const timeOnly = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });

/**
 * Connection and sharing state, based on the last sync attempt (more reliable than navigator.onLine).
 * Tapping it syncs right away instead of waiting for the next heartbeat.
 */
function SyncBadge({ sync, unsynced, demo, onSync }: { sync: SyncStatus; unsynced: number; demo: boolean; onSync: () => void }) {
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
  // A long error message is cut off rather than pushing the header wider than a phone.
  const content = (
    <>
      <span className="size-[0.4375rem] flex-none rounded-full" style={{ background: dot }} />
      <span className="truncate">
        {demo ? "Demo · niet gedeeld" : label[sync.state]}
        {!demo && unsynced > 0 && <span className="text-faint"> · {unsynced} nog te delen</span>}
      </span>
    </>
  );
  if (demo) {
    return <span className="flex min-w-0 items-center gap-1.5 text-[0.8125rem] text-muted">{content}</span>;
  }
  return (
    <button
      type="button"
      onClick={onSync}
      disabled={sync.state === "syncing"}
      aria-live="polite"
      title={title ? `${title} Tik om nu te synchroniseren.` : "Tik om nu te synchroniseren."}
      className="-mx-2.5 flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.8125rem] text-muted hover:bg-hover hover:text-ink disabled:cursor-progress"
    >
      {content}
    </button>
  );
}

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <main className="touch-targets mx-auto flex max-w-lg flex-1 flex-col justify-center gap-3 px-6 py-24">
      <span className="text-[0.8125rem] font-bold tracking-[0.2em]">BKC</span>
      <h1 className="text-[1.75rem] font-semibold tracking-tight">{title}</h1>
      {children && <p className="text-muted">{children}</p>}
      <Link href="/operator" className="font-semibold underline decoration-yellow decoration-2 underline-offset-4">
        Naar de wedstrijdleiding
      </Link>
    </main>
  );
}
