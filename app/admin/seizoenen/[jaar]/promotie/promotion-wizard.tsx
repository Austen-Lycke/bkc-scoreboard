"use client";

import { useState, useTransition } from "react";
import { Chip, Pill, Tag, type TagTone } from "@/components/ui";
import { rankShortName } from "@/lib/competition/derive";
import type { RankDef } from "@/lib/scoring";
import type { PromotionRow } from "@/lib/server/promotion";
import { savePromotion } from "../../actions";

const COLS = "grid-cols-[3rem_minmax(0,1fr)_5rem_13rem_21rem]";
const points = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 });

export function PromotionWizard({ year, ranks, rows }: { year: number; ranks: RankDef[]; rows: PromotionRow[] }) {
  const [decisions, setDecisions] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const name = (code: string) => ranks.find((r) => r.code === code)?.name ?? code;
  const target = (r: PromotionRow) => decisions[r.shooterId] ?? (r.reason === "tie_at_cut" ? "" : r.toRank);
  const undecided = rows.filter((r) => r.reason === "tie_at_cut" && !decisions[r.shooterId]);
  const moving = rows.filter((r) => target(r) && target(r) !== r.fromRank);
  const juniors = new Set(ranks.filter((r) => r.isJunior).map((r) => r.code));

  const proposal = (r: PromotionRow): [string, TagTone] => {
    if (r.reason === "promotion" || r.reason === "junior_age_out") return [`↑ ${name(r.toRank)}`, "good"];
    if (r.reason === "tie_at_cut") return ["gelijk op de grens: beslissen", "error"];
    return juniors.has(r.fromRank) ? ["blijft · 18? zelf kiezen", "soft"] : ["blijft", "fill"];
  };

  function save() {
    setError(undefined);
    // Redirects to the seasons on success.
    start(async () => {
      const result = await savePromotion(year, decisions);
      if (result?.error) {
        setError(result.error);
        setAsking(false);
      }
    });
  }

  return (
    <>
      {ranks.map((rank) => {
        const list = rows
          .filter((r) => r.fromRank === rank.code)
          .sort((a, b) => (a.position ?? 999) - (b.position ?? 999) || a.name.localeCompare(b.name));
        if (!list.length) return null;
        return (
          <section key={rank.code} className="overflow-x-auto rounded-[1.5rem] border border-border bg-surface px-2.5 pb-1.5 pt-4">
            <div className="min-w-[52rem]">
              <div className="flex items-center gap-2.5 px-[0.875rem] pb-2">
                <h2 className="text-[1.0625rem] font-semibold">{rank.name}</h2>
                <Tag>{list.length}</Tag>
              </div>
              <div className={`grid ${COLS} px-[0.875rem] py-2 text-xs font-semibold text-faint`}>
                <span>Pl.</span>
                <span>Naam</span>
                <span className="text-right">Punten</span>
                <span className="pl-6">Voorstel</span>
                <span>Klasse {year + 1}</span>
              </div>
              {list.map((r) => {
                const t = target(r);
                const changed = r.reason !== "tie_at_cut" && decisions[r.shooterId] !== undefined && decisions[r.shooterId] !== r.toRank;
                const [tag, tone] = proposal(r);
                return (
                  <div
                    key={r.shooterId}
                    className={`grid ${COLS} items-center rounded-lg border-t border-divider px-[0.875rem] py-[0.4375rem] ${r.reason === "tie_at_cut" && !t ? "bg-yellow-light" : ""}`}
                  >
                    <span className="text-[0.9375rem] font-semibold tabular-nums">{r.position ?? "–"}</span>
                    <span className="truncate text-[0.9375rem] font-semibold">{r.name}</span>
                    <span className="text-right text-[0.9375rem] tabular-nums">{r.points === null ? "–" : points.format(r.points)}</span>
                    <span className="flex items-center gap-1.5 pl-6">
                      <Tag tone={tone}>{tag}</Tag>
                      {changed && <span className="text-xs text-faint">aangepast</span>}
                    </span>
                    <div role="group" aria-label={`Klasse ${year + 1} voor ${r.name}`} className="flex gap-[2px]">
                      {ranks.map((x) => (
                        <Chip key={x.code} size="sm" on={t === x.code} title={x.name} onClick={() => setDecisions((d) => ({ ...d, [r.shooterId]: x.code }))}>
                          {rankShortName(x.name)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 -mx-4 -mb-8 flex flex-wrap items-center gap-3 border-t border-border bg-background px-4 pb-5 pt-4 sm:-mx-8 sm:px-8">
        {asking ? (
          <>
            <span className="flex-1 text-sm font-semibold">
              De klassen voor seizoen {year + 1} opslaan en seizoen {year} afsluiten?
            </span>
            <Pill tone="ink" size="lg" disabled={pending} onClick={save}>
              {pending ? "Opslaan…" : "Ja, opslaan en afsluiten"}
            </Pill>
            <Pill tone="ghost" size="lg" disabled={pending} onClick={() => setAsking(false)}>
              Annuleren
            </Pill>
          </>
        ) : (
          <>
            <span className="text-sm text-muted">
              {moving.length} van {rows.length} schutters veranderen van klasse
              {undecided.length > 0 && <strong className="font-semibold text-error"> · {undecided.length} nog te beslissen</strong>}
            </span>
            <Pill tone="yellow" size="lg" className="ml-auto" disabled={undecided.length > 0} onClick={() => setAsking(true)}>
              Klassen {year + 1} opslaan
            </Pill>
          </>
        )}
        {error && <p className="w-full text-[0.8125rem] font-semibold text-error">{error}</p>}
      </div>
    </>
  );
}
