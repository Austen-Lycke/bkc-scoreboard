import type { CSSProperties } from "react";
import { Plate, plateRows, type PlateLook } from "@/components/plates";
import type { Setup } from "@/lib/scoring";

export const TV_HIT: PlateLook = { background: "var(--yellow)", color: "var(--ink)", borderColor: "var(--yellow)", borderWidth: "0.1875rem" };
export const TV_OPEN: PlateLook = { background: "transparent", color: "rgba(255,255,255,.55)", borderColor: "rgba(255,255,255,.4)", borderWidth: "0.1875rem" };

/** `scale`: diameter per mm of real plate, in 1/16 rem (px at the default root size). `gap` is a CSS length. */
export function TvPlates({ setup, look, scale, gap }: { setup: Setup; look: (targetId: string) => PlateLook; scale: number; gap: string }) {
  return (
    <div className="flex flex-col" style={{ gap }}>
      {plateRows(setup).map((row, r) => (
        <div key={r} className="flex items-end justify-center" style={{ gap }}>
          {row.map((t) => {
            const d = (t.sizeMm * scale) / 16;
            return (
              <Plate key={t.id} size={`${d.toFixed(3)}rem`} fontSize={`${Math.max(1.125, d * 0.36).toFixed(3)}rem`} look={look(t.id)}>
                {t.points}
              </Plate>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Space between plates in FitPlates, in mm of real plate (scales with them). */
const FIT_GAP_MM = 20;

/**
 * The plates as large as their box allows (width and height), at most `scale` like TvPlates: for
 * afkamping cards, whose width depends on how many shooters are tied. Sets `--mm` (one mm of real
 * plate), so a look can size its border along with the plates.
 */
export function FitPlates({ setup, look, scale }: { setup: Setup; look: (targetId: string) => PlateLook; scale: number }) {
  const rows = plateRows(setup);
  const widest = Math.max(...rows.map((row) => row.reduce((mm, t) => mm + t.sizeMm, 0) + (row.length - 1) * FIT_GAP_MM));
  const tallest = rows.reduce((mm, row) => mm + Math.max(...row.map((t) => t.sizeMm)), 0) + (rows.length - 1) * FIT_GAP_MM;
  // The smallest of what fits across, what fits down, and the design size.
  const mm = `min(${(100 / widest).toFixed(4)}cqw, ${(100 / tallest).toFixed(4)}cqh, ${(scale / 16).toFixed(4)}rem)`;
  const gap = `calc(var(--mm) * ${FIT_GAP_MM})`;
  return (
    <div className="grid min-h-0 w-full flex-1 place-items-center" style={{ containerType: "size" }}>
      <div className="flex flex-col" style={{ gap, "--mm": mm } as CSSProperties}>
        {rows.map((row, r) => (
          <div key={r} className="flex items-end justify-center" style={{ gap }}>
            {row.map((t) => {
              const d = `var(--mm) * ${t.sizeMm}`;
              return (
                // Numbers like TvPlates (at least 1.125rem), but never wider than half the plate.
                <Plate key={t.id} size={`calc(${d})`} fontSize={`min(calc(${d} * 0.45), max(1.125rem, calc(${d} * 0.36)))`} look={look(t.id)}>
                  {t.points}
                </Plate>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
