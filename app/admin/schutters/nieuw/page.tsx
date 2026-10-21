import type { Metadata } from "next";
import { entryAdultRank } from "@/lib/scoring";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { PageHead } from "../../kit";
import { ShooterForm } from "../shooter-form";

export const metadata: Metadata = { title: "Nieuwe schutter" };

export default async function NewShooterPage() {
  await requireRole("admin");
  const [year, ranks] = await Promise.all([currentSeasonYear(), rankDefs()]);
  return (
    <>
      <PageHead back={{ href: "/admin/schutters", label: "Schutters" }} title="Nieuwe schutter" />
      {/* Without a birthdate there's no age to go by: a new shooter starts in the lowest adult rank. */}
      <ShooterForm
        values={{ firstName: "", lastName: "", active: true, notes: "", rankCode: entryAdultRank(ranks).code }}
        ranks={ranks.map(({ code, name }) => ({ code, name }))}
        seasonYear={year}
      />
    </>
  );
}
