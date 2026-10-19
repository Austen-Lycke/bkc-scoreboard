"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Knockdown } from "@/components/knockdown";
import {
  competitionProgress,
  competitionSchedule,
  entryName,
  entryTotal,
  heatKey,
  passOf,
  pendingShootoffs,
  rankName,
  setupForRank,
  standingsFor,
  type CompetitionState,
} from "@/lib/competition";
import { ACTIVE_COMPETITION_KEY, getMeta, type LiveRecord } from "@/lib/offline/db";
import { useLocalCompetition } from "@/lib/offline/store";
import { useQueryParam } from "@/lib/offline/url";
import { iterationScore, passKey, scorePass, type Heat } from "@/lib/scoring";

const W = 1920;
const H = 1080;

export function TvApp() {
  const fromUrl = useQueryParam("c");
  const active = useLiveQuery(() => getMeta(ACTIVE_COMPETITION_KEY), []);
  const competitionId = fromUrl ?? active ?? null;
  const local = useLocalCompetition(competitionId);

  return (
    <Stage>
      {local ? (
        <Screen state={local.state} live={local.live} />
      ) : (
        <Centered title="BKC Wedstrijden">
          {local === null || (fromUrl === null && active === undefined) ? "Open het TV-scherm vanuit de wedstrijdleiding op dit toestel." : ""}
        </Centered>
      )}
    </Stage>
  );
}

/** A fixed 1920×1080 canvas, scaled to fit any screen; cursor hidden when idle; one-click fullscreen. */
function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  const [idle, setIdle] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener("resize", fit);
    let timer: ReturnType<typeof setTimeout>;
    const wake = () => {
      setIdle(false);
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), 2500);
    };
    wake();
    window.addEventListener("mousemove", wake);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("mousemove", wake);
      document.removeEventListener("fullscreenchange", onFs);
      clearTimeout(timer);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center overflow-hidden bg-[#050b14] text-white ${idle ? "cursor-none" : ""}`}
      onDoubleClick={() => document.documentElement.requestFullscreen?.()}
    >
      <div
        style={{ width: W, height: H, transform: `scale(${scale})` }}
        className="relative shrink-0 origin-center bg-[radial-gradient(ellipse_at_top,#13233b_0%,#0a1424_55%,#050b14_100%)]"
      >
        {children}
      </div>
      {!fullscreen && !idle && (
        <button
          type="button"
          onClick={() => document.documentElement.requestFullscreen?.()}
          className="absolute right-4 top-4 rounded-lg bg-white/10 px-4 py-2 text-sm font-medium backdrop-blur hover:bg-white/20"
        >
          Volledig scherm
        </button>
      )}
    </div>
  );
}

const PHASE_LABEL: Record<CompetitionState["status"], string> = {
  prepared: "",
  warmup: "Opwarming",
  round1: "Ronde 1",
  break: "Pauze",
  round2: "Ronde 2",
  shootoff: "Afkamping",
  finished: "Einde wedstrijd",
};

function Screen({ state, live }: { state: CompetitionState; live: LiveRecord | undefined }) {
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const phaseIndex = focusIndex >= 0 ? live!.focus!.phaseIndex : (progress.phaseIndex ?? 0);
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const upcoming = heatIndex === null ? [] : schedule.slice(heatIndex + 1, heatIndex + 4);

  let body: ReactNode;
  switch (state.status) {
    case "prepared":
      body = (
        <Centered title={state.snapshot.competition.name} kicker="Welkom">
          {state.entries.size > 0 ? `${state.entries.size} schutters ingeschreven` : ""}
        </Centered>
      );
      break;
    case "warmup":
    case "break":
      body = <Waiting title={PHASE_LABEL[state.status]} state={state} heat={heat} />;
      break;
    case "shootoff":
      body = <Shootoff state={state} live={live} />;
      break;
    case "finished":
      body = (
        <Centered title="Einde wedstrijd" kicker={state.snapshot.competition.name}>
          Bedankt aan alle schutters, juryleden en supporters.
        </Centered>
      );
      break;
    default:
      body = heat ? (
        <LiveHeat state={state} live={live} heat={heat} phaseIndex={Math.min(phaseIndex, heat.phases.length - 1)} upcoming={upcoming} />
      ) : (
        <Centered title="Alle beurten geschoten" kicker={state.snapshot.competition.name}>
          De uitslag volgt.
        </Centered>
      );
  }

  return (
    <div className="flex h-full flex-col">
      <TopBar state={state} heat={state.status === "round1" || state.status === "round2" ? heat : null} />
      <div className="relative flex-1">{body}</div>
    </div>
  );
}

function TopBar({ state, heat }: { state: CompetitionState; heat: Heat | null }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit" });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);
  const heatsInRank = heat ? competitionSchedule(state).filter((h) => h.round === heat.round && h.rankCode === heat.rankCode).length : 0;

  return (
    <header className="flex h-[120px] items-center justify-between border-b border-white/10 px-16">
      <div className="flex items-center gap-6">
        <span className="text-[34px] font-bold tracking-[0.2em] text-[var(--gold)]">BKC</span>
        <span className="text-[30px] font-medium text-white/80">{state.snapshot.competition.name}</span>
      </div>
      <div className="flex items-center gap-10 text-[30px]">
        {heat ? (
          <span>
            <span className="font-semibold">Ronde {heat.round}</span>
            <span className="mx-4 text-white/30">·</span>
            <span className="font-semibold text-[var(--gold)]">{rankName(state, heat.rankCode)}</span>
            <span className="mx-4 text-white/30">·</span>
            <span className="text-white/70">
              Beurt {heat.index + 1}/{heatsInRank}
            </span>
          </span>
        ) : (
          <span className="font-semibold">{PHASE_LABEL[state.status]}</span>
        )}
        <span className="tabular-nums text-white/50">{time}</span>
      </div>
    </header>
  );
}

function LiveHeat({ state, live, heat, phaseIndex, upcoming }: { state: CompetitionState; live: LiveRecord | undefined; heat: Heat; phaseIndex: number; upcoming: Heat[] }) {
  const phase = heat.phases[phaseIndex];
  const knockdowns = state.snapshot.competition.knockdowns;
  const setup = setupForRank(state.snapshot, heat.rankCode);
  const standings = standingsFor(state, heat.rankCode);

  return (
    <div className="flex h-full flex-col">
      <div className="relative grid flex-1 grid-cols-2 gap-10 px-16 pt-10">
        {Array.from({ length: knockdowns }, (_, i) => i + 1).map((kd) => {
          const a = phase.find((s) => s.knockdown === kd);
          if (!a) return <div key={kd} className="rounded-[28px] border border-white/5" />;
          const hits = live?.drafts[passKey(a.entryId, heat.round, kd)] ?? passOf(state, a.entryId, heat.round, kd)?.hits ?? [];
          const score = scorePass(setup, hits);
          const saved = passOf(state, a.entryId, heat.round, kd);
          const total = entryTotal(state, a.entryId) - (saved?.score ?? 0) + score;
          const position = standings.rows.find((r) => r.entryId === a.entryId)?.position;
          return (
            <section key={kd} className="flex flex-col rounded-[28px] border border-white/10 bg-white/[0.04] px-12 py-9">
              <div className="flex items-center justify-between">
                <span className="text-[22px] font-semibold uppercase tracking-[0.25em] text-white/50">Knockdown {kd}</span>
                {phaseIndex > 0 && <span className="rounded-full bg-[var(--gold)]/20 px-4 py-1 text-[20px] font-semibold text-[var(--gold)]">gewisseld</span>}
              </div>
              <h2 className="mt-3 truncate text-[64px] font-semibold leading-tight">{entryName(state, a.entryId)}</h2>
              <div className="flex flex-1 items-center justify-center">
                <Knockdown setup={setup} hits={hits} variant="tv" className="h-[380px] w-auto max-w-full" />
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[22px] uppercase tracking-[0.2em] text-white/50">Deze beurt</p>
                  <p className="text-[110px] font-semibold leading-none tabular-nums text-[var(--gold)]">{score}</p>
                </div>
                <div className="text-right">
                  <p className="text-[22px] uppercase tracking-[0.2em] text-white/50">Totaal</p>
                  <p className="text-[64px] font-semibold leading-none tabular-nums">{total}</p>
                  {position && <p className="mt-2 text-[26px] text-white/70">Plaats {position}</p>}
                </div>
              </div>
            </section>
          );
        })}
      </div>
      <NextUp state={state} heats={upcoming} />
    </div>
  );
}

function NextUp({ state, heats }: { state: CompetitionState; heats: Heat[] }) {
  return (
    <footer className="mt-8 flex h-[170px] items-center gap-10 border-t border-white/10 bg-black/20 px-16">
      <span className="text-[24px] font-semibold uppercase tracking-[0.25em] text-[var(--gold)]">Volgende</span>
      {heats.length === 0 ? (
        <span className="text-[30px] text-white/50">Laatste beurt</span>
      ) : (
        heats.map((h) => (
          <div key={heatKey(h)} className="min-w-0 flex-1 border-l border-white/10 pl-8">
            <p className="text-[20px] text-white/50">
              Ronde {h.round} · {rankName(state, h.rankCode)}
            </p>
            <p className="truncate text-[32px] font-semibold">{h.shooters.map((e) => entryName(state, e)).join(" & ")}</p>
          </div>
        ))
      )}
    </footer>
  );
}

function Waiting({ title, state, heat }: { title: string; state: CompetitionState; heat: Heat | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-14">
      <h1 className="text-[150px] font-semibold tracking-tight">{title}</h1>
      {heat && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-[28px] uppercase tracking-[0.25em] text-[var(--gold)]">
            Als eerste: ronde {heat.round} · {rankName(state, heat.rankCode)}
          </p>
          <p className="text-[64px] font-semibold">{heat.shooters.map((e) => entryName(state, e)).join("  &  ")}</p>
        </div>
      )}
    </div>
  );
}

function Shootoff({ state, live }: { state: CompetitionState; live: LiveRecord | undefined }) {
  const draft = live?.shootoff;
  if (!draft) {
    const next = pendingShootoffs(state)[0];
    return (
      <Centered title="Afkamping" kicker={next ? rankName(state, next.rankCode) : undefined}>
        {next ? next.groups[0].map((e) => entryName(state, e)).join("  ·  ") : "Alle gelijke standen zijn beslecht."}
      </Centered>
    );
  }
  const setup = setupForRank(state.snapshot, draft.rankCode);
  const lastCall = draft.calls.at(-1);
  const iteration = {
    participants: draft.participants,
    calls: draft.calls,
    results: Object.fromEntries(draft.participants.map((p) => [p, draft.results[p].map(Boolean)])),
  };

  return (
    <div className="flex h-full flex-col px-16 pt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[26px] uppercase tracking-[0.25em] text-[var(--gold)]">Afkamping · {rankName(state, draft.rankCode)}</p>
          <p className="mt-2 text-[72px] font-semibold">
            {lastCall ? `Geroepen: ${setup.targets.find((t) => t.id === lastCall.targetId)?.label}` : "Wachten op het eerste doel"}
          </p>
        </div>
        <p className="text-[30px] text-white/60">
          {draft.calls.length}/{setup.targets.length} doelen
        </p>
      </div>
      <div className="mt-10 grid flex-1 gap-8" style={{ gridTemplateColumns: `repeat(${draft.participants.length}, minmax(0, 1fr))` }}>
        {draft.participants.map((p) => (
          <section key={p} className="flex flex-col items-center rounded-[28px] border border-white/10 bg-white/[0.04] p-10">
            <h2 className="text-center text-[52px] font-semibold">{entryName(state, p)}</h2>
            <Knockdown
              setup={setup}
              variant="tv"
              hits={draft.calls.filter((_, i) => draft.results[p][i]).map((c) => c.targetId)}
              highlight={lastCall?.targetId}
              className="mt-6 h-[330px] w-auto max-w-full"
            />
            <p className="mt-auto text-[120px] font-semibold leading-none tabular-nums text-[var(--gold)]">{iterationScore(iteration, p)}</p>
          </section>
        ))}
      </div>
    </div>
  );
}

function Centered({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-16 text-center">
      {kicker && <p className="text-[30px] uppercase tracking-[0.3em] text-[var(--gold)]">{kicker}</p>}
      <h1 className="text-[120px] font-semibold leading-none tracking-tight">{title}</h1>
      {children && <p className="max-w-[1400px] text-[40px] text-white/70">{children}</p>}
    </div>
  );
}
