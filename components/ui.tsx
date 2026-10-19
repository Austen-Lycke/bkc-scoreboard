"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Small building blocks for the operator screens. */

type Tone = "primary" | "secondary" | "ghost" | "danger";

const TONES: Record<Tone, string> = {
  primary: "bg-navy text-white hover:opacity-90 dark:bg-gold dark:text-navy",
  secondary: "border border-border bg-surface hover:border-gold",
  ghost: "hover:bg-black/5 dark:hover:bg-white/10",
  danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950",
};

export function Button({
  tone = "secondary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "px-2.5 py-1 text-sm", md: "px-4 py-2 text-sm", lg: "px-6 py-3 text-base" };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${TONES[tone]} ${className}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-surface ${className}`}>{children}</section>;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gold" | "green" | "red" | "navy" }) {
  const tones = {
    neutral: "bg-black/5 text-muted dark:bg-white/10",
    gold: "bg-[var(--gold)]/15 text-[#8a6d10] dark:text-[var(--gold)]",
    green: "bg-[var(--hit)]/15 text-[#15803d] dark:text-[#4ade80]",
    red: "bg-red-500/15 text-red-700 dark:text-red-300",
    navy: "bg-navy text-white dark:bg-white/15",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-border p-6 text-center text-muted">{children}</p>;
}

export const euro = (cents: number) =>
  new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR", minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
