"use client";

import { useState, useTransition } from "react";
import { Knockdown } from "@/components/knockdown";
import { Button, Card } from "@/components/ui";
import { maxPassScore, type Setup } from "@/lib/scoring";
import { updateSetup } from "./actions";

const field = "w-full rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:border-gold";

export function SetupForm({ id, setup }: { id: string; setup: Setup }) {
  const [targets, setTargets] = useState(setup.targets);
  const [result, setResult] = useState<{ error?: string; message?: string }>({});
  const [pending, start] = useTransition();
  const edit = (i: number, patch: Partial<Setup["targets"][number]>) => setTargets((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  const preview = { ...setup, targets };

  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{setup.name}</h2>
        <span className="text-sm text-muted">max {maxPassScore(preview)} per beurt</span>
      </div>
      <Knockdown setup={preview} hits={[]} className="mt-3 h-40 w-full" />
      <table className="mt-4 w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-1.5">#</th>
            <th className="py-1.5">Naam</th>
            <th className="w-20 py-1.5">Punten</th>
            <th className="py-1.5 text-right">Plaat</th>
          </tr>
        </thead>
        <tbody>
          {targets.map((t, i) => (
            <tr key={t.id} className="border-t border-border">
              <td className="py-1.5 pr-2 text-muted">{i + 1}</td>
              <td className="py-1.5 pr-2">
                <input value={t.label} onChange={(e) => edit(i, { label: e.target.value })} className={field} aria-label={`Naam doel ${i + 1}`} />
              </td>
              <td className="py-1.5 pr-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={t.points}
                  onChange={(e) => edit(i, { points: Number(e.target.value) })}
                  className={field}
                  aria-label={`Punten doel ${i + 1}`}
                />
              </td>
              <td className="py-1.5 text-right text-muted">
                rij {t.row} · {t.sizeMm} mm
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button tone="primary" disabled={pending} onClick={() => start(async () => setResult(await updateSetup(id, targets.map(({ id, label, points }) => ({ id, label, points })))))}>
          {pending ? "Opslaan…" : "Opslaan"}
        </Button>
        {result.error && <span className="text-sm text-red-600">{result.error}</span>}
        {result.message && <span className="text-sm text-[#15803d] dark:text-[#4ade80]">{result.message}</span>}
      </div>
    </Card>
  );
}
