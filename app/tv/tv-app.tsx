"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  competitionProgress,
  competitionSchedule,
  entryTotal,
  passOf,
  pendingShootoffs,
  rankName,
  ranksInShootingOrder,
  setupForRank,
  standingsFor,
  tvName,
  heatKey,
  type CompetitionState,
} from "@/lib/competition";
import { ACTIVE_COMPETITION_KEY, getMeta, type LiveRecord, type ShootoffDraft } from "@/lib/offline/db";
import { useLocalCompetition } from "@/lib/offline/store";
import { useQueryParam } from "@/lib/offline/url";
import { iterationScore, passKey, scorePass, type Heat, type Setup } from "@/lib/scoring";
import { HeatProgress } from "@/components/heat-progress";
import { Plate, plateRows, type PlateLook } from "@/components/plates";
import { formatClock, useNow } from "@/components/use-now";
import { CLUB_TIME_ZONE } from "@/components/public/format";

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
        <>
          <TopBar name="" />
          <Centered
            title="BKC Wedstrijden"
            sub={local === null || (fromUrl === null && active === undefined) ? "Open het TV-scherm vanuit de wedstrijdleiding op dit toestel." : ""}
          />
        </>
      )}
    </Stage>
  );
}

/** A fixed 1920×1080 canvas, scaled to fit any screen; cursor hidden when idle; one-click fullscreen. */
function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(0.5);
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
      className={`fixed inset-0 overflow-hidden bg-[#e9e9e4] text-ink ${idle ? "cursor-none" : ""}`}
      onDoubleClick={() => document.documentElement.requestFullscreen?.()}
    >
      <div
        style={{ width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}
        className="absolute left-1/2 top-1/2 box-border flex origin-center flex-col gap-8 bg-background px-20 pb-14 pt-12"
      >
        {children}
      </div>
      {!fullscreen && !idle && (
        <button
          type="button"
          onClick={() => document.documentElement.requestFullscreen?.()}
          className="absolute right-4 top-4 cursor-pointer rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-black"
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

const longDay = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: CLUB_TIME_ZONE });
const welcomeDate = (date: string) => {
  const s = longDay.format(new Date(`${date}T12:00:00Z`));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** "Lotte D. & Mathis C." */
const heatNames = (state: CompetitionState, heat: Heat) => heat.shooters.map((e) => tvName(state, e)).join(" & ");
const heatMeta = (state: CompetitionState, heat: Heat) => `Ronde ${heat.round} · ${rankName(state, heat.rankCode)}`;

function Screen({ state, live }: { state: CompetitionState; live: LiveRecord | undefined }) {
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const phaseIndex = focusIndex >= 0 ? live!.focus!.phaseIndex : (progress.phaseIndex ?? 0);
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const comp = state.snapshot.competition;
  const firstUp = heat ? { label: "Als eerste", names: heatNames(state, heat), meta: heatMeta(state, heat) } : null;
  const shooting = (state.status === "round1" || state.status === "round2") && heat;

  let body: ReactNode;
  switch (state.status) {
    case "prepared": {
      const n = [...state.entries.values()].filter((e) => !e.withdrawn).length;
      const sub = [welcomeDate(comp.date), comp.location, n > 0 ? `${n} schutters ingeschreven` : null].filter(Boolean).join(" · ");
      body = <Centered kicker="Welkom" title={comp.name} sub={sub} bar={n > 0 ? firstUp : null} />;
      break;
    }
    case "warmup":
      body = <Centered title="Opwarming" bar={firstUp} />;
      break;
    case "break":
      body = <Pause state={state} live={live} schedule={schedule} heat={heat} />;
      break;
    case "shootoff":
      body = live?.shootoff ? <ShootoffLive state={state} draft={live.shootoff} /> : <ShootoffWaiting state={state} />;
      break;
    case "finished":
      body = <Centered kicker={comp.name} title="Einde wedstrijd" sub="Bedankt aan alle schutters, juryleden en supporters." />;
      break;
    default:
      body = heat ? (
        <LiveHeat state={state} live={live} schedule={schedule} heatIndex={heatIndex!} phaseIndex={Math.min(phaseIndex, heat.phases.length - 1)} />
      ) : (
        <Centered kicker={comp.name} title="Alle beurten geschoten" sub="De uitslag volgt." />
      );
  }

  return (
    <>
      <TopBar
        name={comp.name}
        phase={shooting ? null : PHASE_LABEL[state.status]}
        progress={shooting ? <HeatProgress variant="tv" rounds={schedule.map((h) => h.round)} current={progress.heatIndex} className="w-[760px]" /> : null}
      />
      {body}
    </>
  );
}

function TopBar({ name, phase, progress }: { name: string; phase?: string | null; progress?: ReactNode }) {
  const [time, setTime] = useState("");
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("nl-BE", { hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const t = setInterval(tick, 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <header className="flex flex-none items-center gap-12">
      <span className="text-[32px] font-bold tracking-[0.2em]">BKC</span>
      <span className="truncate text-[32px] text-muted">{name}</span>
      <div className="flex-1" />
      {phase && <span className="text-[32px] font-semibold">{phase}</span>}
      {progress}
      <span className="ml-6 text-[32px] tabular-nums text-muted">{time}</span>
    </header>
  );
}

const TV_HIT: PlateLook = { background: "var(--yellow)", color: "var(--ink)", borderColor: "var(--yellow)", borderWidth: "3px" };
const TV_OPEN: PlateLook = { background: "transparent", color: "rgba(255,255,255,.55)", borderColor: "rgba(255,255,255,.3)", borderWidth: "3px" };

function TvPlates({ setup, look, scale, gap }: { setup: Setup; look: (targetId: string) => PlateLook; scale: number; gap: number }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {plateRows(setup).map((row, r) => (
        <div key={r} className="flex items-end justify-center" style={{ gap }}>
          {row.map((t) => {
            const d = Math.round(t.sizeMm * scale);
            return (
              <Plate key={t.id} size={`${d}px`} fontSize={`${Math.max(18, Math.round(d * 0.36))}px`} look={look(t.id)}>
                {t.points}
              </Plate>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function LiveHeat({
  state,
  live,
  schedule,
  heatIndex,
  phaseIndex,
}: {
  state: CompetitionState;
  live: LiveRecord | undefined;
  schedule: Heat[];
  heatIndex: number;
  phaseIndex: number;
}) {
  const heat = schedule[heatIndex];
  const phase = heat.phases[phaseIndex];
  const knockdowns = state.snapshot.competition.knockdowns;
  const setup = setupForRank(state.snapshot, heat.rankCode);
  const heatsInRank = schedule.filter((h) => h.round === heat.round && h.rankCode === heat.rankCode).length;
  const next = schedule[heatIndex + 1];
  const hitsOf = (entryId: string, kd: number) => live?.drafts[passKey(entryId, heat.round, kd)] ?? passOf(state, entryId, heat.round, kd)?.hits ?? [];
  const liveTotal = (entryId: string, kd: number) =>
    entryTotal(state, entryId) - (passOf(state, entryId, heat.round, kd)?.score ?? 0) + scorePass(setup, hitsOf(entryId, kd));
  const columns = Array.from({ length: knockdowns }, () => "minmax(0,1fr)").join(" 2px ");

  return (
    <>
      <section className="flex flex-none flex-col gap-5 rounded-[44px] bg-ink px-16 pb-10 pt-9 text-white">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-yellow px-[26px] py-2 text-[34px] font-bold text-ink">Nu aan de lijn</span>
          <span className="text-[34px] text-white/60">
            Ronde {heat.round} · {rankName(state, heat.rankCode)} · beurt {heat.index + 1}/{heatsInRank}
            {phaseIndex > 0 ? " · gewisseld" : ""}
          </span>
        </div>
        <div className="grid gap-14" style={{ gridTemplateColumns: columns }}>
          {Array.from({ length: knockdowns }, (_, i) => i + 1).flatMap((kd) => {
            const a = phase.find((s) => s.knockdown === kd);
            const divider = kd > 1 ? [<span key={`d${kd}`} className="bg-white/12" />] : [];
            if (!a) {
              return [
                ...divider,
                <div key={kd} className="flex min-w-0 flex-col gap-4">
                  <div className="text-[30px] text-white/50">Knockdown {kd}</div>
                  <div className="text-[56px] font-semibold text-white/30">vrij in deze fase</div>
                </div>,
              ];
            }
            const hits = hitsOf(a.entryId, kd);
            return [
              ...divider,
              <div key={kd} className="flex min-w-0 flex-col gap-4">
                <div className="min-w-0">
                  <div className="text-[30px] text-white/50">Knockdown {kd}</div>
                  <div className="truncate text-[88px] font-semibold leading-[1.02] tracking-[-0.03em]">{tvName(state, a.entryId)}</div>
                </div>
                <div className="flex items-end justify-between gap-8">
                  <TvPlates setup={setup} scale={0.62} gap={14} look={(id) => (hits.includes(id) ? TV_HIT : TV_OPEN)} />
                  <div className="text-right">
                    <div className="text-[132px] font-semibold leading-[0.8] tracking-[-0.04em] text-yellow tabular-nums">{scorePass(setup, hits)}</div>
                    <div className="mt-[18px] text-[30px] text-white/60">totaal {liveTotal(a.entryId, kd)}</div>
                  </div>
                </div>
              </div>,
            ];
          })}
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-[600px_minmax(0,1fr)] gap-8">
        <section className="flex flex-col gap-[14px] rounded-[36px] border-[3px] border-border bg-surface px-11 py-10">
          <span className="text-[30px] font-semibold text-muted">Hierna klaarmaken</span>
          {next ? (
            <>
              {next.shooters.map((e) => (
                <span key={e} className="truncate text-[64px] font-semibold leading-[1.05] tracking-[-0.02em]">
                  {tvName(state, e)}
                </span>
              ))}
              <span className="mt-auto text-[28px] text-muted">
                {heatMeta(state, next)} · beurt {next.index + 1}
                {next.shooters.length === 1 && knockdowns > 1
                  ? ` · alleen op KD ${Array.from({ length: knockdowns }, (_, k) => k + 1).join(" en ")}`
                  : ""}
              </span>
            </>
          ) : (
            <span className="text-[48px] font-semibold text-muted">Dit is de laatste beurt</span>
          )}
        </section>
        <LiveStandings state={state} heat={heat} phase={phase} hitsOf={hitsOf} setup={setup} />
      </div>
    </>
  );
}

/** The shooting rank: the top two and the shooters on the line, with the others folded away. */
function LiveStandings({
  state,
  heat,
  phase,
  hitsOf,
  setup,
}: {
  state: CompetitionState;
  heat: Heat;
  phase: Heat["phases"][number];
  hitsOf: (entryId: string, kd: number) => string[];
  setup: Setup;
}) {
  const { rounds, knockdowns } = state.snapshot.competition;
  const cols: [number, number][] = [];
  for (let r = 1; r <= rounds; r++) for (let k = 1; k <= knockdowns; k++) cols.push([r, k]);
  const rows = standingsFor(state, heat.rankCode)
    .rows.filter((r) => !r.withdrawn)
    .map((r) => {
      const onLine = phase.find((s) => s.entryId === r.entryId);
      const passes = cols.map(([round, kd]) => {
        if (onLine && round === heat.round && kd === onLine.knockdown) return { state: "live" as const, score: scorePass(setup, hitsOf(r.entryId, kd)) };
        const p = passOf(state, r.entryId, round, kd);
        return p ? { state: "shot" as const, score: p.score } : { state: "open" as const, score: 0 };
      });
      return { entryId: r.entryId, live: !!onLine, passes, total: passes.reduce((n, p) => n + p.score, 0) };
    })
    .sort((a, b) => b.total - a.total);
  const ranked = rows.map((r) => ({ ...r, pos: 1 + rows.filter((x) => x.total > r.total).length }));
  let show = ranked.map((_, i) => i);
  if (ranked.length > 5) show = [...new Set([0, 1, ...ranked.flatMap((r, i) => (r.live ? [i] : []))])].sort((a, b) => a - b);

  const items: ReactNode[] = [];
  show.forEach((i, j) => {
    if (j > 0 && i > show[j - 1] + 1) items.push(<Gap key={`g${i}`} />);
    const r = ranked[i];
    items.push(
      <div key={r.entryId} className={`-mx-[18px] flex items-center gap-6 rounded-[14px] px-[18px] py-0.5 leading-[1.2] ${r.live ? "bg-yellow-light" : ""}`}>
        <span className={`w-[52px] text-[34px] font-semibold tabular-nums ${r.live ? "text-ink" : "text-subtle"}`}>{r.pos}</span>
        <span className={`min-w-0 flex-1 truncate text-[34px] ${r.live ? "font-bold" : "font-medium"}`}>{tvName(state, r.entryId)}</span>
        <div className="flex gap-2">
          {r.passes.map((p, k) => (
            <span
              key={k}
              className="box-border size-4 rounded-full border-[2.5px]"
              style={{
                background: p.state === "live" ? "var(--yellow)" : p.state === "shot" ? "var(--ink)" : "transparent",
                borderColor: p.state === "open" ? "var(--plate)" : "var(--ink)",
              }}
            />
          ))}
        </div>
        <span className="w-[90px] text-right text-[36px] font-semibold tabular-nums">{r.total}</span>
      </div>,
    );
  });
  if (show.length && show[show.length - 1] < ranked.length - 1) items.push(<Gap key="end" text={`${ranked.length} schutters`} />);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[36px] border-[3px] border-border bg-surface px-11 pb-6 pt-[26px]">
      <div className="flex items-baseline justify-between pb-1">
        <span className="text-[30px] font-semibold">Voorlopige stand · {rankName(state, heat.rankCode)}</span>
        <span className="text-[24px] text-subtle">passages</span>
      </div>
      <div className="flex flex-1 flex-col justify-between">{items}</div>
    </section>
  );
}

function Gap({ text }: { text?: string }) {
  return (
    <div className="flex items-center gap-6 pl-0.5 text-[28px] leading-none tracking-[0.3em] text-plate">
      ···{text && <span className="text-[22px] tracking-normal text-subtle">{text}</span>}
    </div>
  );
}

function Pause({ state, live, schedule, heat }: { state: CompetitionState; live: LiveRecord | undefined; schedule: Heat[]; heat: Heat | null }) {
  const end = live?.pauseEndsAt ? Date.parse(live.pauseEndsAt) : null;
  const now = useNow(1000, end !== null);
  const left = end === null ? 0 : Math.max(0, Math.ceil((end - now) / 1000));
  const nextRound = heat?.round ?? null;
  const { rounds, knockdowns } = state.snapshot.competition;
  const roundDone = (r: number) => schedule.filter((h) => h.round === r).every((h) => h.phases.flat().every((a) => state.passes.has(passKey(a.entryId, r, a.knockdown))));
  const doneRounds = Array.from({ length: rounds }, (_, i) => i + 1).filter(roundDone).length;
  const ranks = ranksInShootingOrder(state).filter((r) => standingsFor(state, r.code).rows.some((x) => !x.withdrawn));

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[520px_minmax(0,1fr)] gap-10">
      <div className="flex min-h-0 flex-col gap-8">
        <div className="flex flex-1 flex-col justify-center gap-5">
          <span className="self-start rounded-full bg-yellow px-[26px] py-2 text-[34px] font-bold">Pauze</span>
          {end !== null ? (
            <>
              <span className="text-[36px] text-muted">
                {nextRound ? `Ronde ${nextRound} begint ${left > 0 ? "over" : "zo"}` : left > 0 ? "We gaan verder over" : "We gaan zo verder"}
              </span>
              <span className="text-[210px] font-semibold leading-[0.85] tracking-[-0.05em] tabular-nums">{formatClock(left)}</span>
            </>
          ) : (
            <span className="text-[170px] font-semibold leading-[0.95] tracking-[-0.04em]">Pauze</span>
          )}
        </div>
        {heat && (
          <div className="flex flex-none flex-col gap-4 rounded-[44px] bg-ink px-12 py-10 text-white">
            <span className="self-start rounded-full bg-yellow px-[22px] py-1.5 text-[30px] font-bold text-ink">Als eerste</span>
            <span className="text-balance text-[60px] font-semibold leading-[1.05] tracking-[-0.03em]">{heatNames(state, heat)}</span>
            <span className="text-[30px] text-white/60">{heatMeta(state, heat)}</span>
          </div>
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-5">
        <div className="flex items-baseline justify-between">
          <span className="text-[40px] font-semibold tracking-[-0.02em]">{doneRounds > 0 ? `Voorlopige stand na ronde ${doneRounds}` : "Voorlopige stand"}</span>
          <span className="text-[26px] text-subtle">
            {doneRounds * knockdowns} van {rounds * knockdowns} passages
          </span>
        </div>
        <div
          className="grid min-h-0 flex-1 grid-cols-2 gap-5"
          style={{ gridTemplateRows: `repeat(${Math.max(1, Math.ceil(ranks.length / 2))}, minmax(0, 1fr))` }}
        >
          {ranks.map((rank) => {
            const rows = standingsFor(state, rank.code).rows.filter((r) => !r.withdrawn);
            return (
              <div key={rank.code} className="flex min-h-0 min-w-0 flex-col gap-1.5 rounded-[32px] border-[3px] border-border bg-surface px-[30px] pb-[18px] pt-5">
                <span className="flex-none text-[26px] font-semibold text-muted">{rank.name}</span>
                <Marquee>
                  {rows.map((r) => (
                    <div key={r.entryId} className="flex items-baseline gap-4 leading-[1.18]">
                      <span className={`w-10 text-[28px] font-semibold tabular-nums ${r.position === 1 ? "text-ink" : "text-subtle"}`}>{r.position ?? "–"}</span>
                      <span className={`min-w-0 flex-1 truncate text-[30px] ${r.position === 1 ? "font-bold" : "font-medium"}`}>{tvName(state, r.entryId)}</span>
                      <span className="text-[32px] font-semibold tabular-nums">{r.total}</span>
                    </div>
                  ))}
                </Marquee>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A list that fits stays put. One that doesn't scrolls slowly upwards in a loop (after a short
 * pause), with a fade at the bottom, so every shooter passes by during the break.
 */
function Marquee({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const vp = viewport.current;
    const tr = track.current;
    if (!vp || !tr) return;
    const first = tr.firstElementChild as HTMLElement | null;
    const measure = () => setOverflow(!!first && first.offsetHeight > vp.clientHeight + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    if (first) ro.observe(first);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tr = track.current;
    if (!overflow || !tr) {
      if (tr) tr.style.transform = "";
      return;
    }
    let offset = 0;
    let hold = 3000;
    let last: number | null = null;
    let raf = 0;
    const step = (t: number) => {
      const dt = last === null ? 0 : Math.min(64, t - last);
      last = t;
      const height = (tr.firstElementChild as HTMLElement).offsetHeight + 4;
      hold -= dt;
      if (hold <= 0) offset = (offset + dt * 0.03) % height;
      tr.style.transform = `translateY(${-offset}px)`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [overflow]);

  const mask = overflow ? "linear-gradient(#000 0, #000 calc(100% - 32px), transparent)" : undefined;
  return (
    <div ref={viewport} className="min-h-0 flex-1 overflow-hidden" style={{ maskImage: mask, WebkitMaskImage: mask }}>
      <div ref={track} className="flex flex-col gap-1 will-change-transform">
        <div className="flex flex-col gap-1">{children}</div>
        {overflow && (
          <div aria-hidden className="flex flex-col gap-1">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

function ShootoffWaiting({ state }: { state: CompetitionState }) {
  const next = pendingShootoffs(state)[0];
  if (!next) return <Centered kicker="Afkamping" title="Alle gelijke standen zijn beslecht" />;
  const group = next.groups[0];
  const position = standingsFor(state, next.rankCode).rows.find((r) => r.entryId === group[0])?.position;
  return (
    <Centered
      kicker="Afkamping"
      title={rankName(state, next.rankCode)}
      bar={{
        label: "Gelijke stand",
        names: group.map((e) => tvName(state, e)).join(" & "),
        meta: `${entryTotal(state, group[0])} punten${position ? ` · plaats ${position}` : ""}`,
      }}
    />
  );
}

function ShootoffLive({ state, draft }: { state: CompetitionState; draft: ShootoffDraft }) {
  const setup = setupForRank(state.snapshot, draft.rankCode);
  const label = (id: string) => setup.targets.find((t) => t.id === id)?.label ?? id;
  const last = draft.calls.length - 1;
  const lastId = last >= 0 ? draft.calls[last].targetId : null;
  const iteration = {
    participants: draft.participants,
    calls: draft.calls,
    results: Object.fromEntries(draft.participants.map((p) => [p, draft.results[p].map(Boolean)])),
  };

  return (
    <>
      <div className="flex flex-none items-end justify-between gap-10">
        <div className="flex flex-col gap-5">
          <span className="self-start rounded-full bg-yellow px-[26px] py-2 text-[34px] font-bold">Afkamping · {rankName(state, draft.rankCode)}</span>
          <span className="text-[110px] font-semibold leading-[0.95] tracking-[-0.04em]">{lastId ? `Geroepen: ${label(lastId)}` : "Wachten op het eerste doel"}</span>
        </div>
        <div className="flex flex-col items-end gap-[14px]">
          <span className="text-[30px] text-muted">
            {draft.calls.length} van {setup.targets.length} doelen geroepen
          </span>
          <div className="flex gap-2.5">
            {draft.calls.map((c, i) => (
              <span key={c.targetId} className={`rounded-full px-[18px] py-1.5 text-[26px] font-semibold ${i === last ? "bg-yellow" : "bg-fill"}`}>
                {label(c.targetId)}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 auto-cols-[minmax(0,1fr)] grid-flow-col gap-8">
        {draft.participants.map((p) => {
          const result = lastId ? draft.results[p][last] : null;
          return (
            <section key={p} className="flex min-w-0 flex-col items-center gap-5 rounded-[44px] bg-ink px-14 py-11 text-white">
              <span
                className="max-w-full truncate font-semibold leading-[1.05] tracking-[-0.03em]"
                style={{ fontSize: draft.participants.length > 2 ? 56 : 72 }}
              >
                {tvName(state, p)}
              </span>
              <div className="flex flex-1 flex-col justify-center">
                <TvPlates
                  setup={setup}
                  scale={0.9}
                  gap={18}
                  look={(id) => {
                    const i = draft.calls.findIndex((c) => c.targetId === id);
                    const called = i >= 0;
                    const hit = called && draft.results[p][i] === true;
                    const isLast = id === lastId;
                    return {
                      background: hit ? "var(--yellow)" : "transparent",
                      color: hit ? "var(--ink)" : called ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.2)",
                      borderColor: isLast || hit ? "var(--yellow)" : called ? "rgba(255,255,255,.35)" : "rgba(255,255,255,.12)",
                      borderWidth: isLast ? "7px" : "3px",
                    };
                  }}
                />
              </div>
              <div className="flex items-baseline gap-6">
                <span className="text-[150px] font-semibold leading-[0.8] tracking-[-0.04em] text-yellow tabular-nums">{iterationScore(iteration, p)}</span>
                {lastId && result !== null && <span className="text-[30px] text-white/60">{`${label(lastId)} ${result ? "raak" : "mis"}`}</span>}
              </div>
            </section>
          );
        })}
      </div>
      <div className="flex flex-none gap-9 text-[26px] text-muted">
        <span className="flex items-center gap-3">
          <span className="size-[22px] rounded-full bg-yellow" />
          raak
        </span>
        <span className="flex items-center gap-3">
          <span className="box-border size-[22px] rounded-full border-[3px] border-muted opacity-50" />
          mis
        </span>
        <span className="flex items-center gap-3">
          <span className="box-border size-[22px] rounded-full border-[5px] border-yellow bg-ink" />
          zojuist geroepen
        </span>
        <span>· nog niet geroepen doelen staan gedimd</span>
      </div>
    </>
  );
}

function Centered({
  kicker,
  title,
  sub,
  bar,
}: {
  kicker?: string;
  title: string;
  sub?: string;
  bar?: { label: string; names: string; meta: string } | null;
}) {
  return (
    <>
      <div className="flex flex-1 flex-col justify-center gap-7 px-5">
        {kicker && <span className="self-start rounded-full bg-yellow px-[26px] py-2 text-[34px] font-bold">{kicker}</span>}
        <span className="text-balance text-[170px] font-semibold leading-[0.95] tracking-[-0.04em]">{title}</span>
        {sub && <span className="max-w-[1400px] text-pretty text-[40px] text-muted">{sub}</span>}
      </div>
      {bar && (
        <div className="flex flex-none items-center gap-14 rounded-[44px] bg-ink px-16 py-11 text-white">
          <span className="whitespace-nowrap rounded-full bg-yellow px-[26px] py-2 text-[34px] font-bold text-ink">{bar.label}</span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <span className="text-balance text-[68px] font-semibold leading-[1.05] tracking-[-0.03em]">{bar.names}</span>
            <span className="text-[32px] text-white/60">{bar.meta}</span>
          </div>
        </div>
      )}
    </>
  );
}
