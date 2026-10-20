import { FINISHED, LIVE, STATUS_LABEL } from "./format";

export function StatusPill({ status }: { status: string }) {
  if (LIVE.has(status)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow px-2.5 py-0.5 text-xs font-bold">
        <span className="size-1.5 animate-pulse rounded-full bg-ink" />
        Live · {STATUS_LABEL[status]}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${FINISHED.has(status) ? "bg-ink text-white" : "bg-fill text-ink"}`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
