/**
 * Class names shared by server and client components (links styled as pills, form fields).
 * Kept out of components/ui.tsx: values exported from a "use client" module can't be read on the server.
 */

export type PillTone = "ink" | "yellow" | "outline" | "quiet" | "surface" | "outline-ink" | "ghost" | "danger" | "danger-outline";
export type PillSize = "xs" | "sm" | "md" | "lg";

const PILL_TONES: Record<PillTone, string> = {
  ink: "bg-ink text-white hover:bg-black",
  yellow: "bg-yellow font-bold text-ink hover:brightness-95",
  outline: "border-[1.5px] border-border text-ink hover:border-ink",
  quiet: "border-[1.5px] border-border text-muted hover:border-ink hover:text-ink",
  surface: "border-[1.5px] border-border bg-surface text-ink hover:border-ink",
  "outline-ink": "border-[1.5px] border-ink text-ink hover:bg-hover",
  ghost: "text-muted hover:text-ink",
  danger: "bg-error text-white hover:brightness-110",
  "danger-outline": "border-[1.5px] border-border text-error hover:border-error",
};

const PILL_SIZES: Record<PillSize, string> = {
  xs: "px-2.5 py-[0.1875rem] text-xs",
  sm: "px-[0.8125rem] py-[0.4375rem] text-[0.8125rem]",
  md: "px-4 py-2 text-sm",
  lg: "px-[1.125rem] py-2.5 text-sm",
};

/** The design's rounded button. Disabled pills fade instead of greying out. */
export const pillClass = (tone: PillTone = "outline", size: PillSize = "md") =>
  `inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${PILL_SIZES[size]} ${PILL_TONES[tone]}`;

/** Text input / textarea on a white card. */
export const fieldClass =
  "w-full min-w-0 rounded-xl border-[1.5px] border-border bg-background px-3 py-2.5 text-[0.9375rem] outline-none focus:border-ink disabled:opacity-60";

/** Underlined text link with the yellow accent. */
export const textLinkClass = "text-[0.8125rem] font-semibold underline decoration-yellow decoration-2 underline-offset-4 hover:decoration-ink";
