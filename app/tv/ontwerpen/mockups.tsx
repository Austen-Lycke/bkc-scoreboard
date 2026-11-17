"use client";

import type { CSSProperties, ReactNode } from "react";
import { COND, slantLeft, slantRight, Ticker } from "../parts/frame";
import { BY_PLACE, GROUP_SIZE, LINE, NEXT, type MockShooter, type MockTimer } from "./data";

const MEDAL: Record<number, string> = {
  1: "var(--yellow)",
  2: "#d6d6d0",
  3: "#c98b55",
};

function Running({ className = "" }: { className?: string }) {
  return <span className={`inline-block size-[0.875rem] animate-pulse rounded-full bg-yellow ${className}`} />;
}

function Move({ m, dark }: { m: number; dark?: boolean }) {
  if (m === 0) return <span className={dark ? "text-white/30" : "text-subtle"}>=</span>;
  const up = m > 0;
  const color = up ? (dark ? "#6fd08f" : "var(--good)") : dark ? "#ff8a73" : "var(--alert)";
  return (
    <span style={{ color }} className="whitespace-nowrap">
      {up ? "▲" : "▼"}
      {Math.abs(m)}
    </span>
  );
}

const score = (v: number | null, running: ReactNode = <Running />) => (v === null ? running : v);

/* ------------------------------------------------------------------------------------------------ */
/* A · Startlijst: a dark results board in lane order, every series in its own column.              */
/* ------------------------------------------------------------------------------------------------ */

const GRID_A = "grid grid-cols-[5rem_minmax(0,1fr)_6.5rem_6.5rem_6.5rem_6.5rem_10rem_9rem] items-center gap-x-6";

export function MockA({ t }: { t: MockTimer }) {
  return (
    <div className="flex size-full flex-col gap-5 bg-ink px-[4.5rem] pb-11 pt-10 text-white">
      <header className="flex h-[8rem] flex-none items-stretch gap-10">
        <div className="flex items-center bg-yellow pl-8 pr-16 text-ink" style={slantRight("2.5rem")}>
          <span className={`${COND} text-[4rem] font-extrabold tracking-[0.04em]`}>BKC</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
          <span className="text-[1.5rem] font-semibold uppercase tracking-[0.28em] text-white/45">WSA · Clubwedstrijd · Beurt 2 van 3</span>
          <span className={`${COND} truncate text-[4.5rem] font-bold uppercase leading-[0.95]`}>
            Ronde 2 <span className="text-white/35">/</span> Volwassenen
          </span>
        </div>
        <div className="relative flex items-center gap-7 overflow-hidden rounded-[0.75rem] bg-white/[0.08] px-9">
          <div className="flex flex-col items-end">
            <span className={`${COND} text-[2.25rem] font-bold uppercase leading-none text-yellow`}>Reeks {t.series}</span>
            <span className="text-[1.375rem] uppercase tracking-[0.2em] text-white/45">van {t.of}</span>
          </div>
          <span className={`${COND} w-[13rem] text-[6.5rem] font-bold leading-none tabular-nums ${t.warn ? "text-yellow" : ""}`}>{t.clock}</span>
          <span className="absolute bottom-0 left-0 h-[0.375rem] bg-yellow" style={{ width: `${t.progress * 100}%` }} />
        </div>
      </header>

      <div className={`${GRID_A} flex-none border-b-[0.1875rem] border-white/15 px-6 pb-3 text-[1.25rem] font-semibold uppercase tracking-[0.2em] text-white/45`}>
        <span>KD</span>
        <span>Schutter</span>
        <span className="text-right">R1 · 1</span>
        <span className="text-right">R1 · 2</span>
        <span className="text-right text-white/70">R2 · 1</span>
        <span className="text-right text-white/70">R2 · 2</span>
        <span className="text-right">Totaal</span>
        <span className="text-right">Plaats</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {LINE.map((s) => (
          <div key={s.lane} className={`${GRID_A} min-h-0 flex-1 px-6 odd:bg-white/[0.045]`}>
            <span className={`${COND} flex h-[2.5rem] w-[3.75rem] items-center justify-center rounded-[0.375rem] bg-white/12 text-[1.875rem] font-bold tabular-nums`}>
              {s.lane}
            </span>
            <span className={`${COND} truncate text-[2.375rem] leading-none`}>
              <span className="font-bold uppercase">{s.last}</span> <span className="text-white/65">{s.first}</span>
            </span>
            {[...s.r1, ...s.r2].map((v, k) => (
              <span key={k} className={`${COND} text-right text-[2.125rem] tabular-nums ${k < 2 ? "text-white/45" : "text-white/85"}`}>
                {score(v)}
              </span>
            ))}
            <span className={`${COND} text-right text-[2.875rem] font-bold leading-none text-yellow tabular-nums`}>{s.total}</span>
            <span className={`${COND} flex items-baseline justify-end gap-3 text-[2.125rem] font-semibold tabular-nums`}>
              <span className="text-[1.375rem]">
                <Move m={s.move} dark />
              </span>
              {s.place}
            </span>
          </div>
        ))}
      </div>

      <footer className="flex flex-none items-center gap-8 border-t-[0.1875rem] border-yellow pt-5">
        <span className={`${COND} whitespace-nowrap text-[2rem] font-bold uppercase tracking-[0.06em] text-yellow`}>Hierna klaarmaken</span>
        <span className="min-w-0 flex-1 truncate text-[1.875rem] text-white/75">{NEXT.join(" · ")}</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* B · Live klassement: the line sorted by place in the group, medals and moves, the clock aside.    */
/* ------------------------------------------------------------------------------------------------ */

const GRID_B = "grid grid-cols-[6.5rem_4.5rem_minmax(0,1fr)_6rem_7rem_7rem_9.5rem] items-center gap-x-6";

export function MockB({ t }: { t: MockTimer }) {
  return (
    <div className="grid size-full grid-cols-[38rem_minmax(0,1fr)] bg-[#0b0b0b] text-white">
      <aside className="flex min-h-0 flex-col gap-10 bg-ink px-14 pb-12 pt-11">
        <div className="flex items-center gap-5">
          <span className="flex items-center gap-3 rounded-[0.375rem] bg-live px-4 py-1.5 text-[1.5rem] font-bold uppercase tracking-[0.15em]">
            <span className="size-[0.75rem] animate-pulse rounded-full bg-white" /> Live
          </span>
          <span className="text-[1.5rem] font-semibold uppercase tracking-[0.25em] text-white/45">BKC · WSA</span>
        </div>
        <div className="flex flex-col gap-3">
          <span className={`${COND} whitespace-nowrap text-[8.5rem] font-extrabold uppercase leading-[0.82]`}>Ronde 2</span>
          <span className="text-[2.25rem] text-white/60">Volwassenen · beurt 2 van 3</span>
        </div>

        <div className="mt-auto flex flex-col gap-5">
          <div className="flex gap-2">
            <div className="flex flex-1 flex-col gap-2">
              <span className="h-[0.75rem] rounded-[0.125rem] bg-white/80" />
              <span className="text-[1.375rem] uppercase tracking-[0.15em] text-white/45">Reeks 1</span>
            </div>
            <div className="flex w-[3rem] flex-col gap-2">
              <span className="h-[0.75rem] rounded-[0.125rem] bg-white/80" />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <span className="relative h-[0.75rem] overflow-hidden rounded-[0.125rem] bg-white/15">
                <span className="absolute inset-y-0 left-0 bg-yellow" style={{ width: `${t.progress * 100}%` }} />
              </span>
              <span className="text-[1.375rem] uppercase tracking-[0.15em] text-yellow">Reeks 2</span>
            </div>
          </div>
          <span className={`${COND} text-[13rem] font-bold leading-[0.78] tabular-nums ${t.warn ? "text-yellow" : ""}`}>{t.clock}</span>
        </div>

        <div className="flex flex-col gap-3 border-t-[0.125rem] border-white/12 pt-7">
          <span className={`${COND} text-[1.875rem] font-bold uppercase tracking-[0.06em] text-yellow`}>Hierna · beurt 3</span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[1.5rem] leading-[1.25] text-white/70">
            {NEXT.slice(0, 9).map((n) => (
              <span key={n} className="truncate">
                {n}
              </span>
            ))}
            <span className="text-white/40">+{NEXT.length - 9} anderen</span>
          </div>
        </div>
      </aside>

      <main className="flex min-h-0 flex-col gap-3 px-12 pb-11 pt-11">
        <div className="flex flex-none items-baseline justify-between pb-2">
          <span className={`${COND} text-[3rem] font-bold uppercase leading-none`}>Tussenstand op de lijn</span>
          <span className="text-[1.5rem] uppercase tracking-[0.2em] text-white/45">Plaats in de groep · {GROUP_SIZE} schutters</span>
        </div>
        <div className={`${GRID_B} flex-none px-0 text-[1.25rem] font-semibold uppercase tracking-[0.2em] text-white/40`}>
          <span className="text-center">Pl</span>
          <span />
          <span>Schutter</span>
          <span className="text-center">KD</span>
          <span className="text-right">R1</span>
          <span className="text-right">R2</span>
          <span className="pr-6 text-right">Totaal</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-[0.375rem]">
          {BY_PLACE.map((s) => (
            <RowB key={s.lane} s={s} />
          ))}
        </div>
      </main>
    </div>
  );
}

function RowB({ s }: { s: MockShooter }) {
  const medal = MEDAL[s.place];
  const r2 = (s.r2[0] ?? 0) + (s.r2[1] ?? 0);
  return (
    <div className={`${GRID_B} min-h-0 flex-1 bg-white/[0.06]`}>
      <span
        className={`${COND} flex h-full items-center justify-center text-[2.5rem] font-extrabold tabular-nums`}
        style={{
          ...slantRight("1rem"),
          background: medal ?? "rgba(255,255,255,0.12)",
          color: medal ? "var(--ink)" : "white",
        }}
      >
        {s.place}
      </span>
      <span className={`${COND} text-[1.5rem] font-semibold tabular-nums`}>
        <Move m={s.move} dark />
      </span>
      <span className={`${COND} truncate text-[2.375rem] leading-none`}>
        <span className="font-bold uppercase">{s.last}</span> <span className="text-white/65">{s.first}</span>
      </span>
      <span className={`${COND} text-center text-[1.75rem] text-white/45 tabular-nums`}>{s.lane}</span>
      <span className={`${COND} text-right text-[2rem] text-white/50 tabular-nums`}>{s.r1[0] + s.r1[1]}</span>
      <span className={`${COND} flex items-center justify-end gap-3 text-right text-[2rem] text-white/85 tabular-nums`}>
        {r2}
        <Running className="size-[0.625rem]" />
      </span>
      <span className={`${COND} flex h-full items-center justify-end bg-white/[0.07] pr-6 text-[2.875rem] font-bold text-yellow tabular-nums`}>{s.total}</span>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* C · Grote balken: the bright club room, two columns of broad slanted bars, names as big as can.   */
/* ------------------------------------------------------------------------------------------------ */

export function MockC({ t }: { t: MockTimer }) {
  return (
    <div className="flex size-full flex-col gap-6 bg-background px-[4.5rem] pb-11 pt-10 text-ink">
      <header className="flex h-[9.5rem] flex-none items-stretch gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-10 bg-ink pl-12 pr-24 text-white" style={slantRight("3rem")}>
          <span className={`${COND} text-[3.5rem] font-extrabold tracking-[0.04em] text-yellow`}>BKC</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={`${COND} truncate text-[4.75rem] font-bold uppercase leading-[0.9]`}>Ronde 2 · Volwassenen</span>
            <span className="text-[1.75rem] text-white/60">Beurt 2 van 3 · 15 schutters op de lijn</span>
          </div>
        </div>
        <div className="relative flex w-[36rem] items-center justify-end gap-8 bg-yellow pl-20 pr-10" style={slantLeft("3rem")}>
          <span className={`${COND} text-[2.5rem] font-bold uppercase leading-[0.95]`}>
            Reeks
            <br />
            {t.series} van {t.of}
          </span>
          <span className={`${COND} text-[8rem] font-bold leading-none tabular-nums ${t.warn ? "text-alert" : ""}`}>{t.clock}</span>
          <span className="absolute bottom-0 left-0 h-[0.5rem] bg-ink" style={{ width: `${t.progress * 100}%` }} />
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-flow-col grid-cols-2 grid-rows-[repeat(8,minmax(0,1fr))] gap-x-10 gap-y-3">
        {LINE.map((s) => (
          <div key={s.lane} className="flex min-h-0 items-stretch bg-surface shadow-[0_0.125rem_0_var(--border)]">
            <span
              className={`${COND} flex w-[7rem] flex-none items-center justify-center bg-ink pr-4 text-[3.25rem] font-bold text-yellow tabular-nums`}
              style={slantRight("1.25rem")}
            >
              {s.lane}
            </span>
            <div className="flex min-w-0 flex-1 items-center gap-6 pl-5 pr-4">
              <span className="min-w-0 flex-1 truncate text-[2.75rem] font-semibold leading-none tracking-[-0.02em]">
                {s.first} {s.last}
              </span>
              <span className="flex flex-col items-end text-[1.375rem] leading-[1.2] text-muted tabular-nums">
                <span>
                  R2 <b className="font-semibold text-ink">{s.r2[0]}</b> · {score(s.r2[1], <Running className="size-[0.625rem]" />)}
                </span>
                <span>
                  {s.place}e <Move m={s.move} />
                </span>
              </span>
            </div>
            <span className={`${COND} flex w-[9.5rem] flex-none items-center justify-center bg-yellow pl-4 text-[3.75rem] font-bold tabular-nums`} style={slantLeft("1.25rem")}>
              {s.total}
            </span>
          </div>
        ))}
        <div className="flex min-h-0 items-center gap-6 px-2 text-[1.5rem] text-muted">
          <span className="flex items-center gap-3">
            <Running className="size-[0.75rem]" /> reeks loopt
          </span>
          <span>▲▼ plaatsen t.o.v. vorige beurt</span>
        </div>
      </div>

      <footer className="flex h-[5rem] flex-none items-center gap-8 bg-ink pl-10 pr-16 text-white" style={slantRight("2rem")}>
        <span className={`${COND} whitespace-nowrap text-[2.25rem] font-bold uppercase text-yellow`}>Hierna klaarmaken</span>
        <span className="min-w-0 flex-1 truncate text-[1.875rem] text-white/80">{NEXT.join(", ")}</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* D · Officieel blad: a printed results sheet on screen, light, thin rules, the clock in one box.  */
/* ------------------------------------------------------------------------------------------------ */

const GRID_D = "grid grid-cols-[5rem_minmax(0,1fr)_6rem_6rem_1.5rem_6rem_6rem_9rem_8rem] items-center gap-x-5";

export function MockD({ t }: { t: MockTimer }) {
  return (
    <div className="relative flex size-full flex-col bg-surface px-[4.5rem] pb-10 pt-12 text-ink">
      <span className="absolute inset-x-0 top-0 h-[0.75rem] bg-yellow" />
      <header className="flex flex-none items-end justify-between gap-10 border-b-[0.25rem] border-ink pb-5">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-[1.5rem] font-semibold uppercase tracking-[0.28em] text-muted">Brugse Katapultclub · WSA</span>
          <span className="truncate text-[4.75rem] font-semibold leading-[0.95] tracking-[-0.03em]">Ronde 2 — Volwassenen</span>
          <span className="text-[1.875rem] text-muted">Startlijst en tussenstand · beurt 2 van 3</span>
        </div>
        <div className="flex flex-none items-center gap-7 rounded-[1rem] bg-ink px-9 py-4 text-white">
          <span className="flex flex-col text-[1.625rem] font-semibold uppercase leading-[1.1] tracking-[0.12em] text-yellow">
            <span>Reeks {t.series}</span>
            <span className="text-white/45">van {t.of}</span>
          </span>
          <span className={`text-[6rem] font-semibold leading-none tracking-[-0.04em] tabular-nums ${t.warn ? "text-yellow" : ""}`}>{t.clock}</span>
        </div>
      </header>

      <div className={`${GRID_D} flex-none pt-4 text-[1.25rem] font-semibold uppercase tracking-[0.18em] text-muted`}>
        <span />
        <span />
        <span className="col-span-2 border-b-[0.125rem] border-plate pb-1 text-center">Ronde 1</span>
        <span />
        <span className="col-span-2 border-b-[0.125rem] border-ink pb-1 text-center text-ink">Ronde 2</span>
        <span />
        <span />
      </div>
      <div className={`${GRID_D} flex-none border-b-[0.125rem] border-ink py-2 text-[1.25rem] font-semibold uppercase tracking-[0.18em] text-muted`}>
        <span className="text-center">KD</span>
        <span>Schutter</span>
        <span className="text-center">1</span>
        <span className="text-center">2</span>
        <span />
        <span className="text-center text-ink">1</span>
        <span className="text-center text-ink">2</span>
        <span className="text-right text-ink">Totaal</span>
        <span className="text-right">Plaats</span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col divide-y-[0.0625rem] divide-border">
        {LINE.map((s) => {
          const lead = s.place <= 3;
          return (
            <div key={s.lane} className={`${GRID_D} min-h-0 flex-1 leading-none ${lead ? "bg-yellow-light" : ""}`}>
              <span className="mx-auto flex size-[2.5rem] items-center justify-center rounded-full border-[0.15625rem] border-ink text-[1.375rem] font-semibold tabular-nums">
                {s.lane}
              </span>
              <span className="truncate text-[2.125rem] leading-none">
                <span className="font-semibold uppercase tracking-[0.02em]">{s.last}</span> <span className="text-muted">{s.first}</span>
              </span>
              {s.r1.map((v, k) => (
                <span key={`r1${k}`} className="text-center text-[1.875rem] text-subtle tabular-nums">
                  {v}
                </span>
              ))}
              <span />
              {s.r2.map((v, k) => (
                <span key={`r2${k}`} className="text-center text-[2rem] font-medium tabular-nums">
                  {v === null ? <span className="rounded-full bg-yellow px-3 py-0.5 text-[1.125rem] font-bold uppercase tracking-[0.1em]">nu</span> : v}
                </span>
              ))}
              <span className="text-right text-[2.5rem] font-bold tracking-[-0.02em] tabular-nums">{s.total}</span>
              <span className="flex items-center justify-end gap-3 text-[2rem] font-semibold tabular-nums">
                <span className="text-[1.25rem]">
                  <Move m={s.move} />
                </span>
                {MEDAL[s.place] ? (
                  <span className="flex size-[2.5rem] items-center justify-center rounded-full text-[1.5rem] font-bold" style={{ background: MEDAL[s.place] }}>
                    {s.place}
                  </span>
                ) : (
                  s.place
                )}
              </span>
            </div>
          );
        })}
      </div>

      <footer className="flex flex-none items-baseline gap-6 border-t-[0.25rem] border-ink pt-4 text-[1.625rem]">
        <span className="whitespace-nowrap font-semibold uppercase tracking-[0.12em]">Hierna</span>
        <span className="min-w-0 flex-1 truncate text-muted">{NEXT.join(", ")}</span>
        <span className="whitespace-nowrap text-subtle">Plaats in de groep van {GROUP_SIZE}</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------ */
/* E · A + C: A's list (one row per frame, every series in a column) in C's look: light, slanted     */
/* tabs, the frame and the place in ink, the points in yellow. Rows grow when fewer shooters stand.  */
/* ------------------------------------------------------------------------------------------------ */

type Tier = {
  lane: string;
  score: string;
  total: string;
  place: string;
  name: string;
  num: string;
  sc: string;
  tot: string;
  mv: string;
  slot: string;
  gap: string;
  max: string;
  cut: string;
};

const TIERS: Record<"s" | "m" | "l", Tier> = {
  // 11–15 on the line.
  s: {
    lane: "5rem",
    score: "6.5rem",
    total: "9.5rem",
    place: "8.5rem",
    name: "text-[2.25rem]",
    num: "text-[2rem]",
    sc: "text-[1.875rem]",
    tot: "text-[2.625rem]",
    mv: "text-[1.125rem]",
    slot: "2.25rem",
    gap: "0.375rem",
    max: "100%",
    cut: "0.875rem",
  },
  // 6–10.
  m: {
    lane: "6rem",
    score: "7rem",
    total: "11rem",
    place: "10.5rem",
    name: "text-[3.125rem]",
    num: "text-[2.875rem]",
    sc: "text-[2.5rem]",
    tot: "text-[3.75rem]",
    mv: "text-[1.375rem]",
    slot: "2.75rem",
    gap: "0.625rem",
    max: "6.5rem",
    cut: "1.25rem",
  },
  // 5 or fewer: the final.
  l: {
    lane: "7rem",
    score: "7.5rem",
    total: "13rem",
    place: "12rem",
    name: "text-[4rem]",
    num: "text-[4rem]",
    sc: "text-[3.25rem]",
    tot: "text-[5.25rem]",
    mv: "text-[1.625rem]",
    slot: "3.25rem",
    gap: "1rem",
    max: "9.5rem",
    cut: "1.75rem",
  },
};

export function MockE({ t, n = 15 }: { t: MockTimer; n?: number }) {
  // Like a results board: by place, the place up front. KD stays, small, so a shooter finds their frame.
  const line = LINE.slice(0, n).sort((a, b) => a.place - b.place || a.lane - b.lane);
  const z = TIERS[n > 10 ? "s" : n > 5 ? "m" : "l"];
  const cols: CSSProperties = {
    gridTemplateColumns: `${z.place} minmax(0,1fr) ${z.lane} ${z.score} ${z.score} ${z.score} ${z.score} ${z.total}`,
  };

  return (
    <div className="flex size-full flex-col gap-5 bg-background px-[4.5rem] pb-11 pt-10 text-ink">
      <header className="flex h-[8.5rem] flex-none items-stretch gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-10 bg-ink pl-12 pr-24 text-white" style={slantRight("3rem")}>
          <span className={`${COND} text-[3.5rem] font-extrabold tracking-[0.04em] text-yellow`}>BKC</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={`${COND} truncate text-[4.5rem] font-bold uppercase leading-[0.9]`}>Ronde 2 · Volwassenen</span>
            <span className="text-[1.75rem] text-white/60">Beurt 2 van 3</span>
          </div>
        </div>
        <div className="relative flex w-[36rem] items-center justify-end gap-8 bg-yellow pl-20 pr-10" style={slantLeft("3rem")}>
          <span className={`${COND} text-[2.5rem] font-bold uppercase leading-[0.95]`}>
            Reeks
            <br />
            {t.series} van {t.of}
          </span>
          <span className={`${COND} text-[7.5rem] font-bold leading-none tabular-nums ${t.warn ? "text-alert" : ""}`}>{t.clock}</span>
          <span className="absolute bottom-0 left-0 h-[0.5rem] bg-ink" style={{ width: `${t.progress * 100}%` }} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col justify-center" style={{ gap: z.gap }}>
        <div className="grid flex-none items-end pb-1 text-[1.25rem] font-semibold uppercase tracking-[0.2em] text-muted" style={cols}>
          <span style={{ paddingLeft: `calc(1rem + ${z.slot})` }}>Plaats</span>
          <span className="pl-6">Schutter</span>
          <span className="text-center">KD</span>
          <span className="text-center">R1 · 1</span>
          <span className="text-center">R1 · 2</span>
          <span className="text-center text-ink">R2 · 1</span>
          <span className="text-center text-ink">R2 · 2</span>
          <span className="text-center text-ink">Totaal</span>
        </div>

        {line.map((s) => (
          <div key={s.lane} className="grid min-h-0 flex-1 items-stretch bg-surface leading-none shadow-[0_0.125rem_0_var(--border)]" style={{ ...cols, maxHeight: z.max }}>
            {/* The arrow in a slot of its own, so every place number starts at the same line. No change, no mark. */}
            <span
              className={`${COND} grid items-center bg-ink pl-4 font-bold text-yellow tabular-nums ${z.num}`}
              style={{
                ...slantRight(z.cut),
                gridTemplateColumns: `${z.slot} 1fr`,
              }}
            >
              <span className={`font-semibold ${z.mv}`}>{s.move !== 0 && <Move m={s.move} dark />}</span>
              <span>{s.place}</span>
            </span>
            <span className={`${COND} flex min-w-0 items-center pl-6 pr-4 ${z.name}`}>
              <span className="truncate">
                <span className="font-bold uppercase">{s.first}</span> <span className="text-muted">{s.last}</span>
              </span>
            </span>
            <span className={`${COND} flex items-center justify-center text-muted tabular-nums ${z.sc}`}>{s.lane}</span>
            {[...s.r1, ...s.r2].map((v, k) => (
              <span key={k} className={`${COND} flex items-center justify-center tabular-nums ${z.sc} ${k < 2 ? "text-subtle" : "font-semibold"}`}>
                {v ?? "–"}
              </span>
            ))}
            <span className={`${COND} flex items-center justify-center bg-yellow pl-3 font-bold tabular-nums ${z.tot}`} style={slantLeft(z.cut)}>
              {s.total}
            </span>
          </div>
        ))}
      </div>

      <footer className="flex h-[4.75rem] flex-none items-center gap-8 bg-ink pl-10 pr-16 text-white" style={slantRight("2rem")}>
        <span className={`${COND} whitespace-nowrap text-[2.25rem] font-bold uppercase text-yellow`}>Hierna klaarmaken</span>
        <Ticker className="flex-1 text-[1.875rem] text-white/80">{NEXT.join(" · ")}</Ticker>{" "}
      </footer>
    </div>
  );
}
