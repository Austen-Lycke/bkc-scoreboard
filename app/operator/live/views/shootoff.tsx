"use client";

import { Knockdown } from "@/components/knockdown";
import { entryName, entryTotal, pendingShootoffs, rankName, setupForRank } from "@/lib/competition";
import type { ShootoffDraft } from "@/lib/offline/db";
import { emit, emitMany, updateLive } from "@/lib/offline/store";
import { iterationScore } from "@/lib/scoring";
import { useComp } from "../context";
import { Badge, Button, Card, Empty } from "@/components/ui";

/**
 * Afkamping: the judge calls the targets one by one; every tied shooter shoots at the called
 * target. Most points wins the place; still tied → another round among just them.
 */
export function ShootoffView() {
  const { state, live } = useComp();
  if (live?.shootoff) return <ActiveShootoff draft={live.shootoff} />;

  const pending = pendingShootoffs(state);
  return (
    <div className="flex flex-col gap-6">
      {pending.length === 0 ? (
        <Empty>Geen gelijke standen die afgekampt moeten worden. Afkamping kan pas als een klasse alle passages geschoten heeft.</Empty>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {pending.map(({ rankCode, groups }) => (
            <Card key={rankCode} className="p-5">
              <h3 className="font-semibold">{rankName(state, rankCode)}</h3>
              <ul className="mt-3 flex flex-col gap-3">
                {groups.map((group) => (
                  <PendingGroup key={group.join()} rankCode={rankCode} group={group} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
      <History />
    </div>
  );
}

function PendingGroup({ rankCode, group }: { rankCode: string; group: string[] }) {
  const { id, state } = useComp();
  const earlier = state.shootoffs.filter((s) => s.rankCode === rankCode && s.participants.length === group.length && s.participants.every((p) => group.includes(p)));

  async function start() {
    const draft: ShootoffDraft = { rankCode, participants: group, calls: [], results: Object.fromEntries(group.map((p) => [p, []])) };
    await updateLive(id, { shootoff: draft });
    if (state.status !== "shootoff") await emit(id, "status.set", { status: "shootoff" });
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div>
        <p className="font-medium">{group.map((e) => entryName(state, e)).join(", ")}</p>
        <p className="text-sm text-muted">
          {entryTotal(state, group[0])} punten{earlier.length > 0 ? ` · al ${earlier.length}× afgekampt, nog steeds gelijk` : ""}
        </p>
      </div>
      <Button tone="primary" onClick={start}>
        {earlier.length > 0 ? "Opnieuw afkampen" : "Afkamping starten"}
      </Button>
    </li>
  );
}

function ActiveShootoff({ draft }: { draft: ShootoffDraft }) {
  const { id, state } = useComp();
  const setup = setupForRank(state.snapshot, draft.rankCode);
  const called = new Set(draft.calls.map((c) => c.targetId));
  const remaining = setup.targets.filter((t) => !called.has(t.id));
  const last = draft.calls.length - 1;
  const complete = remaining.length === 0 && draft.participants.every((p) => draft.results[p].every((r) => r !== null));
  const asIteration = {
    participants: draft.participants,
    calls: draft.calls,
    results: Object.fromEntries(draft.participants.map((p) => [p, draft.results[p].map(Boolean)])),
  };

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
    await emitMany(id, [
      {
        type: "shootoff.recorded",
        payload: { iterationId: crypto.randomUUID(), rankCode: draft.rankCode, ...asIteration },
      },
    ]);
    await updateLive(id, { shootoff: null });
  }

  async function cancel() {
    if (draft.calls.length && !confirm("Deze afkamping annuleren? Wat al ingevuld is gaat verloren.")) return;
    await updateLive(id, { shootoff: null });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_28rem]">
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Afkamping · {rankName(state, draft.rankCode)}</h2>
          <Badge tone="gold">
            {draft.calls.length}/{setup.targets.length} doelen geroepen
          </Badge>
        </div>

        <p className="mt-4 text-sm font-medium">Welk doel roept de scheidsrechter?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {remaining.map((t) => (
            <Button key={t.id} onClick={() => call(t.id)} disabled={last >= 0 && draft.participants.some((p) => draft.results[p][last] === null)}>
              {t.label} <Badge>{t.points}</Badge>
            </Button>
          ))}
          {remaining.length === 0 && <span className="text-sm text-muted">Alle doelen zijn geroepen.</span>}
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 text-left">Schutter</th>
                {draft.calls.map((c) => (
                  <th key={c.targetId} className="px-1 py-2 text-center">
                    {setup.targets.find((t) => t.id === c.targetId)?.label}
                  </th>
                ))}
                <th className="py-2 text-right">Punten</th>
              </tr>
            </thead>
            <tbody>
              {draft.participants.map((p) => (
                <tr key={p} className="border-t border-border">
                  <td className="py-2 pr-3 font-medium">{entryName(state, p)}</td>
                  {draft.calls.map((c, i) =>
                    i === last ? (
                      <td key={c.targetId} className="px-1 py-1 text-center">
                        <div className="inline-flex gap-1">
                          <Button size="sm" tone={draft.results[p][i] === true ? "primary" : "secondary"} onClick={() => mark(p, i, true)}>
                            Raak
                          </Button>
                          <Button size="sm" tone={draft.results[p][i] === false ? "primary" : "secondary"} onClick={() => mark(p, i, false)}>
                            Mis
                          </Button>
                        </div>
                      </td>
                    ) : (
                      <td key={c.targetId} className="px-1 py-1 text-center">
                        <button
                          type="button"
                          onClick={() => mark(p, i, !draft.results[p][i])}
                          className={`rounded px-2 py-1 font-semibold ${draft.results[p][i] ? "text-[var(--hit)]" : "text-muted"}`}
                          aria-label="Aanpassen"
                        >
                          {draft.results[p][i] ? "✓" : "✗"}
                        </button>
                      </td>
                    ),
                  )}
                  <td className="py-2 text-right text-lg font-semibold tabular-nums">{iterationScore(asIteration, p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button tone="primary" onClick={save} disabled={!complete}>
            Afkamping opslaan
          </Button>
          <Button onClick={undoCall} disabled={draft.calls.length === 0}>
            Laatste doel ongedaan maken
          </Button>
          <Button tone="ghost" onClick={cancel}>
            Annuleren
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Geroepen</p>
        <p className="mt-1 text-2xl font-semibold">
          {last >= 0 ? setup.targets.find((t) => t.id === draft.calls[last].targetId)?.label : "Nog geen doel"}
        </p>
        <Knockdown setup={setup} hits={[]} highlight={last >= 0 ? draft.calls[last].targetId : null} className="mt-4 w-full" />
      </Card>
    </div>
  );
}

function History() {
  const { id, state } = useComp();
  if (state.shootoffs.length === 0) return null;
  return (
    <Card className="p-5">
      <h3 className="font-semibold">Gespeelde afkampingen</h3>
      <ul className="mt-3 divide-y divide-border text-sm">
        {state.shootoffs.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center gap-3 py-2">
            <Badge>{rankName(state, s.rankCode)}</Badge>
            <span className="mr-auto">
              {s.participants
                .map((p) => `${entryName(state, p)} ${iterationScore(s, p)}`)
                .join(" · ")}
            </span>
            <Button size="sm" tone="ghost" onClick={() => confirm("Deze afkamping verwijderen?") && emit(id, "shootoff.cleared", { iterationId: s.id })}>
              Verwijderen
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
