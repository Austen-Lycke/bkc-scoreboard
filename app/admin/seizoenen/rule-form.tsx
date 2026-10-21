"use client";

import { useState } from "react";
import { Pill, Segmented } from "@/components/ui";
import type { SeasonRule } from "@/lib/scoring";
import { useSubmit } from "../use-submit";
import { updateRule } from "./actions";

const TYPES = [
  { value: "sum", label: "Som van alle" },
  { value: "best_n", label: "Som van de beste" },
  { value: "average", label: "Gemiddelde" },
] as const;

const number = "w-[5.5rem] rounded-xl border-[0.09375rem] border-border bg-background px-3 py-[0.4375rem] text-[0.9375rem] outline-none focus:border-ink";

export function RuleForm({ year, rule }: { year: number; rule: SeasonRule }) {
  const { state, pending, onSubmit, clear } = useSubmit(updateRule);
  const [type, setType] = useState<SeasonRule["type"]>(rule.type);

  return (
    <form
      onSubmit={onSubmit}
      onChange={clear}
      className="flex flex-wrap items-end gap-3 border-t border-divider pt-4"
    >
      <input type="hidden" name="year" value={year} />
      <input type="hidden" name="type" value={type} />
      <div className="flex flex-col gap-1.5">
        <span className="text-[0.8125rem] font-semibold">Klassement</span>
        <Segmented label={`Klassement ${year}`} options={TYPES} value={type} onChange={(t) => (setType(t), clear())} />
      </div>
      {type === "best_n" && (
        <label className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold">
          Aantal beste
          <input name="n" type="number" min={1} max={50} required defaultValue={rule.type === "best_n" ? rule.n : 5} className={number} />
        </label>
      )}
      {type === "average" && (
        <label className="flex flex-col gap-1.5 text-[0.8125rem] font-semibold">
          Minstens … wedstrijden
          <input name="min" type="number" min={1} max={50} required defaultValue={rule.type === "average" ? rule.minParticipations : 3} className={number} />
        </label>
      )}
      <Pill tone="outline-ink" size="sm" type="submit" disabled={pending}>
        {pending ? "Opslaan…" : "Regel opslaan"}
      </Pill>
      {state.message && <span className="pb-2 text-[0.8125rem] font-semibold text-good">{state.message}</span>}
      {state.error && <span className="pb-2 text-[0.8125rem] font-semibold text-error">{state.error}</span>}
    </form>
  );
}
