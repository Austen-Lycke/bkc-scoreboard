"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useQueryParam } from "@/lib/offline/url";
import { useMockTimer, type MockTimer } from "./data";
import { MockA, MockB, MockC, MockD, MockE } from "./mockups";

const COUNTS = [15, 8, 3];

const MOCKUPS: {
  key: string;
  title: string;
  sub: string;
  View: ComponentType<{ t: MockTimer; n?: number }>;
}[] = [
  {
    key: "e",
    title: "E · A + C",
    sub: "De lijst van A (een rij per schutter, elke reeks in een kolom) in de stijl van C: licht, schuine tabs. Gesorteerd op plaats, met de plaats links in het zwart, KD klein naast de naam en de punten in het geel. De rijen worden groter als er minder schutters op de lijn staan; een lege reeks is een streepje, en de namen bij „Hierna klaarmaken” schuiven op als ze niet passen.",
    View: MockE,
  },
  {
    key: "a",
    title: "A · Startlijst",
    sub: "Donker uitslagenbord in baanvolgorde. Elke reeks in een eigen kolom, het totaal in geel, de plaats in de groep met ▲▼.",
    View: MockA,
  },
  {
    key: "b",
    title: "B · Live klassement",
    sub: "De lijn gesorteerd op plaats, met goud/zilver/brons voor de top drie. De klok groot links, met de reeksen als balk.",
    View: MockB,
  },
  {
    key: "c",
    title: "C · Grote balken",
    sub: "Licht, voor de heldere clubzaal. Twee kolommen schuine balken: grootste namen, baannummer en totaal als tabs.",
    View: MockC,
  },
  {
    key: "d",
    title: "D · Officieel blad",
    sub: "Een uitslagenblad op het scherm: licht, dunne lijnen, Ronde 1 en 2 naast elkaar. De top drie licht geel.",
    View: MockD,
  },
];

const go = (key: string | null) => {
  history.pushState(null, "", key ? `?v=${key}` : location.pathname);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

/** The 120×67.5rem TV canvas, scaled to fit its box. */
function Fit({ children, className = "" }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setScale(Math.min(el.clientWidth / (120 * rem), el.clientHeight / (67.5 * rem)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className={`relative overflow-hidden ${className}`}>
      <div className="absolute left-1/2 top-1/2 h-[67.5rem] w-[120rem] origin-center" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

export function Gallery() {
  const v = useQueryParam("v");
  // The clock is the client's: nothing until hydrated.
  return v === undefined ? null : <Designs v={v} />;
}

function Designs({ v }: { v: string | null }) {
  const t = useMockTimer();
  const [n, setN] = useState(15);
  const open = MOCKUPS.find((m) => m.key === v);
  const counts = (dark: boolean) => (
    <span className="flex items-center gap-1">
      <span className={`px-2 ${dark ? "text-white/50" : "text-muted"}`}>Schutters</span>
      {COUNTS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setN(c);
          }}
          className={`cursor-pointer rounded-full px-3 py-1 font-semibold tabular-nums ${c === n ? "bg-yellow text-ink" : dark ? "hover:bg-white/15" : "bg-fill hover:bg-hover"}`}
        >
          {c}
        </button>
      ))}
    </span>
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const i = MOCKUPS.indexOf(open);
      if (e.key === "Escape") go(null);
      if (e.key === "ArrowRight") go(MOCKUPS[(i + 1) % MOCKUPS.length].key);
      if (e.key === "ArrowLeft") go(MOCKUPS[(i + MOCKUPS.length - 1) % MOCKUPS.length].key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (open) {
    return (
      <div className="group fixed inset-0 bg-black" onDoubleClick={() => document.documentElement.requestFullscreen?.()}>
        <Fit className="size-full">
          <open.View t={t} n={n} />
        </Fit>
        <nav className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/70 p-1.5 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" onClick={() => go(null)} className="cursor-pointer rounded-full px-3 py-1 hover:bg-white/15">
            ← Alle ontwerpen
          </button>
          {MOCKUPS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => go(m.key)}
              className={`cursor-pointer rounded-full px-3 py-1 font-semibold uppercase ${m === open ? "bg-yellow text-ink" : "hover:bg-white/15"}`}
            >
              {m.key}
            </button>
          ))}
          {open.key === "e" && counts(true)}
          <span className="px-2 text-white/50">← → wisselen · dubbelklik = volledig scherm</span>
        </nav>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-[100rem] flex-col gap-8 px-4 py-10 md:px-10">
      <div className="flex flex-col gap-2">
        <span className="self-start rounded-full bg-yellow px-3 py-1 text-sm font-bold">Ontwerp · alleen WSA</span>
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">TV tijdens een beurt, in olympische stijl</h1>
        <p className="max-w-[50rem] text-pretty text-lg text-muted">
          Vier richtingen voor het scherm „Nu aan de lijn&rdquo;, in de plaats van de blokken. Allemaal met dezelfde verzonnen beurt: Ronde 2, Volwassenen, 15 schutters, reeks 1
          ingevoerd en reeks 2 loopt. Klik een ontwerp om het op volledig scherm te bekijken (← → om te wisselen).
        </p>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {MOCKUPS.map((m) => (
          <div key={m.key} className={`flex flex-col gap-3 ${m.key === "e" ? "md:col-span-2" : ""}`}>
            <button type="button" onClick={() => go(m.key)} className="group cursor-pointer">
              <Fit className="aspect-video w-full rounded-card border border-border bg-black shadow-sm transition-shadow group-hover:shadow-lg">
                <m.View t={t} n={n} />
              </Fit>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xl font-semibold">{m.title}</span>
              {m.key === "e" && <span className="text-sm">{counts(false)}</span>}
            </div>
            <span className="max-w-[50rem] text-pretty text-muted">{m.sub}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
