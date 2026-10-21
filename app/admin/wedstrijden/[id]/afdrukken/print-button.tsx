"use client";

import { Pill } from "@/components/ui";

export function PrintButton() {
  return (
    <Pill tone="ink" onClick={() => window.print()} className="print:hidden">
      Afdrukken
    </Pill>
  );
}
