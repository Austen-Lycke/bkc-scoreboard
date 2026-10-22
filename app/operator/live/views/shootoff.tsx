"use client";

import { entryName, entryTotal, groupName, knockoutRounds, pendingShootoffs, setupFor, standingsFor, type CompetitionState } from "@/lib/competition";
import type { ShootoffDraft } from "@/lib/offline/db";
import { emit, emitMany, updateLive } from "@/lib/offline/store";
import { iterationScore } from "@/lib/scoring";
import { useComp } from "../context";
import { Plate, plateRows } from "@/components/plates";
import { Panel, Pill, Tag } from "@/components/ui";

/**
 * Afkamping: the judge calls the targets one by one; every tied shooter shoots at the called
 * target. Most points wins the place; still tied → another round among just them. On a knockout
 * day a tie on a cut line comes first: it decides who goes on to the semi-final or the next final series.
 */
export function ShootoffView() {
  const { state, live } = useComp();
  if (live?.shootoff) return <ActiveShootoff draft={live.shootoff} />;

  const pending = pendingShootoffs(state).flatMap(({ groupCode, stage, groups }) => groups.map((group) => ({ rankCode: groupCode, stage, group })));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-8 pt-2 sm:px-8">
      <h2 className="px-1 text-[1.375rem] font-semibold">Afkamping</h2>
      {pending.length === 0 && (
        <div className="rounded-[1.5rem] border-[0.09375rem] border-dashed border-plate bg-surface p-8 text-center text-[0.9375rem] text-muted">
          Geen gelijke standen die afgekampt moeten worden. Afkamping kan pas als een klasse alle passages geschoten heeft.
        </div>
      )}
      {pending.map(({ rankCode, stage, group }) => (
        <PendingGroup key={group.join()} rankCode={rankCode} stage={stage} group={group} />
      ))}
      <History />
    </div>
  );
}

/** What a tie on a cut line ("cut:N", after round N) decides. */
function cutLabel(state: CompetitionState, stage: string): string {
  const round = Number(stage.slice(4));
  const { semi, finalStart } = knockoutRounds(state);
  if (round + 1 === semi) return "wie naar de halve finale gaat";
  if (round + 1 === finalStart) return "wie naar de finale gaat";
  return "wie in de finale verder mag";
}

function PendingGroup({ rankCode, stage, group }: { rankCode: string; stage?: string; group: string[] }) {
  const { id, state } = useComp();
  const earlier = state.shootoffs.filter((s) => s.rankCode === rankCode && s.stage === stage && group.every((p) => s.participants.includes(p)));
  const position = standingsFor(state, rankCode).rows.find((r) => r.entryId === group[0])?.position;

  async function start() {
    const returnStatus = state.status === "shootoff" ? null : state.status;
    const draft: ShootoffDraft = { rankCode, stage, participants: group, calls: [], results: Object.fromEntries(group.map((p) => [p, []])), returnStatus };
    await updateLive(id, { shootoff: draft });
    if (state.status !== "shootoff") await emit(id, "status.set", { status: "shootoff" });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[1.5rem] border-2 border-ink bg-surface px-4 py-[1.375rem] sm:px-6">
      <Tag tone="yellow" className="px-[0.6875rem] py-1 text-[0.8125rem]">
        {groupName(state, rankCode)}
      </Tag>
      <div className="min-w-[min(13.75rem,100%)] flex-1">
        <div className="text-[1.625rem] font-semibold tracking-[-0.02em]">{group.map((e) => entryName(state, e)).join(" & ")}</div>
        <div className="mt-0.5 text-sm text-muted">
          {entryTotal(state, group[0])} punten · {stage ? `gelijk op de grens: beslist ${cutLabel(state, stage)}` : `gedeelde plaats${position ? ` ${position}` : ""}`}
          {earlier.length > 0 ? ` · al ${earlier.length}× afgekampt, nog steeds gelijk` : ""}
        </div>
      </div>
      <button type="button" onClick={start} className="cursor-pointer rounded-2xl bg-yellow px-[1.375rem] py-4 text-[1.0625rem] font-bold hover:brightness-95">
        {earlier.length > 0 ? "Opnieuw afkampen" : "Afkamping starten"}
      </button>
    </div>
  );
}

function ActiveShootoff({ draft }: { draft: ShootoffDraft }) {
  const { id, state } = useComp();
  // The plates of the last qualification round (WSA: variant 2, as in the knockout).
  const setup = setupFor(state, draft.rankCode, state.snapshot.competition.rounds);
  const label = (targetId: string) => setup.targets.find((t) => t.id === targetId)?.label ?? targetId;
  const called = new Set(draft.calls.map((c) => c.targetId));
  const remaining = setup.targets.filter((t) => !called.has(t.id));
  const last = draft.calls.length - 1;
  const blocked = last >= 0 && draft.participants.some((p) => draft.results[p][last] === null);
  const asIteration = {
    participants: draft.participants,
    calls: draft.calls,
    results: Object.fromEntries(draft.participants.map((p) => [p, draft.results[p].map(Boolean)])),
  };
  const filled = draft.calls.length > 0 && draft.participants.every((p) => draft.results[p].every((r) => r !== null));
  // Decided early: nobody can still catch up with what's left on the rack.
  const left = remaining.reduce((n, t) => n + t.points, 0);
  const scores = draft.participants.map((p) => iterationScore(asIteration, p)).sort((a, b) => b - a);
  const decidedEarly = filled && remaining.length > 0 && scores.every((v, i) => i === 0 || scores[i - 1] - v > left);
  const complete = filled && (remaining.length === 0 || decidedEarly);

  const change = (fn: (d: ShootoffDraft) => ShootoffDraft) =>
    updateLive(id, (current) => (current.shootoff ? { shootoff: fn(current.shootoff) } : {}));

  const call = (targetId: string) =>
    change((d) => {
      if (d.calls.some((c) => c.targetId === targetId)) return d;
      const target = setup.targets.find((t) => t.id === targetId)!;
      return {
        ...d,
        calls: [...d.calls, { targetId, points: target.points }],
        results: Object.fromEntries(d.participants.map((p) => [p, [...d.results[p], null]])),
      };
    });

  const mark = (entryId: string, index: number, hit: boolean) =>
    change((d) => ({ ...d, results: { ...d.results, [entryId]: d.results[entryId].map((r, i) => (i === index ? hit : r)) } }));

  const undoCall = () =>
    change((d) => ({
      ...d,
      calls: d.calls.slice(0, -1),
      results: Object.fromEntries(d.participants.map((p) => [p, d.results[p].slice(0, -1)])),
    }));

  async function save() {
    if (!complete) return;
    await emitMany(id, [
      {
        type: "shootoff.recorded",
        payload: { iterationId: crypto.randomUUID(), rankCode: draft.rankCode, ...(draft.stage && { stage: draft.stage }), ...asIteration },
      },
    ]);
    await updateLive(id, { shootoff: null });
  }

  async function cancel() {
    await updateLive(id, { shootoff: null });
    if (draft.returnStatus && state.status === "shootoff") await emit(id, "status.set", { status: draft.returnStatus });
  }

  const width = (i: number) => (i === last ? "9.375rem" : "4rem");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-8 pt-2 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 px-1">
        <h2 className="text-[1.375rem] font-semibold">Afkamping · {groupName(state, draft.rankCode)}</h2>
        <span className="text-sm text-muted">
          {draft.calls.length} van {setup.targets.length} doelen geroepen
        </span>
      </div>
      {/* Phone: the called target with its rack goes under the scoring. */}
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,1fr)_clamp(17.5rem,30vw,25rem)]">
        <Panel className="flex min-w-0 flex-col gap-[1.125rem] px-4 py-[1.375rem] sm:px-6">
          <div className="text-[0.9375rem] font-semibold">Welk doel roept de scheidsrechter?</div>
          <div className="flex flex-wrap items-end gap-[0.875rem]">
            {remaining.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => call(t.id)}
                disabled={blocked}
                title={blocked ? "Vul eerst raak of mis in voor het vorige doel" : undefined}
                className="group flex cursor-pointer flex-col items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <span className="grid size-[3.625rem] place-items-center rounded-full border-2 border-plate bg-surface text-xl font-bold group-enabled:group-hover:border-ink">
                  {t.points}
                </span>
                <span className="text-xs text-muted">{t.label}</span>
              </button>
            ))}
            {remaining.length === 0 && <span className="text-sm text-muted">Alle doelen zijn geroepen.</span>}
          </div>
          {/* Also as text: a tooltip never shows on a tablet. */}
          {blocked && remaining.length > 0 && <span className="-mt-2 text-xs text-muted">Vul eerst raak of mis in voor het vorige doel.</span>}
          <div className="overflow-x-auto border-t border-divider pt-1.5">
            <div className="flex items-center py-2 text-xs font-semibold text-faint">
              <span className="min-w-[9.375rem] flex-1">Schutter</span>
              {draft.calls.map((c, i) => (
                <span key={c.targetId} className="flex-none text-center" style={{ width: width(i) }}>
                  {label(c.targetId)}
                </span>
              ))}
              <span className="w-[4.375rem] flex-none text-right">Punten</span>
            </div>
            {draft.participants.map((p) => (
              <div key={p} className="flex items-center border-t border-divider py-2">
                <span className="min-w-[9.375rem] flex-1 text-[1.0625rem] font-semibold">{entryName(state, p)}</span>
                {draft.calls.map((c, i) => {
                  const v = draft.results[p][i];
                  return (
                    <div key={c.targetId} className="flex flex-none justify-center" style={{ width: width(i) }}>
                      {i === last ? (
                        <div className="flex gap-1">
                          <ResultButton on={v === true} hit onClick={() => mark(p, i, true)}>
                            Raak
                          </ResultButton>
                          <ResultButton on={v === false} onClick={() => mark(p, i, false)}>
                            Mis
                          </ResultButton>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => mark(p, i, !v)}
                          aria-label={`${label(c.targetId)}: ${v ? "raak" : "mis"}, aanpassen`}
                          className={`grid size-11 cursor-pointer place-items-center rounded-full text-sm font-bold ${v ? "bg-ink text-yellow" : "bg-fill text-faint"}`}
                        >
                          {v ? "✓" : "✗"}
                        </button>
                      )}
                    </div>
                  );
                })}
                <span className="w-[4.375rem] flex-none text-right text-[1.625rem] font-semibold tabular-nums">{iterationScore(asIteration, p)}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={!complete}
              className="cursor-pointer rounded-2xl bg-yellow px-[1.375rem] py-[0.875rem] text-base font-bold hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-35"
            >
              {decidedEarly ? "Afkamping opslaan · beslist" : "Afkamping opslaan"}
            </button>
            <Pill className="py-[0.5625rem]" onClick={undoCall} disabled={draft.calls.length === 0}>
              Laatste doel ongedaan maken
            </Pill>
            <Pill tone="ghost" onClick={cancel}>
              Annuleren
            </Pill>
          </div>
        </Panel>
        <Panel className="flex flex-col gap-1.5 px-4 py-[1.375rem] sm:px-6">
          <span className="text-[0.8125rem] text-muted">Geroepen</span>
          <span className="text-[2.125rem] font-semibold tracking-[-0.02em]">{last >= 0 ? label(draft.calls[last].targetId) : "Nog geen doel"}</span>
          <div className="flex flex-col gap-[0.875rem] pb-1.5 pt-[1.375rem]">
            {plateRows(setup).map((row, r) => (
              <div key={r} className="flex items-end justify-center gap-2.5">
                {row.map((t) => {
                  const isLast = last >= 0 && draft.calls[last].targetId === t.id;
                  const was = called.has(t.id) && !isLast;
                  const d = (t.sizeMm * 0.5) / 16;
                  return (
                    <Plate
                      key={t.id}
                      size={`${d.toFixed(3)}rem`}
                      fontSize={`${Math.max(0.75, d * 0.34).toFixed(3)}rem`}
                      look={{
                        background: isLast ? "var(--yellow)" : was ? "var(--fill)" : "var(--surface)",
                        color: was ? "var(--faint)" : "var(--ink)",
                        borderColor: isLast ? "var(--ink)" : was ? "var(--fill)" : "var(--plate)",
                      }}
                    >
                      {t.points}
                    </Plate>
                  );
                })}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ResultButton({ on, hit, onClick, children }: { on: boolean; hit?: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`cursor-pointer rounded-full border-[0.09375rem] px-3 py-[0.4375rem] text-[0.8125rem] font-bold ${
        on ? `border-ink bg-ink ${hit ? "text-yellow" : "text-white"}` : "border-border bg-surface hover:border-ink"
      }`}
    >
      {children}
    </button>
  );
}

function History() {
  const { id, state } = useComp();
  if (state.shootoffs.length === 0) return null;
  return (
    <Panel size="md" className="flex flex-col gap-1 px-5 py-[1.125rem]">
      <div className="pb-2 text-[0.9375rem] font-semibold">Gespeelde afkampingen</div>
      {state.shootoffs.map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-divider py-2.5 text-sm">
          <Tag>{groupName(state, s.rankCode)}</Tag>
          <span className="min-w-[min(12rem,100%)] flex-1 font-medium">{s.participants.map((p) => `${entryName(state, p)} ${iterationScore(s, p)}`).join(" · ")}</span>
          <button
            type="button"
            onClick={() => emit(id, "shootoff.cleared", { iterationId: s.id })}
            className="cursor-pointer text-xs font-semibold text-muted hover:text-error"
          >
            Verwijderen
          </button>
        </div>
      ))}
    </Panel>
  );
}
