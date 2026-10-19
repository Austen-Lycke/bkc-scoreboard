"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import type { SeasonRule } from "@/lib/scoring";
import { updateRule, type FormState } from "./actions";

const field = "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-gold";

export function RuleForm({ year, rule }: { year: number; rule: SeasonRule }) {
  const [state, action, pending] = useActionState<FormState, FormData>(updateRule, {});
  const [type, setType] = useState(rule.type);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
      <input type="hidden" name="year" value={year} />
      <label className="flex flex-col gap-1 text-sm font-medium">
        Klassement
        <select name="type" value={type} onChange={(e) => setType(e.target.value as SeasonRule["type"])} className={field}>
          <option value="sum">Som van alle wedstrijden</option>
          <option value="best_n">Som van de beste wedstrijden</option>
          <option value="average">Gemiddelde per wedstrijd</option>
        </select>
      </label>
      {type === "best_n" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Aantal beste
          <input name="n" type="number" min={1} max={50} defaultValue={rule.type === "best_n" ? rule.n : 5} className={`${field} w-24`} />
        </label>
      )}
      {type === "average" && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Minstens … wedstrijden
          <input name="min" type="number" min={1} max={50} defaultValue={rule.type === "average" ? rule.minParticipations : 3} className={`${field} w-24`} />
        </label>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Opslaan…" : "Regel opslaan"}
      </Button>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-[#15803d] dark:text-[#4ade80]">{state.message}</p>}
    </form>
  );
}
