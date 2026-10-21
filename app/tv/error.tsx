"use client";

import { ScreenError } from "@/components/screen-error";

// `reset`, not `retry`: everything comes from this device, and retry would refetch the page (offline: fails).
export default function TvError({ error, reset }: { error: unknown; reset: () => void }) {
  return <ScreenError error={error} reset={reset} autoRetrySeconds={10} />;
}
