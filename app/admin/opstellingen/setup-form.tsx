"use client";

import { useState, useTransition } from "react";
import { Plate, plateRows, type PlateLook } from "@/components/plates";
import { Pill } from "@/components/ui";
import { maxPassScore, type Setup } from "@/lib/scoring";
import { updateSetup } from "./actions";

// Phone: a narrower "rij · mm" column, on two lines.
const COLS = "grid grid-cols-[1.25rem_minmax(0,1fr)_3.75rem_3.5rem] items-center gap-2 sm:grid-cols-[1.5rem_minmax(0,1fr)_4.5rem_6.5rem]";
const input = "w-full min-w-0 rounded-[0.625rem] border-[0.09375rem] border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ink";
const PLATE: PlateLook = { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--ink)" };

export function SetupForm({ id, setup }: { id: string; setup: Setup }) {
  // Points stay text while typing, so the field can be emptied and retyped.
  const [targets, setTargets] = useState(() => setup.targets.map((t) => ({ ...t, points: String(t.points) })));
  const [result, setResult] = useState<{ error?: string; message?: string }>({});
  const [pending, start] = useTransition();
  const edit = (i: number, patch: Partial<(typeof targets)[number]>) => {
    setTargets((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
    setResult({});
  };
  const preview: Setup = { ...setup, targets: targets.map((t) => ({ ...t, points: Number(t.points) || 0 })) };

  function save() {
    if (targets.some((t) => t.points.trim() === "")) return setResult({ error: "Elk doel heeft punten nodig." });
    start(async () => setResult(await updateSetup(id, preview.targets.map(({ id, label, points }) => ({ id, label, points })))));
  }

  return (
    <section className="flex flex-col gap-[0.875rem] rounded-[1.5rem] border border-border bg-surface px-4 py-5 sm:px-[1.375rem]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 className="text-[1.0625rem] font-semibold">{setup.name}</h2>
        <span className="whitespace-nowrap text-[0.8125rem] text-muted">max {maxPassScore(preview)} per beurt</span>
      </div>
      <div className="flex h-36 flex-col justify-center gap-3 rounded-2xl bg-hover" aria-hidden>
        {plateRows(preview).map((row, r) => (
          <div key={r} className="flex items-end justify-center gap-2.5">
            {row.map((t) => (
              <Plate key={t.id} size={`${((t.sizeMm / 125) * 3.25).toFixed(3)}rem`} fontSize="0.75rem" look={PLATE}>
                {t.points}
              </Plate>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col">
        <div className={`${COLS} pb-1.5 text-xs font-semibold text-faint`}>
          <span>#</span>
          <span>Naam</span>
          <span>Punten</span>
          <span className="text-right">Plaat</span>
        </div>
        {targets.map((t, i) => (
          <div key={t.id} className={`${COLS} border-t border-divider py-[0.3125rem]`}>
            <span className="font-mono text-xs text-faint">{i + 1}</span>
            <input value={t.label} onChange={(e) => edit(i, { label: e.target.value })} className={input} aria-label={`Naam doel ${i + 1}`} />
            <input
              type="number"
              min={0}
              max={100}
              value={t.points}
              onChange={(e) => edit(i, { points: e.target.value === "" ? "" : String(Math.max(0, Math.min(100, Math.round(Number(e.target.value))))) })}
              className={input}
              aria-label={`Punten doel ${i + 1}`}
            />
            <span className="text-right text-xs leading-tight text-muted sm:whitespace-nowrap">
              rij {t.row} · {t.sizeMm} mm
            </span>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-divider pt-[0.875rem]">
        <Pill tone="yellow" disabled={pending} onClick={save}>
          {pending ? "Opslaan…" : "Opslaan"}
        </Pill>
        {result.error && <span className="text-[0.8125rem] font-semibold text-error">{result.error}</span>}
        {result.message && <span className="text-[0.8125rem] font-semibold text-good">{result.message}</span>}
      </div>
    </section>
  );
}
