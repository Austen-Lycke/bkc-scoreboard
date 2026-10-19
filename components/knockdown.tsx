import type { Setup } from "@/lib/scoring";

interface KnockdownProps {
  setup: Setup;
  hits: readonly string[];
  /** Makes plates clickable (operator). */
  onToggle?: (targetId: string) => void;
  /** Shows keyboard shortcuts 1–n under the plates. */
  showKeys?: boolean;
  /** "operator": light UI, hits in green. "tv": dark stage, hits light up gold. */
  variant?: "operator" | "tv";
  /** Highlights one plate, e.g. the target the judge just called during afkamping. */
  highlight?: string | null;
  className?: string;
  label?: string;
}

const STEM_W = 22;
const STEM_H = 70;
const BADGE_R = 19;

/**
 * The knockdown rack, drawn to scale from the plate sizes (mm): rows of paddle-shaped plates with
 * their points above them, like the real Spanish/WSA stands.
 */
export function Knockdown({ setup, hits, onToggle, showKeys, variant = "operator", highlight, className, label }: KnockdownProps) {
  const hitSet = new Set(hits);
  const rows = [...new Set(setup.targets.map((t) => t.row))].sort((a, b) => a - b);
  const maxSize = Math.max(...setup.targets.map((t) => t.sizeMm));
  const slot = maxSize + 45;
  const perRow = rows.map((r) => setup.targets.filter((t) => t.row === r));
  const widest = Math.max(...perRow.map((r) => r.length));
  const width = widest * slot + 40;
  const rowHeight = BADGE_R * 2 + 14 + maxSize + STEM_H + (showKeys ? 34 : 14);
  const height = rows.length * rowHeight;
  const tv = variant === "tv";
  let keyIndex = 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role={onToggle ? "group" : "img"}
      aria-label={label ?? `${setup.name}: ${hits.length} van ${setup.targets.length} geraakt`}
    >
      {perRow.map((targets, r) => {
        const top = r * rowHeight;
        const railY = top + BADGE_R * 2 + 14 + maxSize + STEM_H;
        const offset = (width - targets.length * slot) / 2;
        return (
          <g key={r}>
            <rect
              x={offset - 10}
              y={railY - 4}
              width={targets.length * slot + 20}
              height={6}
              rx={3}
              className={tv ? "fill-white/25" : "fill-[var(--border)]"}
            />
            {targets.map((t, i) => {
              const key = ++keyIndex;
              const hit = hitSet.has(t.id);
              const cx = offset + i * slot + slot / 2;
              const radius = t.sizeMm / 2;
              const cy = railY - STEM_H - radius + 8;
              const plateClass = hit
                ? tv
                  ? "fill-[var(--gold)] drop-shadow-[0_0_18px_rgba(201,162,39,0.85)]"
                  : "fill-[var(--hit)]"
                : tv
                  ? "fill-white/90"
                  : "fill-white stroke-[var(--muted)]";
              const isHighlighted = highlight === t.id;
              return (
                <g
                  key={t.id}
                  onClick={onToggle ? () => onToggle(t.id) : undefined}
                  className={onToggle ? "cursor-pointer" : undefined}
                  role={onToggle ? "button" : undefined}
                  aria-pressed={onToggle ? hit : undefined}
                  aria-label={onToggle ? `${t.label} (${t.points} ptn)${hit ? ", geraakt" : ""}` : undefined}
                >
                  {/* generous hit area for touch */}
                  <rect x={cx - slot / 2} y={top} width={slot} height={rowHeight} fill="transparent" />
                  {isHighlighted && (
                    <circle cx={cx} cy={cy} r={radius + 14} className="fill-none stroke-[var(--gold)]" strokeWidth={5} strokeDasharray="10 7" />
                  )}
                  <g className="transition-[fill] duration-200">
                    <rect x={cx - STEM_W / 2} y={cy} width={STEM_W} height={railY - cy} rx={4} className={plateClass} strokeWidth={2} />
                    <circle cx={cx} cy={cy} r={radius} className={plateClass} strokeWidth={2} />
                  </g>
                  {hit && !tv && (
                    <path
                      d={`M ${cx - radius * 0.35} ${cy} l ${radius * 0.25} ${radius * 0.25} l ${radius * 0.45} -${radius * 0.5}`}
                      className="fill-none stroke-white"
                      strokeWidth={Math.max(5, radius * 0.12)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <circle
                    cx={cx}
                    cy={top + BADGE_R + 2}
                    r={BADGE_R}
                    className={hit ? "fill-[var(--gold)]" : tv ? "fill-white/10 stroke-white/50" : "fill-[var(--navy)]"}
                    strokeWidth={1.5}
                  />
                  <text
                    x={cx}
                    y={top + BADGE_R + 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className={hit ? "fill-[var(--navy)]" : "fill-white"}
                    style={{ font: "600 19px var(--font-geist-sans)" }}
                  >
                    {t.points}
                  </text>
                  {showKeys && (
                    <text
                      x={cx}
                      y={railY + 24}
                      textAnchor="middle"
                      className="fill-[var(--muted)]"
                      style={{ font: "500 15px var(--font-geist-mono)" }}
                    >
                      {key}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
