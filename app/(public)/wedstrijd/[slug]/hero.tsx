import { Plate, plateRows, type PlateLook } from "@/components/plates";
import type { PublicView } from "@/lib/competition";

type Current = NonNullable<PublicView["current"]>;

const HIT: PlateLook = { background: "var(--yellow)", color: "var(--ink)", borderColor: "var(--yellow)" };
const OPEN: PlateLook = { background: "transparent", color: "var(--on-ink)", borderColor: "var(--plate-open)" };

/** The heat on the line, as on the venue TV: a pair with their plates, or a WSA line as tiles. */
export function LineHero({ current }: { current: Current }) {
  const series = current.series ? `reeks ${current.series}` : null;
  const beurt = `beurt ${current.heatNumber}/${current.heatsInRank}`;
  // "Ronde 1 · Klasse A · beurt 3/4 · gewisseld", on a phone "Klasse A · beurt 3/4" (or "· reeks 2").
  const wideMeta = [current.roundLabel, current.rankName, series, beurt, current.swapped && "gewisseld"].filter(Boolean).join(" · ");
  const narrowMeta = `${current.rankName} · ${series ?? beurt}`;
  const pair = current.setup.entry !== "points" && current.shooters.length <= 2;
  return (
    <section
      className={`flex flex-col rounded-hero bg-ink text-white ${
        pair
          ? "gap-[clamp(1.25rem,3cqw,2rem)] px-[clamp(1.25rem,4cqw,3rem)] pb-[clamp(1.5rem,4cqw,3rem)] pt-[clamp(1.25rem,4cqw,2.75rem)]"
          : "gap-[clamp(1.25rem,3cqw,1.75rem)] p-[clamp(1.25rem,4cqw,2.5rem)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
        <span className="rounded-pill bg-yellow px-4 py-1.5 text-[clamp(1rem,1.6cqw,1.375rem)] font-bold text-ink">Nu aan de lijn</span>
        <span className="text-[clamp(0.9375rem,1.6cqw,1.375rem)] text-on-ink">
          <span className="max-md:hidden">{wideMeta}</span>
          <span className="md:hidden">{narrowMeta}</span>
        </span>
      </div>
      {pair ? <Pair current={current} /> : <Tiles current={current} />}
    </section>
  );
}

function Pair({ current }: { current: Current }) {
  const rows = plateRows(current.setup);
  return (
    // One mm of real plate: 0.42px on a phone, 0.6px on a desktop (in rem).
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))] gap-[clamp(2rem,5cqw,4rem)] [--gap:0.375rem] [--mm:0.02625rem] md:[--gap:0.5rem] md:[--mm:0.0375rem]">
      {/* Knockdown 1 on the left, also after the swap. */}
      {current.shooters.toSorted((a, b) => a.lane - b.lane).map((s) => (
        <div key={s.shooterId} className="flex min-w-0 flex-col gap-[clamp(1rem,2cqw,1.5rem)]">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[clamp(0.9375rem,1.4cqw,1.25rem)] text-on-ink">
              <span className="max-md:hidden">Knockdown</span>
              <span className="md:hidden">KD</span> {s.lane}
            </span>
            <span className="truncate text-[clamp(1.875rem,4cqw,3.5rem)] font-semibold leading-[1.12] tracking-[-0.035em]">{s.name}</span>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="flex flex-col gap-[var(--gap)]">
              {rows.map((row, r) => (
                <div key={r} className="flex items-end justify-center gap-[var(--gap)]">
                  {row.map((t) => (
                    <Plate
                      key={t.id}
                      size={`calc(var(--mm) * ${t.sizeMm})`}
                      fontSize={`max(0.75rem, calc(var(--mm) * ${t.sizeMm * 0.36}))`}
                      look={s.pass.hits.includes(t.id) ? HIT : OPEN}
                    >
                      {t.points}
                    </Plate>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex min-w-0 flex-auto flex-col items-end text-right">
              <span className="text-[clamp(4.25rem,11cqw,8.5rem)] font-semibold leading-[0.8] tracking-[-0.05em] text-yellow">{s.pass.score}</span>
              <span className="mt-[clamp(0.625rem,1.4cqw,1rem)] flex flex-wrap justify-end gap-x-1.5 text-[clamp(1rem,1.5cqw,1.25rem)] leading-tight text-on-ink">
                <span className="whitespace-nowrap">totaal {s.total}</span>
                {s.position !== null && <span className="whitespace-nowrap">plaats {s.position}</span>}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** A WSA line: up to 15 shooters, one tile each with their total (this series included). */
function Tiles({ current }: { current: Current }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] gap-2">
      {current.shooters.map((s) => (
        <div key={s.shooterId} className="flex min-h-14 items-center gap-3 rounded-row bg-on-ink-tile px-4 py-2">
          <span className="w-10 flex-none text-[0.9375rem] text-on-ink">KD {s.lane}</span>
          <span className="min-w-0 flex-1 truncate text-lg font-semibold tracking-[-0.01em]">{s.name}</span>
          <span className="text-[2rem] font-semibold leading-none tracking-[-0.04em] text-yellow">{s.total}</span>
        </div>
      ))}
    </div>
  );
}
