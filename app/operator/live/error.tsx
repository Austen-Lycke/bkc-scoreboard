"use client";

import { ScreenError } from "@/components/screen-error";

// `reset`, not `retry`: everything comes from this device, and retry would refetch the page (offline: fails).
export default function OperatorError({ error, reset }: { error: unknown; reset: () => void }) {
  return <ScreenError error={error} reset={reset} />;
}
