"use client";

import { useNow } from "@/components/use-now";
import type { PublicView } from "@/lib/competition";

/** Beside the standings: the break countdown, who shoots first, who's next, or the podium. */

const pill = "self-start rounded-pill bg-yellow px-4 py-1.5 text-[clamp(1rem,1.6cqw,1.375rem)] font-bold";
const card = "flex flex-col rounded-card border-2 border-border bg-surface p-[clamp(1.25rem,3cqw,1.875rem)]";
const heroCard = "flex flex-col rounded-hero bg-ink p-[clamp(1.5rem,3cqw,2.25rem)] text-white";
const two = (n: number) => String(n).padStart(2, "0");

/** A WSA line up next: its names when few enough to read, else how many. */
const lineup = (names: string[]) => (names.length > 6 ? `${names.length} schutters` : names.join(", "));

export function Countdown({ view }: { view: PublicView }) {
  const warmup = view.competition.status === "warmup";
  const end = view.pauseEndsAt ? Date.parse(view.pauseEndsAt) : null;
  const now = useNow(1000, end !== null);
  const left = end === null ? null : Math.max(0, Math.ceil((end - now) / 1000));
  const next = view.current?.roundLabel;
  const sub = warmup
    ? left === null
      ? "De schutters warmen op"
      : left > 0
        ? "Nog op te warmen"
        : "Opwarming voorbij"
    : next
      ? `${next} begint ${left ? "over" : "zo"}`
      : left
        ? "We gaan verder over"
        : "We gaan zo verder";
  return (
    <div className="flex flex-col gap-3.5 py-[clamp(0.5rem,2cqw,1.5rem)]">
      <span className={pill}>{warmup ? "Opwarming" : "Pauze"}</span>
      <span className="text-[clamp(1.125rem,2cqw,1.5rem)] text-muted">{sub}</span>
      {left !== null && (
        <span className="text-[clamp(6rem,15cqw,11rem)] font-semibold leading-[0.82] tracking-[-0.055em]">
          {two(Math.floor(left / 60))}:{two(left % 60)}
        </span>
      )}
    </div>
  );
}

export function FirstUp({ current }: { current: NonNullable<PublicView["current"]> }) {
  const names = current.shooters.map((s) => s.name);
  return (
    <section className={`${heroCard} gap-3.5`}>
      <span className="self-start rounded-pill bg-yellow px-3.5 py-[0.3125rem] text-[clamp(0.9375rem,1.4cqw,1.125rem)] font-bold text-ink">Als eerste</span>
      <span className="text-balance text-[clamp(1.875rem,3.6cqw,2.75rem)] font-semibold leading-[1.05] tracking-[-0.035em]">
        {names.length > 2 ? `${names.length} schutters` : names.join(" & ")}
      </span>
      <span className="text-on-ink">
        {current.roundLabel} · {current.rankName}
      </span>
    </section>
  );
}

/** The next heats; a phone only shows the first. */
export function Next({ next }: { next: PublicView["next"] }) {
  return (
    <section className={`${card} gap-4`}>
      <span className="text-[clamp(1rem,1.4cqw,1.125rem)] font-semibold text-muted">Hierna</span>
      {next.length === 0 && <span className="text-[1.0625rem] text-muted">Laatste beurt van de wedstrijd.</span>}
      {next.map((h, i) => (
        <div key={i} className={`flex flex-col gap-1.5 ${i === 0 ? "" : "border-t-2 border-divider pt-3.5 max-md:hidden"}`}>
          {i === 0 ? (
            <div className="flex flex-col gap-0.5">
              {(h.names.length > 2 ? [lineup(h.names)] : h.names).map((n) => (
                <span key={n} className="text-[clamp(1.625rem,2.8cqw,2.125rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
                  {n}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-lg font-semibold leading-tight tracking-[-0.01em]">{h.names.length > 2 ? `${h.names.length} schutters` : h.names.join(" & ")}</span>
          )}
          <span className="text-[0.9375rem] text-muted">
            {h.roundLabel} · {h.rankName} · beurt {h.heatNumber}
          </span>
        </div>
      ))}
    </section>
  );
}

/** The top three of every ranking, as on the TV at the prize-giving. */
export function Podium({ ranks }: { ranks: PublicView["ranks"] }) {
  const groups = ranks.map((r) => ({ r, top: r.rows.filter((x) => x.position !== null && x.position <= 3) })).filter((g) => g.top.length > 0);
  if (groups.length === 0) return null;
  return (
    <>
      <h2 className="text-[clamp(2.25rem,5cqw,3.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]">Podium</h2>
      {groups.map(({ r, top }) => (
        <section key={r.code} className={`${heroCard} gap-[clamp(0.875rem,2cqw,1.25rem)]`}>
          <span className="text-[clamp(1.0625rem,1.6cqw,1.25rem)] text-on-ink">{r.name}</span>
          {top.map((t) => (
            <div key={t.shooterId} className="flex min-w-0 items-baseline gap-4">
              <span
                className={`w-11 flex-none font-semibold leading-[0.9] tracking-[-0.04em] text-yellow ${t.position === 1 ? "text-[clamp(3rem,5cqw,4rem)]" : "text-[2.25rem]"}`}
              >
                {t.position}
              </span>
              <span
                className={`min-w-0 flex-1 truncate font-semibold tracking-[-0.03em] ${t.position === 1 ? "text-[clamp(1.625rem,2.4cqw,2rem)]" : "text-xl"}`}
              >
                {t.name}
              </span>
              <span className="text-lg text-on-ink">{t.total}</span>
            </div>
          ))}
        </section>
      ))}
    </>
  );
}
