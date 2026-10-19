"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
};

/**
 * A query parameter, read on the client only. These pages are static shells that also load from
 * the service worker cache while offline, so they can't depend on server-side search params.
 * `undefined` during server rendering / before hydration.
 */
export function useQueryParam(name: string): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(name),
    () => undefined,
  );
}
