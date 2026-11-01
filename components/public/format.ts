/** The club is in Bruges: all times are shown in Belgian time, also when rendered on a UTC server. */
export const CLUB_TIME_ZONE = "Europe/Brussels";

const longDate = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: CLUB_TIME_ZONE });

const longDay = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: CLUB_TIME_ZONE });

/** Dates are stored as YYYY-MM-DD; noon avoids timezone edge cases. */
export const formatLongDate = (date: string) => longDate.format(new Date(`${date}T12:00:00Z`));
/** 2026-11-01 → "zondag 1 november" (no year). */
export const formatLongDay = (date: string) => longDay.format(new Date(`${date}T12:00:00Z`));

export const LIVE = new Set(["warmup", "round1", "break", "round2", "semifinal", "final", "shootoff"]);
export const FINISHED = new Set(["finished", "published"]);

export const STATUS_LABEL: Record<string, string> = {
  draft: "Concept",
  prepared: "Gepland",
  warmup: "Opwarming",
  round1: "Ronde 1",
  break: "Pauze",
  round2: "Ronde 2",
  semifinal: "Halve finale",
  final: "Finale",
  shootoff: "Afkamping",
  finished: "Uitslag",
  published: "Uitslag",
};

/** 1980-12-31 → 31/12/1980 */
export const formatBelgianDate = (date: string) => date.split("-").reverse().join("/");

const WEEKDAYS = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** 2026-11-14 → { year: 2026, day: 14, month: "nov", weekday: "zaterdag" }. */
export function dateParts(date: string) {
  const [year, m, day] = date.split("-").map(Number);
  return { year, day, month: MONTHS[m - 1], weekday: WEEKDAYS[new Date(Date.UTC(year, m - 1, day)).getUTCDay()] };
}

/** 2026-11-14 → "za 14 nov", with the year when asked: "za 14 nov 2026". */
export function formatCompactDate(date: string, withYear = false) {
  const { year, day, month, weekday } = dateParts(date);
  return `${weekday.slice(0, 2)} ${day} ${month}${withYear ? ` ${year}` : ""}`;
}

/** First letter up: "zondag 1 november" → "Zondag 1 november". */
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Where most competitions are held: a phone only names the place when it's somewhere else. */
export function usualLocation(items: { location: string | null }[]): string | null {
  const counts = new Map<string, number>();
  for (const { location } of items) if (location) counts.set(location, (counts.get(location) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
