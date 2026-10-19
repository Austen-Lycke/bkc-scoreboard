"use client";

import { useOffline } from "next/offline";
import { useEffect, useState } from "react";
import { rankName } from "@/lib/competition";
import { downloadSnapshot } from "@/lib/offline/api";
import { deviceId } from "@/lib/offline/db";
import { resetDemo, saveSnapshot } from "@/lib/offline/store";
import { serviceWorkerState, warmOfflineCache, type OfflineReadiness } from "@/lib/offline/sw";
import { openTvWindow } from "@/lib/offline/tv-window";
import { useComp } from "../context";
import { Badge, Button, Card, euro } from "../ui";

const timeFormat = new Intl.DateTimeFormat("nl-BE", { dateStyle: "medium", timeStyle: "short" });

/** Checklist before the competition: data on this device, offline-ready, storage kept, TV open. */
export function PrepareView() {
  const { id, state, unsynced } = useComp();
  const offline = useOffline();
  const comp = state.snapshot.competition;
  // Only rendered on the client (after local data loaded), so reading navigator here is safe.
  const [sw, setSw] = useState<OfflineReadiness>(serviceWorkerState);
  const [warm, setWarm] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [device, setDevice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
    void deviceId().then(setDevice);
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
    setWarm("Bezig…");
    const result = await warmOfflineCache();
    setWarm(result.ok ? `Klaar: ${result.assets} bestanden bewaard` : `Mislukt: ${result.error}`);
    setSw(serviceWorkerState());
  }

  const setups = [...new Set(Object.values(comp.setupByRank).map((s) => s.name))];

  return (
    <div className="grid max-w-5xl gap-4 md:grid-cols-2">
      <Card className="p-5">
        <h2 className="font-semibold">Wedstrijd op dit toestel</h2>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">Datum</dt>
          <dd>{comp.date}</dd>
          <dt className="text-muted">Opstelling</dt>
          <dd>{setups.join(", ")}</dd>
          <dt className="text-muted">Formaat</dt>
          <dd>
            {comp.rounds} rondes × {comp.knockdowns} knockdowns
          </dd>
          <dt className="text-muted">Inschrijving</dt>
          <dd>{comp.feeCents ? euro(comp.feeCents) : "gratis"}</dd>
          <dt className="text-muted">Gekende schutters</dt>
          <dd>{state.shooters.size}</dd>
          <dt className="text-muted">Gedownload</dt>
          <dd>{timeFormat.format(new Date(state.snapshot.fetchedAt))}</dd>
          <dt className="text-muted">Lokale acties</dt>
          <dd>{unsynced}</dd>
        </dl>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {state.snapshot.isDemo ? (
            <Button onClick={() => confirm("De demo opnieuw beginnen? Alle demoscores worden gewist.") && resetDemo()}>
              Demo opnieuw beginnen
            </Button>
          ) : (
            <Button onClick={refresh} disabled={busy || offline}>
              {busy ? "Downloaden…" : "Gegevens opnieuw downloaden"}
            </Button>
          )}
          {message && <p className="text-sm text-muted">{message}</p>}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Klaar voor een wedstrijd zonder internet</h2>
        <ul className="mt-3 flex flex-col gap-3 text-sm">
          <Check ok={sw === "active"} label="App ook offline te openen">
            {sw === "development" ? (
              <span className="text-muted">Alleen in de gepubliceerde versie.</span>
            ) : sw === "unsupported" ? (
              <span className="text-muted">Deze browser ondersteunt dit niet. Gebruik Chrome.</span>
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={prepareOffline} disabled={offline}>
                  Offline klaarzetten
                </Button>
                {warm && <span className="text-muted">{warm}</span>}
              </span>
            )}
          </Check>
          <Check ok={persisted === true} label="Opslag vastgezet (de browser wist niets automatisch)">
            {persisted === false && (
              <Button size="sm" onClick={async () => setPersisted(await navigator.storage.persist())}>
                Vastzetten
              </Button>
            )}
          </Check>
          <Check ok={state.entries.size > 0} label="Schutters ingeschreven">
            <span className="text-muted">
              {[...new Set([...state.entries.values()].map((e) => rankName(state, e.rankCode)))].join(", ") || "nog niemand"}
            </span>
          </Check>
          <Check ok={null} label="TV-scherm">
            <Button size="sm" onClick={() => openTvWindow(id)}>
              TV openen op tweede scherm
            </Button>
          </Check>
        </ul>
        <p className="mt-4 text-xs text-muted">Toestel: {device}</p>
      </Card>
    </div>
  );
}

function Check({ ok, label, children }: { ok: boolean | null; label: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span aria-hidden className={`mt-0.5 ${ok ? "text-[var(--hit)]" : ok === false ? "text-gold" : "text-muted"}`}>
        {ok ? "●" : "○"}
      </span>
      <div className="flex flex-col gap-1.5">
        <span className="font-medium">
          {label} {ok && <Badge tone="green">ok</Badge>}
        </span>
        {children}
      </div>
    </li>
  );
}
