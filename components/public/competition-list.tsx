import Link from "next/link";
import type { CompetitionListItem } from "@/lib/server/public-data";
import { formatShortDate } from "./format";
import { StatusPill } from "./status-pill";

export function CompetitionList({ items, empty }: { items: CompetitionListItem[]; empty: string }) {
  if (items.length === 0) return <p className="rounded-xl border border-dashed border-border p-6 text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {items.map((c) => (
        <li key={c.id}>
          <Link href={`/wedstrijd/${c.slug}`} className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-black/[0.02] sm:px-5 dark:hover:bg-white/[0.03]">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.name}</p>
              <p className="text-sm text-muted">
                {formatShortDate(c.date)}
                {c.location ? ` · ${c.location}` : ""}
              </p>
            </div>
            <StatusPill status={c.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
