"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Knockdown } from "@/components/knockdown";
import {
  competitionProgress,
  competitionSchedule,
  entryName,
  entryTotal,
  heatKey,
  passOf,
  rankName,
  setupForRank,
  standingsFor,
} from "@/lib/competition";
import { offlineDb } from "@/lib/offline/db";
import { emitMany, updateLive } from "@/lib/offline/store";
import { passKey, scorePass, type Heat } from "@/lib/scoring";
import { useComp } from "../context";
import { Badge, Button, Card, Empty } from "@/components/ui";

/**
 * Scoring the heat that's shooting: one panel per knockdown, the shooter assigned to it in this
 * phase, and their plates. Taps are drafts (shown live on the TV); "Opslaan" records the passes.
 */
export function ScoringView() {
  const { id, state, live } = useComp();
  const schedule = useMemo(() => competitionSchedule(state), [state]);
  const progress = useMemo(() => competitionProgress(state, schedule), [state, schedule]);
  const [activeKd, setActiveKd] = useState(1);

  const focusIndex = live?.focus ? schedule.findIndex((h) => heatKey(h) === live.focus!.heatKey) : -1;
  const heatIndex = focusIndex >= 0 ? focusIndex : progress.heatIndex;
  const phaseIndex = focusIndex >= 0 ? live!.focus!.phaseIndex : progress.phaseIndex;
  const heat = heatIndex === null ? null : schedule[heatIndex];
  const phase = heat && phaseIndex !== null ? heat.phases[Math.min(phaseIndex, heat.phases.length - 1)] : null;
  const knockdowns = state.snapshot.competition.knockdowns;
  const drafts = useMemo(() => live?.drafts ?? {}, [live]);

  const assignment = (kd: number) => phase?.find((s) => s.knockdown === kd) ?? null;
  const hitsOf = useCallback(
    (entryId: string, kd: number) => {
      const key = passKey(entryId, heat!.round, kd);
      return drafts[key] ?? passOf(state, entryId, heat!.round, kd)?.hits ?? [];
    },
    [drafts, heat, state],
  );

  const toggle = useCallback(
    (kd: number, targetId: string) => {
      const a = phase?.find((s) => s.knockdown === kd);
      if (!a || !heat) return;
      const key = passKey(a.entryId, heat.round, kd);
      const saved = passOf(state, a.entryId, heat.round, kd)?.hits ?? [];
      void updateLive(id, (current) => {
        const hits = current.drafts[key] ?? saved;
        const next = hits.includes(targetId) ? hits.filter((h) => h !== targetId) : [...hits, targetId];
        return { drafts: { ...current.drafts, [key]: next } };
      });
    },
    [heat, id, phase, state],
  );

  const setAll = (kd: number, all: boolean) => {
    const a = assignment(kd);
    if (!a || !heat) return;
    const setup = setupForRank(state.snapshot, heat.rankCode);
    const key = passKey(a.entryId, heat.round, kd);
    void updateLive(id, (current) => ({ drafts: { ...current.drafts, [key]: all ? setup.targets.map((t) => t.id) : [] } }));
  };

  const save = useCallback(async () => {
    if (!heat || !phase || phaseIndex === null) return;
    // Read the drafts from storage, not from render state: the last tap may be milliseconds old.
    const storedDrafts = (await offlineDb().live.get(id))?.drafts ?? {};
    const actions = phase
      .map((a) => {
        const existing = passOf(state, a.entryId, heat.round, a.knockdown);
        const hits = storedDrafts[passKey(a.entryId, heat.round, a.knockdown)] ?? existing?.hits ?? [];
        const unchanged = existing && existing.hits.length === hits.length && hits.every((h) => existing.hits.includes(h));
        return unchanged ? null : { type: "pass.recorded" as const, payload: { entryId: a.entryId, round: heat.round, knockdown: a.knockdown, hits } };
      })
      .filter((a) => a !== null);
    if (actions.length) await emitMany(id, actions);
    // Stay on a heat the operator jumped to until its phases are done; otherwise follow the schedule.
    const nextPhase = phaseIndex + 1 < heat.phases.length ? phaseIndex + 1 : null;
    const keys = phase.map((a) => passKey(a.entryId, heat.round, a.knockdown));
    await updateLive(id, (current) => ({
      drafts: Object.fromEntries(Object.entries(current.drafts).filter(([k]) => !keys.includes(k))),
      focus: focusIndex >= 0 && nextPhase !== null ? { heatKey: heatKey(heat), phaseIndex: nextPhase } : null,
    }));
    setActiveKd(1);
  }, [focusIndex, heat, id, phase, phaseIndex, state]);

  // Keyboard: 1–9 toggles plates on the active knockdown, Tab switches knockdown, Enter saves.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, select, textarea, [contenteditable], [role=dialog]") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!heat) return;
      if (e.key === "Tab") {
        e.preventDefault();
        setActiveKd((k) => (k % knockdowns) + 1);
      } else if (e.key === "Enter" && !el?.closest("button")) {
        e.preventDefault();
        void save();
      } else if (/^[1-9]$/.test(e.key)) {
        const target = setupForRank(state.snapshot, heat.rankCode).targets[Number(e.key) - 1];
        if (target) toggle(activeKd, target.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeKd, heat, knockdowns, save, state.snapshot, toggle]);

  if (state.entries.size === 0) return <Empty>Schrijf eerst schutters in.</Empty>;

  return (
    <div className="grid gap-5 2xl:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-4">
        {heat && phase && phaseIndex !== null ? (
          <>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">
                Ronde {heat.round} · {rankName(state, heat.rankCode)} · Beurt {heat.index + 1}
              </h2>
              {heat.phases.length > 1 && (
                <Badge tone={phaseIndex > 0 ? "gold" : "neutral"}>
                  {phaseIndex > 0 ? "Gewisseld" : "Eerste knockdown"} ({phaseIndex + 1}/{heat.phases.length})
                </Badge>
              )}
              {focusIndex >= 0 && (
                <Button size="sm" tone="ghost" onClick={() => updateLive(id, { focus: null })}>
                  Terug naar de volgende in de rij
                </Button>
              )}
            </div>
            <div className={`grid gap-4 ${knockdowns > 1 ? "lg:grid-cols-2" : ""}`}>
              {Array.from({ length: knockdowns }, (_, i) => i + 1).map((kd) => {
                const a = assignment(kd);
                return (
                  <ShooterPanel
                    key={kd}
                    kd={kd}
                    heat={heat}
                    entryId={a?.entryId ?? null}
                    hits={a ? hitsOf(a.entryId, kd) : []}
                    active={activeKd === kd}
                    onActivate={() => setActiveKd(kd)}
                    onToggle={(t) => toggle(kd, t)}
                    onAll={(all) => setAll(kd, all)}
                  />
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button tone="primary" size="lg" onClick={save}>
                {phaseIndex + 1 < heat.phases.length ? "Opslaan en wisselen" : "Opslaan, volgende beurt"}
              </Button>
              <span className="text-sm text-muted">
                Toetsen: <kbd className="font-mono">1</kbd>–<kbd className="font-mono">7</kbd> doel, <kbd className="font-mono">Tab</kbd>{" "}
                andere knockdown, <kbd className="font-mono">Enter</kbd> opslaan
              </span>
            </div>
          </>
        ) : (
          <Card className="p-6">
            <h2 className="text-xl font-semibold">Alle beurten zijn geschoten</h2>
            <p className="mt-1 text-muted">Kijk de stand na en los eventuele gelijke standen op via Afkamping.</p>
          </Card>
        )}
      </div>
      <ScheduleList schedule={schedule} currentIndex={heatIndex} />
    </div>
  );
}

function ShooterPanel(props: {
  kd: number;
  heat: Heat;
  entryId: string | null;
  hits: string[];
  active: boolean;
  onActivate: () => void;
  onToggle: (targetId: string) => void;
  onAll: (all: boolean) => void;
}) {
  const { state, live } = useComp();
  const { kd, heat, entryId, hits, active } = props;
  if (!entryId) {
    return (
      <Card className="flex min-h-64 items-center justify-center p-5 text-muted">
        Knockdown {kd}: niemand in deze beurt
      </Card>
    );
  }
  const setup = setupForRank(state.snapshot, heat.rankCode);
  const score = scorePass(setup, hits);
  const saved = passOf(state, entryId, heat.round, kd);
  const isDraft = live?.drafts[passKey(entryId, heat.round, kd)] !== undefined;
  const total = entryTotal(state, entryId) - (saved?.score ?? 0) + score;
  const row = standingsFor(state, heat.rankCode).rows.find((r) => r.entryId === entryId);

  return (
    <Card className={`p-5 transition ${active ? "ring-2 ring-[var(--gold)]" : ""}`}>
      <div onClick={props.onActivate}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted">Knockdown {kd}</span>
          {saved && !isDraft ? <Badge tone="green">opgeslagen</Badge> : saved && isDraft ? <Badge tone="gold">gewijzigd</Badge> : null}
        </div>
        <p className="mt-1 text-2xl font-semibold">{entryName(state, entryId)}</p>
        <Knockdown setup={setup} hits={hits} onToggle={props.onToggle} showKeys={active} className="mt-3 h-[min(34vh,20rem)] w-full" />
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-4xl font-semibold tabular-nums">{score}</p>
          <p className="text-sm text-muted">
            Totaal {total}
            {row?.position ? ` · plaats ${row.position}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => props.onAll(true)}>
            Alles raak
          </Button>
          <Button size="sm" onClick={() => props.onAll(false)}>
            Niets
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ScheduleList({ schedule, currentIndex }: { schedule: Heat[]; currentIndex: number | null }) {
  const { id, state } = useComp();
  const done = (h: Heat) => h.phases.flat().filter((s) => state.passes.has(passKey(s.entryId, h.round, s.knockdown))).length;
  const next = currentIndex === null ? [] : schedule.slice(currentIndex + 1, currentIndex + 4);

  function focus(h: Heat) {
    const firstOpen = h.phases.findIndex((ph) => ph.some((s) => !state.passes.has(passKey(s.entryId, h.round, s.knockdown))));
    void updateLive(id, { focus: { heatKey: heatKey(h), phaseIndex: Math.max(0, firstOpen) } });
  }

  const groupOf = (h: Heat) => `Ronde ${h.round} · ${rankName(state, h.rankCode)}`;
  return (
    <aside className="flex flex-col gap-4">
      <Card className="p-4">
        <h3 className="font-semibold">Volgende</h3>
        {next.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Niemand meer.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {next.map((h) => (
              <li key={heatKey(h)} className="text-sm">
                <span className="text-xs text-muted">
                  R{h.round} · {rankName(state, h.rankCode)}
                </span>
                <p className="font-medium">{h.shooters.map((e) => entryName(state, e)).join(" & ")}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
      <Card className="max-h-[70vh] overflow-y-auto p-4">
        <h3 className="font-semibold">Alle beurten</h3>
        <ul className="mt-2 text-sm">
          {schedule.map((h, i) => {
            const header = i === 0 || groupOf(schedule[i - 1]) !== groupOf(h) ? groupOf(h) : null;
            const n = done(h);
            const total = h.phases.flat().length;
            return (
              <li key={heatKey(h)}>
                {header && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted first:mt-0">{header}</p>}
                <button
                  type="button"
                  onClick={() => focus(h)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-black/5 dark:hover:bg-white/5 ${
                    i === currentIndex ? "bg-[var(--gold)]/15" : ""
                  }`}
                >
                  <span aria-hidden className={n === total ? "text-[var(--hit)]" : n > 0 ? "text-gold" : "text-muted"}>
                    {n === total ? "●" : n > 0 ? "◐" : "○"}
                  </span>
                  <span className="truncate">{h.shooters.map((e) => entryName(state, e)).join(" & ")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </aside>
  );
}
