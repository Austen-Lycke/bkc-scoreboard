import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { formatCompactDate } from "@/components/public/format";
import { pillClass } from "@/components/styles";
import { Empty, Tag } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { competitionStatus, PageHead, TableCard, tableHeadClass, tableRowClass } from "../kit";

export const metadata: Metadata = { title: "Wedstrijden" };

const COLS = "grid-cols-[7.5rem_minmax(0,1fr)_9rem_6rem_15rem]";

export default async function CompetitionsAdminPage() {
  await requireRole("admin");
  const { competitions } = schema;
  const [year, rows] = await Promise.all([
    currentSeasonYear(),
    getDb()
      .select({
        id: competitions.id,
        name: competitions.name,
        date: competitions.date,
        status: competitions.status,
        countsForSeason: competitions.countsForSeason,
        entries: sql<number>`(select count(*)::int from entries e where e.competition_id = ${competitions.id})`,
      })
      .from(competitions)
      .orderBy(desc(competitions.date)),
  ]);

  return (
    <>
      <PageHead
        title="Wedstrijden"
        actions={
          <Link href="/operator" className={pillClass("ink")}>
            Nieuwe wedstrijd · wedstrijdleiding
          </Link>
        }
      />
      {rows.length === 0 ? (
        <Empty>Nog geen wedstrijden. De wedstrijdleiding maakt ze aan.</Empty>
      ) : (
        <TableCard>
          <div className={`${tableHeadClass} ${COLS}`}>
            <span>Datum</span>
            <span>Naam</span>
            <span>Status</span>
            <span className="text-right">Schutters</span>
            <span />
          </div>
          {rows.map((c) => {
            const status = competitionStatus(c.status);
            return (
              <div key={c.id} className={`${tableRowClass} ${COLS} py-2.5`}>
                <span className="text-sm text-muted tabular-nums">{formatCompactDate(c.date, !c.date.startsWith(String(year)))}</span>
                <span className="flex min-w-0 items-center gap-2 text-[0.9375rem] font-semibold">
                  <span className="truncate">{c.name}</span>
                  {!c.countsForSeason && (
                    <Tag tone="muted" size="sm">
                      telt niet mee
                    </Tag>
                  )}
                </span>
                <span>
                  <Tag tone={status.tone}>{status.label}</Tag>
                </span>
                <span className="text-right text-[0.9375rem] tabular-nums">{c.entries}</span>
                <span className="flex justify-end gap-1.5">
                  <a href={`/api/admin/export/competitions/${c.id}`} className={pillClass("quiet", "xs")}>
                    CSV
                  </a>
                  <Link href={`/admin/wedstrijden/${c.id}/afdrukken`} className={pillClass("quiet", "xs")}>
                    Afdrukken
                  </Link>
                  <Link href={`/admin/wedstrijden/${c.id}`} className={pillClass("ink", "xs")}>
                    Bewerken
                  </Link>
                </span>
              </div>
            );
          })}
        </TableCard>
      )}
    </>
  );
}
