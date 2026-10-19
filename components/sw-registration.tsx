"use client";

import { useEffect } from "react";

/** Registers the offline service worker (production only: in dev it would cache stale chunks). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => console.warn("Service worker niet geregistreerd", err));
  }, []);
  return null;
}
