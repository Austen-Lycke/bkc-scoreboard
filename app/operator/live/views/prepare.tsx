"use client";

import { useRouter } from "next/navigation";
import { useOffline } from "next/offline";
import { useEffect, useState, type ReactNode } from "react";
import { rankName } from "@/lib/competition";
import { downloadSnapshot } from "@/lib/offline/api";
import { deviceId } from "@/lib/offline/db";
import { removeFromDevice, resetDemo, saveSnapshot } from "@/lib/offline/store";
import { serviceWorkerState, warmOfflineCache, type OfflineReadiness } from "@/lib/offline/sw";
import { openTvWindow } from "@/lib/offline/tv-window";
import { useComp } from "../context";
import { Panel, Pill } from "@/components/ui";
import { CLUB_TIME_ZONE, formatLongDate } from "@/components/public/format";

const timeFormat = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: CLUB_TIME_ZONE });

function browserName(): string {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "browser";
}

/** Checklist before the competition: data on this device, offline-ready, storage kept, TV open. */
export function PrepareView() {
  const { id, state, unsynced } = useComp();
  const offline = useOffline();
  const router = useRouter();
  const comp = state.snapshot.competition;
  const demo = !!state.snapshot.isDemo;
  // Only rendered on the client (after local data loaded), so reading navigator here is safe.
  const [sw, setSw] = useState<OfflineReadiness>(serviceWorkerState);
  const [warm, setWarm] = useState<{ ok: boolean; text: string } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [device, setDevice] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [askRemove, setAskRemove] = useState(false);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
    void deviceId().then((d) => setDevice(`${d.replace(/^dev-/, "").slice(0, 8)} · ${browserName()}`));
  }, []);

  async function refresh() {
    setBusy(true);
    setMessage(null);
    try {
      await saveSnapshot(await downloadSnapshot(id));
      setMessage("Gegevens bijgewerkt. Je lokale scores blijven behouden.");
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function prepareOffline() {
    setWarm({ ok: false, text: "Bezig…" });
    const result = await warmOfflineCache();
    setWarm(result.ok ? { ok: true, text: `Klaar: ${result.assets} bestanden bewaard` } : { ok: false, text: `Mislukt: ${result.error}` });
    setSw(serviceWorkerState());
  }

  async function remove() {
    await removeFromDevice(id);
    router.push("/operator");
  }

  const setups = [...new Map(Object.values(comp.setupByRank).map((s) => [s.id, s])).values()];
  const ranksIn = [...new Set([...state.entries.values()].filter((e) => !e.withdrawn).map((e) => rankName(state, e.rankCode)))].join(", ");
  const facts: [string, string][] = [
    ["Datum", formatLongDate(comp.date)],
    ["Opstelling", setups.map((s) => `${s.name} · ${s.targets.length} platen`).join(", ")],
    ["Formaat", `${comp.rounds} rondes × ${comp.knockdowns} knockdowns`],
    ["Gekende schutters", String(state.shooters.size)],
    ["Gedownload", timeFormat.format(new Date(state.snapshot.fetchedAt))],
    ["Lokale acties", demo ? `${unsynced} · demo, niet gedeeld` : unsynced ? `${unsynced} nog niet gedeeld` : "0 · alles gedeeld"],
  ];

  const offlineOk = sw === "development" ? null : sw === "unsupported" ? false : sw === "active" && !!warm?.ok;

  return (
    <div className="min-h-0 flex-1 overflow-auto px-8 pb-8 pt-2">
      <h2 className="px-1 pb-[0.875rem] text-[1.375rem] font-semibold">Voorbereiden</h2>
      <div className="grid max-w-[68.75rem] grid-cols-[repeat(auto-fit,minmax(min(100%,23.75rem),1fr))] items-start gap-4">
        <Panel className="flex flex-col gap-[1.125rem] px-[1.625rem] py-6">
          <h3 className="text-[1.0625rem] font-semibold">Wedstrijd op dit toestel</h3>
          <dl className="grid grid-cols-[9.375rem_1fr] gap-y-2.5 text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-4">
            {demo ? (
              <Pill tone="outline-ink" onClick={async () => (await resetDemo(), setMessage("Demo opnieuw begonnen."))}>
                Demo opnieuw beginnen
              </Pill>
            ) : (
              <Pill tone="outline-ink" onClick={refresh} disabled={busy || offline}>
                {busy ? "Downloaden…" : "Gegevens opnieuw downloaden"}
              </Pill>
            )}
            {askRemove ? (
              <div className="flex w-full flex-wrap items-center gap-2 rounded-2xl bg-error-light px-[0.875rem] py-3">
                <span className="min-w-48 flex-1 text-[0.8125rem] font-semibold text-error">
                  {unsynced > 0 && !demo
                    ? `Let op: ${unsynced} acties staan nog niet op de server en gaan verloren. Download eerst een back-up.`
                    : "Alle scores en inschrijvingen op dit toestel worden gewist. Op de server en de website verandert niets."}
                </span>
                <Pill tone="danger" size="sm" onClick={remove}>
                  Ja, verwijderen
                </Pill>
                <Pill tone="ghost" size="sm" onClick={() => setAskRemove(false)}>
                  Annuleren
                </Pill>
              </div>
            ) : (
              <Pill tone="danger-outline" onClick={() => setAskRemove(true)}>
                Van dit toestel verwijderen
              </Pill>
            )}
            {message && <span className="text-[0.8125rem] text-muted">{message}</span>}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-[1.125rem] px-[1.625rem] py-6">
          <h3 className="text-[1.0625rem] font-semibold">Klaar voor een wedstrijd zonder internet</h3>
          <div className="flex flex-col gap-3">
            <Check
              ok={offlineOk}
              label="App ook offline te openen"
              note={
                sw === "development"
                  ? "Alleen in de gepubliceerde versie."
                  : sw === "unsupported"
                    ? "Deze browser ondersteunt dit niet. Gebruik Chrome."
                    : warm?.text
              }
              action={sw !== "development" && sw !== "unsupported" && !offlineOk ? { label: "Offline klaarzetten", run: prepareOffline, disabled: offline } : undefined}
            />
            <Check
              ok={persisted}
              label="Opslag vastgezet (de browser wist niets automatisch)"
              note={persisted === null ? "Niet beschikbaar in deze browser." : undefined}
              action={persisted === false ? { label: "Vastzetten", run: async () => setPersisted(await navigator.storage.persist()) } : undefined}
            />
            <Check ok={state.entries.size > 0} label="Schutters ingeschreven" note={ranksIn || "nog niemand"} />
            <Check ok={null} label="TV-scherm" action={{ label: "TV openen op tweede scherm", run: () => openTvWindow(id) }} />
          </div>
          <span className="font-mono text-[0.6875rem] font-medium text-faint">Toestel {device}</span>
        </Panel>
      </div>
    </div>
  );
}

function Check({
  ok,
  label,
  note,
  action,
}: {
  ok: boolean | null;
  label: string;
  note?: ReactNode;
  action?: { label: string; run: () => void; disabled?: boolean };
}) {
  return (
    <div className={`flex items-start gap-[0.875rem] rounded-2xl px-4 py-[0.875rem] ${ok === false ? "bg-yellow-light" : "bg-background"}`}>
      <span
        aria-hidden
        className={`grid size-6 flex-none place-items-center rounded-full border-[1.5px] text-xs font-bold ${
          ok ? "border-ink bg-ink text-yellow" : ok === false ? "border-ink bg-surface" : "border-plate bg-surface"
        }`}
      >
        {ok ? "✓" : ok === false ? "!" : ""}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="text-sm font-semibold">{label}</span>
        {note && <span className="text-[0.8125rem] text-muted">{note}</span>}
        {action && (
          <Pill tone="ink" size="sm" className="self-start" onClick={action.run} disabled={action.disabled}>
            {action.label}
          </Pill>
        )}
      </div>
    </div>
  );
}
