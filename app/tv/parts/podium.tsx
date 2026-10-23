import { groupsInShootingOrder, standingsFor, tvName, type CompetitionState } from "@/lib/competition";
import { Marquee } from "./frame";

/**
 * The top three of every group, 1-2-3 with their totals: the podium after a knockout final, or the
 * final standings of a club day. More than three groups (the five ranks) go on two rows, a size smaller.
 */
export function Podium({ state, kicker, title = "Podium" }: { state: CompetitionState; kicker: string; title?: string }) {
  const groups = groupsInShootingOrder(state)
    .map((g) => ({ g, top: standingsFor(state, g.code).rows.filter((r) => r.position !== null && r.position <= 3) }))
    .filter((x) => x.top.length > 0);
  const many = groups.length > 3;
  const columns = many ? Math.ceil(groups.length / 2) : Math.max(1, groups.length);
  return (
    <div className={`flex min-h-0 flex-1 flex-col ${many ? "gap-6" : "gap-8"}`}>
      <span className="self-start rounded-full bg-yellow px-[1.625rem] py-2 text-[2.125rem] font-bold">{kicker}</span>
      <span className={`${many ? "text-[5rem]" : "text-[6.875rem]"} font-semibold leading-[0.95] tracking-[-0.04em]`}>{title}</span>
      <div className={`grid min-h-0 flex-1 ${many ? "gap-6" : "gap-8"}`} style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoRows: "minmax(0, 1fr)" }}>
        {groups.map(({ g, top }) => (
          <section key={g.code} className={`flex min-h-0 min-w-0 flex-col justify-center rounded-[2.75rem] bg-ink text-white ${many ? "gap-3 px-10 py-7" : "gap-7 px-14 py-11"}`}>
            <span className={`flex-none ${many ? "text-[1.875rem]" : "text-[2.125rem]"} text-white/60`}>{g.name}</span>
            {/* Shared places can make it more than three: then the names move by, a row at a time. */}
            <Marquee className="flex flex-1 flex-col justify-center" gap={many ? "gap-3" : "gap-7"}>
              {top.map((r) => (
                <div key={r.entryId} className={`flex items-baseline ${many ? "gap-5" : "gap-8"}`}>
                  <span
                    className={`flex-none font-semibold leading-none text-yellow tabular-nums ${
                      many ? `w-[3.25rem] ${r.position === 1 ? "text-[4rem]" : "text-[2.75rem]"}` : `w-[5.5rem] ${r.position === 1 ? "text-[7rem]" : "text-[4.5rem]"}`
                    }`}
                  >
                    {r.position}
                  </span>
                  <span className={`min-w-0 flex-1 truncate font-semibold tracking-[-0.02em] ${many ? (r.position === 1 ? "text-[2.75rem]" : "text-[2.25rem]") : r.position === 1 ? "text-[4.5rem]" : "text-[3.25rem]"}`}>
                    {tvName(state, r.entryId)}
                  </span>
                  <span className={`${many ? "text-[1.875rem]" : "text-[2.5rem]"} tabular-nums text-white/60`}>{r.total}</span>
                </div>
              ))}
            </Marquee>
          </section>
        ))}
      </div>
    </div>
  );
}
