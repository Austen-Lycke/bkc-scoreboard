"use client";

import type { CompetitionSnapshot } from "@/lib/competition";

export async function downloadSnapshot(competitionId: string): Promise<CompetitionSnapshot> {
  let res: Response;
  try {
    res = await fetch(`/api/operator/competitions/${competitionId}/snapshot`, { cache: "no-store" });
  } catch {
    throw new Error("Geen internetverbinding. Deze wedstrijd staat nog niet op dit toestel: laad ze eerst terwijl je online bent.");
  }
  if (res.status === 401) throw new Error("Je bent niet aangemeld. Meld je aan via /login en open de wedstrijd opnieuw.");
  if (res.status === 403) throw new Error("Je account heeft geen toegang tot de wedstrijdleiding.");
  if (res.status === 404) throw new Error("Deze wedstrijd bestaat niet (meer).");
  if (!res.ok) throw new Error(`Downloaden mislukt (${res.status}).`);
  return res.json();
}
