"use client";

import { useState, useTransition } from "react";
import { Badge, Button } from "@/components/ui";
import type { RankDef } from "@/lib/scoring";
import type { PromotionRow } from "@/lib/server/promotion";
import { savePromotion, type FormState } from "../../actions";

const field = "rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ink";

export function PromotionWizard({ year, ranks, rows }: { year: number; ranks: RankDef[]; rows: PromotionRow[] }) {
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [result, setResult] = useState<FormState>({});
  const [pending, start] = useTransition();
  const name = (code: string) => ranks.find((r) => r.code === code)?.name ?? code;
  const target = (r: PromotionRow) => decisions[r.shooterId] ?? (r.reason === "tie_at_cut" ? "" : r.toRank);
  const undecided = rows.filter((r) => r.reason === "tie_at_cut" && !decisions[r.shooterId]);
  const moving = rows.filter((r) => target(r) && target(r) !== r.fromRank);

  function save() {
    if (!confirm(`De klassen voor seizoen ${year + 1} opslaan en seizoen ${year} afsluiten?`)) return;
    start(async () => setResult(await savePromotion(year, decisions)));
  }

  return (
    <div className="flex flex-col gap-6">
      {ranks.map((rank) => {
        const list = rows
          .filter((r) => r.fromRank === rank.code)
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.name.localeCompare(b.name));
        if (!list.length) return null;
        return (
          <section key={rank.code}>
            <h2 className="text-lg font-semibold">{rank.name}</h2>
            <div className="mt-2 overflow-x-auto rounded-xl border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr className="border-b border-border">
                    <th className="w-12 px-4 py-2">Pl.</th>
                    <th className="px-4 py-2">Naam</th>
                    <th className="px-4 py-2 text-right">Punten</th>
                    <th className="px-4 py-2">Voorstel</th>
                    <th className="px-4 py-2">Klasse {year + 1}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => {
                    const t = target(r);
                    const changed = decisions[r.shooterId] !== undefined && decisions[r.shooterId] !== r.toRank && r.reason !== "tie_at_cut";
                    return (
                      <tr key={r.shooterId} className={`border-b border-border last:border-0 ${r.reason === "tie_at_cut" && !t ? "bg-amber-50 dark:bg-amber-950/40" : ""}`}>
                        <td className="px-4 py-2 tabular-nums">{r.position ?? "–"}</td>
                        <td className="px-4 py-2 font-medium">{r.name}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{r.points === null ? "–" : Math.round(r.points * 10) / 10}</td>
                        <td className="px-4 py-2">
                          {r.reason === "promotion" && <Badge tone="green">↑ {name(r.toRank)}</Badge>}
                          {r.reason === "junior_age_out" && <Badge tone="gold">18 jaar → {name(r.toRank)}</Badge>}
                          {r.reason === "stay" && <Badge>blijft</Badge>}
                          {r.reason === "tie_at_cut" && <Badge tone="red">gelijk op de grens: beslissen</Badge>}
                          {changed && <span className="ml-2 text-xs text-muted">aangepast</span>}
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={t}
                            onChange={(e) => setDecisions((d) => ({ ...d, [r.shooterId]: e.target.value }))}
                            className={field}
                            aria-label={`Klasse ${year + 1} voor ${r.name}`}
                          >
                            {!t && <option value="">— kiezen —</option>}
                            {ranks.map((x) => (
                              <option key={x.code} value={x.code}>
                                {x.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-border bg-background/95 py-4 backdrop-blur">
        <span className="text-sm text-muted">
          {moving.length} van {rows.length} schutters veranderen van klasse
          {undecided.length > 0 && <strong className="ml-2 text-amber-700 dark:text-amber-300">· {undecided.length} nog te beslissen</strong>}
        </span>
        <Button tone="primary" className="ml-auto" disabled={pending || undecided.length > 0} onClick={save}>
          {pending ? "Opslaan…" : `Klassen ${year + 1} opslaan`}
        </Button>
        {result.error && <p className="w-full text-sm text-red-600">{result.error}</p>}
        {result.message && <p className="w-full text-sm text-[#15803d] dark:text-[#4ade80]">{result.message}</p>}
      </div>
    </div>
  );
}
