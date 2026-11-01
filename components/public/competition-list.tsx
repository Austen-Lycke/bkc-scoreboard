import Link from "next/link";
import type { CompetitionListItem } from "@/lib/server/public-data";
import { dateParts } from "./format";
import { StatusPill } from "./status-pill";

/**
 * Competitions as rows with a date block. A phone leaves out the weekday, and the place when it's
 * the usual one; `narrowLimit` shows fewer rows there.
 */
export function CompetitionList({
  items,
  empty,
  usual,
  narrowLimit,
}: {
  items: CompetitionListItem[];
  empty: string;
  usual: string | null;
  narrowLimit?: number;
}) {
  if (items.length === 0) return <p className="rounded-card border-2 border-dashed border-border p-6 text-muted">{empty}</p>;
  return (
    <ul className="flex flex-col rounded-card border-2 border-border bg-surface px-2.5 py-1.5">
      {items.map((c, i) => {
        const { day, month, weekday } = dateParts(c.date);
        const away = c.location && c.location !== usual ? c.location : null;
        return (
          <li
            key={c.id}
            className={`border-t-2 border-divider first:border-t-0 ${narrowLimit !== undefined && i >= narrowLimit ? "max-md:hidden" : ""}`}
          >
            <Link href={`/wedstrijd/${c.slug}`} className="flex min-h-[4.5rem] items-center gap-[clamp(0.75rem,2cqw,1.25rem)] px-2 py-3">
              <div className="flex w-11 flex-none flex-col items-center leading-none">
                <span className="text-[1.625rem] font-semibold tracking-[-0.03em]">{day}</span>
                <span className="mt-0.5 text-sm text-muted">{month}</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[clamp(1.125rem,1.6cqw,1.25rem)] font-semibold tracking-[-0.015em]">{c.name}</span>
                <span className="truncate text-[0.9375rem] text-muted max-md:hidden">{[weekday, c.location].filter(Boolean).join(" · ")}</span>
                {away && <span className="truncate text-[0.9375rem] text-muted md:hidden">{away}</span>}
              </div>
              <StatusPill status={c.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
