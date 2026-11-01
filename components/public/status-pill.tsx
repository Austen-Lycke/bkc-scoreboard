import { FINISHED, LIVE, STATUS_LABEL } from "./format";

/** The status of a competition in a list: live (yellow, "Live" only on a phone), afgelopen (ink) or gepland. */
export function StatusPill({ status }: { status: string }) {
  const pill = "whitespace-nowrap rounded-pill px-3 py-[0.3125rem] text-[0.8125rem] font-bold";
  if (LIVE.has(status)) {
    return (
      <span className={`${pill} inline-flex items-center gap-1.5 bg-yellow`}>
        <span className="size-1.5 rounded-full bg-ink" />
        Live<span className="max-md:hidden"> · {STATUS_LABEL[status]}</span>
      </span>
    );
  }
  if (FINISHED.has(status)) return <span className={`${pill} bg-ink text-white`}>Afgelopen</span>;
  return <span className={`${pill} bg-fill`}>{STATUS_LABEL[status] ?? status}</span>;
}
