/** One bar per heat of the day (shot, now, still to come), with a gap between the rounds. */

const SIZES = {
  operator: { label: "0.75rem", gap: "0.375rem", bar: "0.375rem", radius: "0.125rem", between: "0.125rem", round: "0.5rem" },
  web: { label: "0.875rem", gap: "0.5rem", bar: "0.5rem", radius: "0.1875rem", between: "0.1875rem", round: "0.625rem" },
  tv: { label: "1.375rem", gap: "0.625rem", bar: "0.875rem", radius: "0.25rem", between: "0.25rem", round: "1.25rem" },
} as const;

export function HeatProgress({
  rounds,
  current,
  variant,
  className = "",
}: {
  /** The round of every heat, in shooting order. */
  rounds: number[];
  /** Index of the heat shooting now; null when all heats are shot. */
  current: number | null;
  variant: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[variant];
  const lastRound = rounds.at(-1) ?? 1;
  return (
    <div className={`flex flex-col ${className}`} style={{ gap: s.gap }}>
      <div className="flex justify-between text-muted" style={{ fontSize: s.label }}>
        <span>Ronde 1</span>
        <span className="font-semibold text-ink">{current === null ? "Alle beurten geschoten" : `Beurt ${current + 1} van ${rounds.length}`}</span>
        <span>{lastRound > 1 ? `Ronde ${lastRound}` : ""}</span>
      </div>
      <div className="flex" style={{ gap: s.between }}>
        {rounds.map((round, i) => (
          <span
            key={i}
            className="flex-1"
            style={{
              height: s.bar,
              borderRadius: s.radius,
              marginLeft: i > 0 && rounds[i - 1] !== round ? s.round : 0,
              background: current === null || i < current ? "var(--ink)" : i === current ? "var(--yellow)" : "var(--border)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
