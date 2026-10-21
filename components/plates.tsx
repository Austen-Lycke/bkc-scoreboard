import type { CSSProperties, ReactNode } from "react";
import type { Setup, Target } from "@/lib/scoring";

/**
 * The knockdown as round plates, sized from their real diameter (mm). Every screen draws them a
 * little differently (operator, TV, afkamping), so the size and colours come from the caller.
 */

/** Targets per row, top row first, in the order of the setup (= keys 1–n). */
export function plateRows(setup: Setup): Target[][] {
  const rows = [...new Set(setup.targets.map((t) => t.row))].sort((a, b) => a - b);
  return rows.map((r) => setup.targets.filter((t) => t.row === r));
}

export interface PlateLook {
  background: string;
  color: string;
  borderColor: string;
  /** CSS length, default 0.125rem. */
  borderWidth?: string;
}

export const OPERATOR_HIT: PlateLook = { background: "var(--ink)", color: "var(--yellow)", borderColor: "var(--ink)" };
export const OPERATOR_OPEN: PlateLook = { background: "var(--surface)", color: "var(--ink)", borderColor: "var(--plate)" };

export function Plate({
  size,
  fontSize,
  look,
  onClick,
  label,
  disabled,
  children,
}: {
  /** CSS length for the diameter. */
  size: string;
  fontSize: string;
  look: PlateLook;
  onClick?: () => void;
  label?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize,
    background: look.background,
    color: look.color,
    borderColor: look.borderColor,
    borderWidth: look.borderWidth ?? "0.125rem",
  };
  const className =
    "box-border grid shrink-0 place-items-center rounded-full border-solid font-bold tabular-nums leading-none transition-[background-color,border-color,color] duration-150";
  if (!onClick) return <span style={style} className={className}>{children}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      style={style}
      className={`${className} cursor-pointer disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}
