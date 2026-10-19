import type { Metadata } from "next";
import Link from "next/link";
import { shooterKey } from "@/lib/admin/import";
import { getDb, schema } from "@/lib/db";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { ImportForm } from "./import-form";

export const metadata: Metadata = { title: "Ledenlijst importeren" };

export default async function ImportPage() {
  const [year, ranks, shooters] = await Promise.all([currentSeasonYear(), rankDefs(), getDb().select().from(schema.shooters)]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/schutters" className="text-sm text-muted hover:text-foreground">
          ← Schutters
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Ledenlijst importeren</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Gebruik een CSV-bestand (vanuit Excel: <em>Opslaan als → CSV</em>) met als eerste rij de kolommen{" "}
          <strong>Voornaam</strong>, <strong>Achternaam</strong>, <strong>Geboortedatum</strong> en optioneel <strong>Klasse</strong>. Zonder
          klasse wordt iemand onder 18 Junior en anders {ranks.find((r) => !r.isJunior)?.name}. Wie al bestaat (zelfde naam en
          geboortedatum) wordt overgeslagen. De klasse geldt voor seizoen {year}.
        </p>
      </div>
      <ImportForm ranks={ranks} seasonYear={year} existingKeys={shooters.map(shooterKey)} />
    </div>
  );
}
