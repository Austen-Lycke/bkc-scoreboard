"use client";

import { Fragment } from "react";
import { entryShortName } from "@/lib/competition";
import { scorePass, type Heat, type Setup } from "@/lib/scoring";
import { useComp } from "../context";
import { OPERATOR_HIT, OPERATOR_OPEN, Plate, plateRows } from "@/components/plates";
import { Panel, Pill } from "@/components/ui";

export function KnockdownPanel(props: {
  kd: number;
  name: string;
  setup: Setup;
  hits: string[];
  total: number;
  place: number;
  active: boolean;
  locked: boolean;
  /** Saving asked about this knockdown: point at "Niets". */
  nudge: boolean;
  onActivate: () => void;
  onToggle: (targetId: string) => void;
  onAll: (all: boolean) => void;
}) {
  const { kd, name, setup, hits, total, place, active, locked } = props;
  const scale = 0.92;
  return (
    <div
      role="group"
      aria-label={`Knockdown ${kd}: ${name}`}
      onClick={props.onActivate}
      className={`flex min-h-0 min-w-0 cursor-pointer select-none flex-col overflow-hidden rounded-[1.5rem] border-2 bg-surface px-4 py-4 transition-colors sm:px-6 sm:py-[1.375rem] ${
        active ? "border-ink" : "border-border"
      } ${locked ? "opacity-45" : ""}`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-[0.6875rem] py-1 text-[0.8125rem] font-semibold ${active ? "bg-yellow" : "bg-fill"}`}>KD {kd}</span>
        <span className="text-[0.8125rem] text-faint">
          {active ? (
            "actief"
          ) : (
            <>
              <span className="touch:hidden">klik om te scoren</span>
              <span className="hidden touch:inline">tik een plaat</span>
            </>
          )}
        </span>
      </div>
      <div className="mt-2.5 truncate text-[clamp(1.375rem,2.3vw,2rem)] font-semibold tracking-[-0.02em]">{name}</div>
      <div className="@container flex min-h-0 flex-1 flex-col justify-center gap-5 py-3">
        {plateRows(setup).map((row, r) => (
          <div key={r} className="flex items-end justify-center gap-[3cqw]">
            {row.map((t) => {
              const hit = hits.includes(t.id);
              const c = t.sizeMm * scale * 0.2;
              return (
                <Plate
                  key={t.id}
                  size={`max(2.75rem, min(${c.toFixed(2)}cqw, ${((t.sizeMm * scale * 1.15) / 16).toFixed(3)}rem))`}
                  fontSize={`max(0.75rem, min(${(c * 0.32).toFixed(2)}cqw, ${((t.sizeMm * scale * 0.37) / 16).toFixed(3)}rem))`}
                  look={hit ? OPERATOR_HIT : OPERATOR_OPEN}
                  onClick={() => props.onToggle(t.id)}
                  disabled={locked}
                  label={`${t.label} (${t.points} ptn)${hit ? ", geraakt" : ""}`}
                >
                  {t.points}
                </Plate>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2.5 border-t border-divider pt-[0.875rem]">
        <div>
          <div className="text-[clamp(3rem,5vw,4.5rem)] font-semibold leading-[0.9] tracking-[-0.03em] tabular-nums">{scorePass(setup, hits)}</div>
          <div className="mt-1.5 text-sm text-muted">
            totaal {total} · plaats {place}
          </div>
        </div>
        <div className="flex gap-1.5">
          <Pill size="sm" disabled={locked} onClick={(e) => (e.stopPropagation(), props.onAll(true))}>
            Alles raak
          </Pill>
          <Pill
            size="sm"
            tone={props.nudge ? "outline-ink" : "outline"}
            className={props.nudge ? "bg-yellow" : ""}
            disabled={locked}
            onClick={(e) => (e.stopPropagation(), props.onAll(false))}
          >
            Niets
          </Pill>
        </div>
      </div>
    </div>
  );
}

/** Who shoots which knockdown in every phase of this heat. */
export function SwapSchedule({ heat, phaseIndex }: { heat: Heat; phaseIndex: number }) {
  const { state } = useComp();
  const kds = Array.from({ length: state.format.lanes }, (_, i) => i + 1);
  return (
    <Panel size="md" className="px-5 py-[1.125rem]">
      <div className="mb-3 text-[0.9375rem] font-semibold">Wisselschema · beurt {heat.index + 1}</div>
      <div className="grid gap-1.5 text-[0.8125rem]" style={{ gridTemplateColumns: `auto repeat(${kds.length}, minmax(0, 1fr))` }}>
        <span />
        {kds.map((k) => (
          <span key={k} className="text-muted">
            KD {k}
          </span>
        ))}
        {heat.phases.map((ph, p) => (
          <Fragment key={p}>
            <span className={`self-center whitespace-nowrap ${p === phaseIndex ? "font-semibold" : "text-muted"}`}>
              Fase {p + 1}
              {p < phaseIndex ? " ✓" : ""}
            </span>
            {kds.map((k) => {
              const s = ph.find((x) => x.knockdown === k);
              return (
                <span
                  key={k}
                  className={`truncate rounded-lg px-2.5 py-2 ${
                    p === phaseIndex ? "bg-ink font-semibold text-white" : p < phaseIndex ? "bg-fill text-muted" : "bg-fill"
                  }`}
                >
                  {s ? entryShortName(state, s.entryId) : "–"}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}
