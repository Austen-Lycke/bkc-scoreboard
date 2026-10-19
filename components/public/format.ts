const longDate = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Brussels" });
const shortDate = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Brussels" });

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
