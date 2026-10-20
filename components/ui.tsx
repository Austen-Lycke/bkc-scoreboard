"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

/** Small building blocks shared by the operator screens and the admin. */

type PillTone = "ink" | "yellow" | "outline" | "outline-ink" | "ghost" | "danger" | "danger-outline";
type PillSize = "xs" | "sm" | "md" | "lg";

const PILL_TONES: Record<PillTone, string> = {
  ink: "bg-ink text-white hover:bg-black",
  yellow: "bg-yellow font-bold text-ink hover:brightness-95",
  outline: "border-[1.5px] border-border text-ink hover:border-ink",
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
export function Pill({
  tone = "outline",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: PillTone; size?: PillSize }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-35 ${PILL_SIZES[size]} ${PILL_TONES[tone]} ${className}`}
    />
  );
}

type TagTone = "fill" | "yellow" | "error" | "good" | "ink" | "muted";

const TAG_TONES: Record<TagTone, string> = {
  fill: "bg-fill text-ink",
  yellow: "bg-yellow text-ink",
  error: "bg-error-light text-error",
  good: "bg-good-light text-good",
  ink: "bg-ink text-white",
  muted: "bg-fill text-muted",
};

/** Small status label, e.g. "afkamping nodig" or a count. */
export function Tag({ children, tone = "fill", className = "" }: { children: ReactNode; tone?: TagTone; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-[0.1875rem] text-xs font-semibold ${TAG_TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** White card on the paper background. `lg` for main cards, `md` for smaller side cards. */
export function Panel({
  size = "lg",
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement> & { size?: "lg" | "md" }) {
  return <div {...props} className={`border border-border bg-surface ${size === "lg" ? "rounded-[1.5rem]" : "rounded-[1.25rem]"} ${className}`} />;
}

/** A keyboard key hint. */
export function Kbd({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-[0.3125rem] border-[1.5px] border-current px-[0.4375rem] py-0.5 font-mono text-xs font-medium ${className}`}>{children}</span>;
}

// Older building blocks, used by the admin screens.

type Tone = "primary" | "secondary" | "ghost" | "danger";

const TONES: Record<Tone, string> = {
  primary: "bg-ink text-white hover:bg-black",
  secondary: "border-[1.5px] border-border bg-surface hover:border-ink",
  ghost: "text-muted hover:bg-fill hover:text-ink",
  danger: "border-[1.5px] border-border text-error hover:border-error",
};

export function Button({
  tone = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "px-3 py-1 text-sm", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-full font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${sizes[size]} ${TONES[tone]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[1.25rem] border border-border bg-surface ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "green" | "red" | "navy" }) {
  const tones = { neutral: "fill", gold: "yellow", green: "good", red: "error", navy: "ink" } as const;
  return <Tag tone={tones[tone]}>{children}</Tag>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[1.5rem] border-[1.5px] border-dashed border-plate bg-surface p-8 text-center text-[0.9375rem] text-muted">{children}</p>;
}

export const euro = (cents: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
