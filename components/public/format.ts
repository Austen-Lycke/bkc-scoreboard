/** The club is in Bruges: all times are shown in Belgian time, also when rendered on a UTC server. */
export const CLUB_TIME_ZONE = "Europe/Brussels";

const longDate = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: CLUB_TIME_ZONE });
const shortDate = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", timeZone: CLUB_TIME_ZONE });

/** Dates are stored as YYYY-MM-DD; noon avoids timezone edge cases. */
export const formatLongDate = (date: string) => longDate.format(new Date(`${date}T12:00:00Z`));
export const formatShortDate = (date: string) => shortDate.format(new Date(`${date}T12:00:00Z`));

export const LIVE = new Set(["warmup", "round1", "break", "round2", "shootoff"]);
export const FINISHED = new Set(["finished", "published"]);

export const STATUS_LABEL: Record<string, string> = {
  draft: "Concept",
  prepared: "Gepland",
  warmup: "Opwarming",
  round1: "Ronde 1",
  break: "Pauze",
  round2: "Ronde 2",
  shootoff: "Afkamping",
  finished: "Uitslag",
  published: "Uitslag",
};

/** 1980-12-31 → 31/12/1980 */
export const formatBelgianDate = (date: string) => date.split("-").reverse().join("/");

const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

/** 2026-11-14 → "za 14 nov", with the year when asked: "za 14 nov 2026". */
export function formatCompactDate(date: string, withYear = false) {
  const [y, m, d] = date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DAYS[day]} ${d} ${MONTHS[m - 1]}${withYear ? ` ${y}` : ""}`;
}
