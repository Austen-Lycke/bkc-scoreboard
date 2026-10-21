"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A line that scrolls sideways when it doesn't fit (tabs, the phase, the admin sections on a phone).
 * Keeps the active item (`[aria-current]`, `[aria-checked=true]`) in view when `active` changes.
 */
export function ScrollRow({
  active,
  as: Tag = "div",
  className = "",
  children,
  ...props
}: {
  active: string | null;
  as?: "div" | "nav";
  className?: string;
  children: ReactNode;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const row = ref.current;
    const item = row?.querySelector<HTMLElement>('[aria-current="page"], [aria-checked="true"]');
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    // Only this row scrolls, never the page: centre the item if it's (partly) out of view.
    const r = row.getBoundingClientRect();
    const i = item.getBoundingClientRect();
    if (i.left < r.left || i.right > r.right) row.scrollBy({ left: i.left - r.left - (r.width - i.width) / 2, behavior: "smooth" });
  }, [active]);
  return (
    <Tag ref={ref as React.Ref<HTMLDivElement>} {...props} className={`scroll-row ${className}`}>
      {children}
    </Tag>
  );
}
