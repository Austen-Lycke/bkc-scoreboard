import { FINISHED, LIVE, STATUS_LABEL } from "./format";

export function StatusPill({ status }: { status: string }) {
  if (LIVE.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
        <span className="size-1.5 animate-pulse rounded-full bg-white" />
        Live · {STATUS_LABEL[status]}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${
        FINISHED.has(status) ? "bg-navy text-white dark:bg-white/15" : "bg-[var(--gold)]/15 text-[#8a6d10] dark:text-[var(--gold)]"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
