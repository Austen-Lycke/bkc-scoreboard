"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Chip, Switch, Tag } from "@/components/ui";
import { TableCard, tableHeadClass, tableRowClass } from "../kit";

interface Row {
  id: string;
  firstName: string;
  lastName: string;
  active: boolean;
  rankCode: string | null;
  competitions: number;
}

// Phone: name and rank only; the whole row opens the shooter.
const COLS = "grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_10rem_7rem_7rem]";
const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");

/** The member list, filtered in the browser; the filters are kept in the URL (?q=, ?klasse=, ?toon=alle). */
export function ShooterList({
  shooters,
  ranks,
  seasonYear,
  initial,
}: {
  shooters: Row[];
  ranks: { code: string; name: string }[];
  seasonYear: number;
  initial: { q: string; rank: string; inactive: boolean };
}) {
  const [q, setQ] = useState(initial.q);
  const [rank, setRank] = useState(initial.rank);
  const [inactive, setInactive] = useState(initial.inactive);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (rank) params.set("klasse", rank);
    if (inactive) params.set("toon", "alle");
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }, [q, rank, inactive]);

  const needle = norm(q.trim());
  const list = shooters.filter(
    (s) =>
      (inactive || s.active) &&
      (!needle || norm(`${s.firstName} ${s.lastName}`).includes(needle) || norm(`${s.lastName} ${s.firstName}`).includes(needle)) &&
      (!rank || (rank === "geen" ? !s.rankCode : s.rankCode === rank)),
  );
  const rankName = (code: string | null) => ranks.find((r) => r.code === code)?.name;
  const filters = [{ code: "", name: "Alle klassen" }, ...ranks, { code: "geen", name: "Niet ingedeeld" }];

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op naam…"
          aria-label="Zoek op naam"
          className="w-64 rounded-[0.875rem] border-[0.09375rem] border-border bg-surface px-[0.875rem] py-2.5 text-[0.9375rem] outline-none focus:border-ink"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Klasse">
          {filters.map((r) => (
            <Chip key={r.code} on={rank === r.code} onClick={() => setRank(r.code)}>
              {r.name}
            </Chip>
          ))}
        </div>
        <Switch on={inactive} onChange={setInactive} className="ml-auto text-[0.8125rem] font-semibold">
          Ook inactieve
        </Switch>
      </div>

      <TableCard>
        <div className={`${tableHeadClass} ${COLS}`}>
          <span>Naam</span>
          <span>Klasse {seasonYear}</span>
          <span className="text-right">Wedstrijden</span>
          <span />
        </div>
        {list.map((s) => (
          <Link
            key={s.id}
            href={`/admin/schutters/${s.id}`}
            className={`${tableRowClass} ${COLS} rounded-xl py-2.5 hover:bg-hover ${s.active ? "" : "text-faint"}`}
          >
            <span className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-semibold">
              <span className="truncate">
                {s.lastName} {s.firstName}
              </span>
              {!s.active && (
                <Tag tone="muted" size="sm">
                  inactief
                </Tag>
              )}
            </span>
            <span>
              <Tag tone={s.rankCode ? "fill" : "soft"}>{rankName(s.rankCode) ?? "niet ingedeeld"}</Tag>
            </span>
            <span className="text-right text-[0.9375rem] tabular-nums max-sm:hidden">{s.competitions}</span>
            <span className="text-right text-[0.8125rem] font-semibold text-muted max-sm:hidden">Bewerken →</span>
          </Link>
        ))}
        {list.length === 0 && <p className="border-t border-divider px-[0.875rem] py-5 text-sm text-muted">Geen schutters gevonden.</p>}
      </TableCard>
      <p className="px-1 text-[0.8125rem] text-faint">
        {list.length} {list.length === 1 ? "schutter" : "schutters"}
      </p>
    </>
  );
}
