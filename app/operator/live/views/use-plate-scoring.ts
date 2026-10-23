"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { heatKey, passOf, phaseDone, sameHits, setupFor, undoActions, undoDrafts, type SavedPass } from "@/lib/competition";
import { buzz } from "@/lib/haptics";
import { offlineDb } from "@/lib/offline/db";
import { emitMany, updateLive } from "@/lib/offline/store";
import { passKey } from "@/lib/scoring";
import { useComp } from "../context";
import { useAutoPhase } from "../phase";
import type { useLineup } from "./scoring";

/**
 * The state behind PlateScoring: the taps (drafts), saving a phase, undoing the last save, and the
 * keyboard shortcuts.
 */
export function usePlateScoring({
  activeKd,
  setActiveKd,
  lineup,
}: {
  activeKd: number;
  setActiveKd: (kd: number) => void;
  lineup: ReturnType<typeof useLineup>;
}) {
  const { id, state, live } = useComp();
  const { focusIndex, heat, phaseIndex } = lineup;
  // "Fase 1 opgeslagen ✓" for a moment after a save, so it never reads as the next phase being saved.
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const finished = state.status === "finished";
  const advance = useAutoPhase();
  // Round 1 is shot and round 2 is next: first the break or not (not while correcting an earlier heat).
  const waiting = focusIndex < 0 && !!heat && phaseDone(state, heat.round);

  const phase = heat && phaseIndex !== null ? heat.phases[phaseIndex] : null;
  // A knockdown nobody shoots in this phase (a shooter on their own) is never the active one.
  const currentKd = !phase || phase.some((s) => s.knockdown === activeKd) ? activeKd : (phase[0]?.knockdown ?? activeKd);
  const knockdowns = state.format.lanes;
  const drafts = useMemo(() => live?.drafts ?? {}, [live]);
  const setup = heat ? setupFor(state, heat.groupCode, heat.round) : null;

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
      if (!a || !heat || finished) return;
      setActiveKd(kd);
      void advance(heat.round);
      const key = passKey(a.entryId, heat.round, kd);
      const saved = passOf(state, a.entryId, heat.round, kd)?.hits ?? [];
      void updateLive(id, (current) => {
        const hits = current.drafts[key] ?? saved;
        const next = hits.includes(targetId) ? hits.filter((h) => h !== targetId) : [...hits, targetId];
        return { drafts: { ...current.drafts, [key]: next } };
      });
    },
    [advance, finished, heat, id, phase, setActiveKd, state],
  );

  const setAll = useCallback(
    (kd: number, all: boolean) => {
      const a = phase?.find((s) => s.knockdown === kd);
      if (!a || !heat || !setup || finished) return;
      setActiveKd(kd);
      void advance(heat.round);
      const key = passKey(a.entryId, heat.round, kd);
      void updateLive(id, (current) => ({ drafts: { ...current.drafts, [key]: all ? setup.targets.map((t) => t.id) : [] } }));
    },
    [advance, finished, heat, id, phase, setActiveKd, setup],
  );

  /**
   * Knockdowns of this phase nobody filled in: no plate tapped, no "Niets", nothing saved before.
   * Saving those as 0 needs a confirmation, so a double tap on Opslaan can't record the next pair.
   */
  const untouchedIn = useCallback(
    (drafts: Record<string, string[]>) =>
      heat && phase
        ? phase.filter((a) => drafts[passKey(a.entryId, heat.round, a.knockdown)] === undefined && !passOf(state, a.entryId, heat.round, a.knockdown))
        : [],
    [heat, phase, state],
  );
  const phaseKey = heat && phaseIndex !== null ? `${heatKey(heat)}:${phaseIndex}` : null;
  // The phase whose 0 is being confirmed; a later phase never inherits the question.
  const [confirmingFor, setConfirmingFor] = useState<string | null>(null);
  const untouched = untouchedIn(drafts);
  const confirming = confirmingFor !== null && confirmingFor === phaseKey && untouched.length > 0;

  const save = useCallback(async ({ allowEmpty = false } = {}) => {
    if (!heat || !phase || phaseIndex === null || finished || waiting) return;
    // Read the drafts from storage, not from render state: the last tap may be milliseconds old.
    const storedDrafts = (await offlineDb().live.get(id))?.drafts ?? {};
    if (!allowEmpty && untouchedIn(storedDrafts).length > 0) {
      setConfirmingFor(phaseKey);
      return;
    }
    setConfirmingFor(null);
    const passes: SavedPass[] = phase.map((a) => {
      const existing = passOf(state, a.entryId, heat.round, a.knockdown);
      const hits = storedDrafts[passKey(a.entryId, heat.round, a.knockdown)] ?? existing?.hits ?? [];
      return { entryId: a.entryId, round: heat.round, knockdown: a.knockdown, hits, previous: existing?.hits ?? null };
    });
    const actions = passes
      .filter((p) => !(p.previous && sameHits(p.previous, p.hits)))
      .map(({ entryId, round, knockdown, hits }) => ({ type: "pass.recorded" as const, payload: { entryId, round, knockdown, hits } }));
    await advance(heat.round);
    if (actions.length) await emitMany(id, actions);
    // Stay on a heat the operator jumped to until its phases are done; otherwise follow the schedule.
    const nextPhase = phaseIndex + 1 < heat.phases.length ? phaseIndex + 1 : null;
    const keys = phase.map((a) => passKey(a.entryId, heat.round, a.knockdown));
    await updateLive(id, (current) => ({
      drafts: Object.fromEntries(Object.entries(current.drafts).filter(([k]) => !keys.includes(k))),
      focus: focusIndex >= 0 && nextPhase !== null ? { heatKey: heatKey(heat), phaseIndex: nextPhase } : null,
      lastSave: { heatKey: heatKey(heat), phaseIndex, focused: focusIndex >= 0, passes, at: new Date().toISOString() },
    }));
    buzz();
    setActiveKd(1);
    setSavedNote(nextPhase !== null ? `Fase ${phaseIndex + 1} opgeslagen ✓` : `Beurt ${heat.index + 1} opgeslagen ✓`);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedNote(null), 1000);
  }, [advance, finished, focusIndex, heat, id, phase, phaseIndex, phaseKey, setActiveKd, state, untouchedIn, waiting]);

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  // Only while nothing changed those passes since (a correction in Stand, a takeover).
  const lastSave = live?.lastSave ?? null;
  const canUndo = !finished && !!lastSave && undoActions(state, lastSave) !== null;

  /** Takes the last save back: its passes return to how they were, its taps return as drafts. */
  const undo = useCallback(async () => {
    const save = (await offlineDb().live.get(id))?.lastSave;
    if (!save || finished) return;
    const actions = undoActions(state, save);
    if (actions?.length) await emitMany(id, actions);
    await updateLive(id, (current) =>
      actions
        ? {
            lastSave: null,
            drafts: { ...current.drafts, ...undoDrafts(save) },
            // New passes are cleared, so the schedule returns there by itself; otherwise go back to it.
            focus: save.focused || save.passes.some((p) => p.previous) ? { heatKey: save.heatKey, phaseIndex: save.phaseIndex } : null,
          }
        : { lastSave: null },
    );
    if (actions) buzz([20, 60, 20]);
    setActiveKd(1);
    setSavedNote(null);
  }, [finished, id, setActiveKd, state]);

  // Keyboard: 1–n toggles plates on the active knockdown, 0 is "Niets", W switches knockdown, Enter saves,
  // Esc drops the "0 opslaan?" question, Cmd/Ctrl+Z undoes. Enter saves wherever the mouse left the focus
  // (a plate, "Alles raak", a tab), and never presses that button again; only inside [data-keep-enter]
  // (undo, the "0 opslaan?" question) does it press the focused button. So Enter never answers that question.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest("input, select, textarea, [contenteditable], [role=dialog]")) return;
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        void undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!heat || !setup || finished || waiting) return;
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        setActiveKd((currentKd % knockdowns) + 1);
      } else if (e.key === "Enter") {
        if (el?.closest("[data-keep-enter]")) return;
        e.preventDefault();
        void save();
      } else if (e.key === "Escape") {
        setConfirmingFor(null);
      } else if (e.key === "0") {
        setAll(currentKd, false);
      } else if (/^[1-9]$/.test(e.key)) {
        const target = setup.targets[Number(e.key) - 1];
        if (target) toggle(currentKd, target.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentKd, finished, heat, knockdowns, save, setActiveKd, setAll, setup, toggle, undo, waiting]);

  return {
    finished,
    waiting,
    phase,
    currentKd,
    knockdowns,
    setup,
    hitsOf,
    toggle,
    setAll,
    untouched,
    confirming,
    setConfirmingFor,
    save,
    savedNote,
    lastSave,
    canUndo,
    undo,
  };
}
