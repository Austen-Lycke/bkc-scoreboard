import { DEFAULT_RANKS, SPANISH_KNOCKDOWN, WSA_V1, wsaFormat } from "@/lib/scoring";
import type { CompetitionEvent } from "./events";
import type { CompetitionSnapshot, SnapshotShooter } from "./snapshot";

export const DEMO_COMPETITION_ID = "demo";
/** The same demo shooters on a WSA day: Junior and Volwassenen, everyone on their own frame. */
export const WSA_DEMO_ID = "demo-wsa";
export const isDemoId = (id: string) => id === DEMO_COMPETITION_ID || id === WSA_DEMO_ID;

/** Fictional shooters, per rank, for practising and demos. Never synced to the server. */
const DEMO_SHOOTERS: [string, string, string, string][] = [
  ["Lotte", "De Smet", "2011-04-12", "junior"],
  ["Mathis", "Claeys", "2010-09-03", "junior"],
  ["Noor", "Wouters", "2012-01-27", "junior"],
  ["Jens", "Vermeulen", "1988-05-19", "klasse3"],
  ["Elien", "Maes", "1995-11-02", "klasse3"],
  ["Pieter", "Desmet", "1979-02-14", "klasse3"],
  ["Sofie", "Goossens", "1983-07-30", "klasse3"],
  ["Ruben", "Peeters", "1992-03-08", "klasse3"],
  ["Hanne", "Willems", "1990-12-21", "klasse2"],
  ["Tom", "Janssens", "1975-06-11", "klasse2"],
  ["Kobe", "Martens", "1986-08-25", "klasse2"],
  ["Ward", "Lambrecht", "1969-10-05", "klasse1"],
  ["Ines", "Coppens", "1981-04-17", "klasse1"],
  ["Bert", "Vandamme", "1973-01-09", "klasse1"],
  ["Filip", "Dewulf", "1966-09-28", "ereklasse"],
  ["Karen", "Verhaeghe", "1977-02-03", "ereklasse"],
  ["Dirk", "Pattyn", "1964-11-15", "ereklasse"],
  ["Stijn", "Debruyne", "1998-06-06", "klasse3"],
];

/** A ready-to-run competition: 17 of the 18 demo shooters are already checked in. */
export function buildDemoSnapshot(now = new Date(), kind: "spanish" | "wsa" = "spanish"): CompetitionSnapshot {
  const wsa = kind === "wsa";
  const id = wsa ? WSA_DEMO_ID : DEMO_COMPETITION_ID;
  const at = now.toISOString();
  const shooters: SnapshotShooter[] = DEMO_SHOOTERS.map(([firstName, lastName, birthdate, rankCode]) => ({
    id: crypto.randomUUID(),
    firstName,
    lastName,
    birthdate,
    rankCode,
  }));
  // Some season history, so the reverse-ranking order is visible.
  const seasonPoints = Object.fromEntries(shooters.slice(0, 12).map((s, i) => [s.id, 60 + ((i * 37) % 50)]));
  const events: CompetitionEvent[] = shooters.slice(0, -1).map((s, i) => ({
    id: crypto.randomUUID(),
    competitionId: id,
    deviceId: "demo",
    at: new Date(now.getTime() - (shooters.length - i) * 60_000).toISOString(),
    type: "entry.checked_in",
    payload: {
      entryId: crypto.randomUUID(),
      shooter: { id: s.id, firstName: s.firstName, lastName: s.lastName, birthdate: s.birthdate },
      isNewShooter: false,
      rankCode: s.rankCode,
      feePaid: i % 5 !== 0,
      feeCents: 500,
    },
  }));

  return {
    competition: {
      id,
      slug: id,
      name: wsa ? "Demowedstrijd WSA" : "Demowedstrijd",
      date: at.slice(0, 10),
      location: "Clublokaal BKC",
      seasonYear: now.getFullYear(),
      rounds: 2,
      knockdowns: 2,
      feeCents: 500,
      setupByRank: Object.fromEntries(DEFAULT_RANKS.map((r) => [r.code, wsa ? WSA_V1 : SPANISH_KNOCKDOWN])),
      format: wsa ? wsaFormat(DEFAULT_RANKS) : null,
      status: "prepared",
    },
    ranks: DEFAULT_RANKS,
    shooters,
    seasonPoints,
    events,
    fetchedAt: at,
    isDemo: true,
  };
}
