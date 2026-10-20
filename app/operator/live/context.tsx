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

export type Tab = "prepare" | "checkin" | "order" | "scoring" | "standings" | "shootoff" | "close";

/** Lets a view switch tabs, e.g. a live score in the standings opens Scoren on that knockdown. */
export const NavContext = createContext<{ goTo: (tab: Tab, knockdown?: number) => void }>({ goTo: () => {} });

export const useNav = () => useContext(NavContext);
