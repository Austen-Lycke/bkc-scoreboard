"use client";

import { createContext, useContext } from "react";
import type { CompetitionState } from "@/lib/competition";
import type { LiveRecord } from "@/lib/offline/db";

export interface CompetitionContextValue {
  id: string;
  state: CompetitionState;
  live: LiveRecord | undefined;
  unsynced: number;
}

export const CompetitionContext = createContext<CompetitionContextValue | null>(null);

export function useComp(): CompetitionContextValue {
  const value = useContext(CompetitionContext);
  if (!value) throw new Error("useComp outside CompetitionContext");
  return value;
}
