"use client";

import { useEffect } from "react";
import { pillClass } from "./styles";

/**
 * Shown when the operator app or the TV crashes while rendering. The scores are in IndexedDB, so
 * nothing is lost: re-rendering or reloading (the service worker serves the page offline) picks
 * everything up again. The TV has nobody next to it, so it retries on its own.
 */
export function ScreenError({ error, reset, autoRetrySeconds }: { error: unknown; reset: () => void; autoRetrySeconds?: number }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    if (!autoRetrySeconds) return;
    const timer = setTimeout(reset, autoRetrySeconds * 1000);
    return () => clearTimeout(timer);
  }, [autoRetrySeconds, reset]);

  return (
    <main className="mx-auto flex max-w-lg flex-1 flex-col justify-center gap-3 px-6 py-24">
      <span className="text-[0.8125rem] font-bold tracking-[0.2em]">BKC</span>
      <h1 className="text-[1.75rem] font-semibold tracking-tight">Er ging iets mis op dit scherm</h1>
      <p className="text-muted">
        Alles wat al ingevoerd is, staat veilig op dit toestel. Probeer opnieuw; helpt dat niet, herlaad dan de pagina.
        {autoRetrySeconds ? ` Dit scherm probeert het zelf opnieuw over ${autoRetrySeconds} seconden.` : ""}
      </p>
      {error instanceof Error && error.message && <p className="font-mono text-xs text-faint">{error.message}</p>}
      <div className="flex flex-wrap gap-2 pt-2">
        <button type="button" onClick={reset} className={pillClass("ink", "lg")}>
          Opnieuw proberen
        </button>
        <button type="button" onClick={() => window.location.reload()} className={pillClass("outline", "lg")}>
          Pagina herladen
        </button>
      </div>
    </main>
  );
}
