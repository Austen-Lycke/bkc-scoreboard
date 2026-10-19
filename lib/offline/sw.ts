"use client";

export type OfflineReadiness = "unsupported" | "development" | "installing" | "active";

export function serviceWorkerState(): OfflineReadiness {
  if (!("serviceWorker" in navigator)) return "unsupported";
  if (process.env.NODE_ENV !== "production") return "development";
  return navigator.serviceWorker.controller ? "active" : "installing";
}

/** Asks the service worker to (re)store the operator and TV pages with all their files. */
export async function warmOfflineCache(): Promise<{ ok: boolean; assets?: number; error?: string }> {
  const registration = await navigator.serviceWorker.ready;
  const worker = registration.active;
  if (!worker) return { ok: false, error: "Service worker is niet actief" };
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => resolve(e.data);
    worker.postMessage({ type: "warm" }, [channel.port2]);
  });
}
