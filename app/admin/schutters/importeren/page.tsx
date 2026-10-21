import type { Metadata } from "next";
import { shooterKey } from "@/lib/admin/import";
import { getDb, schema } from "@/lib/db";
import { entryAdultRank } from "@/lib/scoring";
import { rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { Lead, PageHead } from "../../kit";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Ledenlijst importeren" };

export default async function ImportPage() {
  await requireRole("admin");
  const [ranks, shooters] = await Promise.all([
    rankDefs(),
    getDb().select({ firstName: schema.shooters.firstName, lastName: schema.shooters.lastName }).from(schema.shooters),
  ]);
  return (
    <>
      <PageHead back={{ href: "/admin/schutters", label: "Schutters" }} title="Ledenlijst importeren">
        <Lead>
          Kolommen: Voornaam; Achternaam; Klasse. Zonder klasse komt een schutter in {entryAdultRank(ranks).name}. Wie al bestaat, wordt
          overgeslagen.
        </Lead>
      </PageHead>
      <ImportForm ranks={ranks} existingKeys={shooters.map(shooterKey)} />
    </>
  );
}
