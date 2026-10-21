"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { pillClass, type PillSize, type PillTone } from "./styles";

/** Small building blocks shared by the operator screens and the admin. */

export type { PillSize, PillTone };

/** The design's rounded button. Disabled pills fade instead of greying out. */
export function Pill({
  tone = "outline",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: PillTone; size?: PillSize }) {
  return <button type="button" {...props} className={`${pillClass(tone, size)} ${className}`} />;
}

export type TagTone = "fill" | "yellow" | "soft" | "error" | "good" | "ink" | "muted";

const TAG_TONES: Record<TagTone, string> = {
  fill: "bg-fill text-ink",
  yellow: "bg-yellow text-ink",
  soft: "bg-yellow-light text-ink",
  error: "bg-error-light text-error",
  good: "bg-good-light text-good",
  ink: "bg-ink text-white",
  muted: "bg-fill text-muted",
};

const TAG_SIZES = { sm: "px-2 py-0.5 text-[0.6875rem]", md: "px-2.5 py-[0.1875rem] text-xs", lg: "px-3 py-1 text-[0.8125rem]" };

/** Small status label, e.g. "afkamping nodig" or a count. `sm` for a note next to a name, `lg` for totals. */
export function Tag({
  children,
  tone = "fill",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  tone?: TagTone;
  size?: keyof typeof TAG_SIZES;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full font-semibold ${TAG_SIZES[size]} ${TAG_TONES[tone]} ${className}`}
    >
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
  return <span className={`rounded-[0.3125rem] border-[0.09375rem] border-current px-[0.4375rem] py-0.5 font-mono text-xs font-medium ${className}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[1.5rem] border-[0.09375rem] border-dashed border-plate bg-surface p-8 text-center text-[0.9375rem] text-muted">{children}</p>;
}

/** A choice among a few options shown side by side, e.g. a rank or a setup. */
export function Chip({
  on,
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { on: boolean; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      {...props}
      className={`cursor-pointer whitespace-nowrap rounded-full border-[0.09375rem] font-semibold transition-colors disabled:cursor-default ${
        size === "sm" ? "px-[0.5625rem] py-[0.3125rem] text-xs" : "px-[0.6875rem] py-1.5 text-[0.8125rem]"
      } ${on ? "border-ink bg-ink text-white" : "border-border bg-surface text-ink enabled:hover:border-ink"} ${className}`}
    />
  );
}

/**
 * Two or three mutually exclusive options in one outlined pill. Wraps onto a second line when the
 * options don't fit (phone); the corners match a full pill on one line.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  disabled,
  label,
  className = "",
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`flex max-w-full flex-wrap gap-[0.125rem] self-start border-[0.09375rem] border-border bg-surface p-[0.1875rem] ${
        size === "sm" ? "rounded-[1.125rem]" : "rounded-[1.3125rem]"
      } ${disabled ? "opacity-50" : ""} ${className}`}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => !on && onChange(o.value)}
            className={`cursor-pointer whitespace-nowrap rounded-full font-semibold transition-colors disabled:cursor-not-allowed ${
              size === "sm" ? "px-2.5 py-[0.3125rem] text-xs" : "px-3 py-1.5 text-[0.8125rem]"
            } ${on ? "bg-ink text-white" : "text-ink enabled:hover:bg-hover"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** On/off toggle with its label, e.g. "Actief lid". */
export function Switch({
  on,
  onChange,
  children,
  className = "",
}: {
  on: boolean;
  onChange: (on: boolean) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`flex cursor-pointer items-center gap-2.5 text-left text-sm ${className}`}
    >
      <span className={`relative h-5 w-9 flex-none rounded-full transition-colors ${on ? "bg-ink" : "bg-[#d6d6d0]"}`}>
        <span className={`absolute top-[0.1875rem] size-3.5 rounded-full bg-white transition-[left] duration-150 ${on ? "left-[1.1875rem]" : "left-[0.1875rem]"}`} />
      </span>
      <span>{children}</span>
    </button>
  );
}
