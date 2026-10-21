import Link from "next/link";
import type { ReactNode } from "react";
import type { TagTone } from "@/components/ui";

/** Layout pieces shared by the admin pages (server and client). */

/** Title block: optional back link, the title, then a line of text or links; actions on the right. */
export function PageHead({
  back,
  title,
  children,
  actions,
}: {
  back?: { href: string; label: string };
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 px-1">
      <div className={`flex min-w-0 flex-col ${back ? "gap-1.5" : "gap-1"}`}>
        {back && (
          <Link href={back.href} className="self-start text-[0.8125rem] font-semibold text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-[1.375rem] font-semibold">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Explanatory line under a page title. */
export function Lead({ children }: { children: ReactNode }) {
  return <p className="max-w-[45rem] text-pretty text-sm text-muted">{children}</p>;
}

/**
 * White card holding a list laid out as a grid table; scrolls sideways on narrow screens. On a phone
 * each table gives its rows a stacked grid of their own (`max-sm:` classes) and hides the headings.
 */
export function TableCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto rounded-[1.5rem] border border-border bg-surface px-2.5 py-1 ${className}`}>
      <div className="sm:min-w-[40rem]">{children}</div>
    </div>
  );
}

/** Column headings of a TableCard; pass the same grid template as the rows. */
export const tableHeadClass = "grid items-center px-[0.875rem] pb-2.5 pt-3 text-xs font-semibold text-faint max-sm:hidden";
// The first row after the (hidden) headings needs no line on top.
export const tableRowClass = "grid items-center border-t border-divider px-[0.875rem] max-sm:gap-x-3 max-sm:gap-y-1.5 max-sm:px-2 max-sm:nth-2:border-t-0";

/** Competition status as the admin shows it: planned, running, finished or published. */
export function competitionStatus(status: string): { label: string; tone: TagTone } {
  if (status === "published") return { label: "gepubliceerd", tone: "ink" };
  if (status === "finished") return { label: "afgewerkt", tone: "good" };
  if (status === "prepared" || status === "draft") return { label: "voorbereid", tone: "fill" };
  return { label: "bezig", tone: "yellow" };
}

/** "Spaanse knockdown" → "Spaanse", "WSA knockdown variant 1" → "WSA 1": short enough for a chip. */
export const setupShortName = (name: string) =>
  name.replace(/\s*knockdown\s*/i, " ").replace(/\bvariant\s+/i, "").replace(/\s+/g, " ").trim() || name;
