import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { promotionProposal } from "@/lib/server/promotion";
import { PromotionWizard } from "./promotion-wizard";

export const metadata: Metadata = { title: "Promotie" };

export default async function PromotionPage({ params }: PageProps<"/admin/seizoenen/[jaar]/promotie">) {
  const { jaar } = await params;
  const year = Number(jaar);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();
  const { ranks, rows, alreadySet, nextEntries } = await promotionProposal(year);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/seizoenen" className="text-sm text-muted hover:text-foreground">
          ← Seizoenen
        </Link>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Promotie {year} → {year + 1}
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Voorstel op basis van het klassement {year}: de top 10 van elke klasse stijgt (behalve de hoogste), juniors die op 1 januari{" "}
          {year + 1} 18 zijn gaan naar de laagste volwassen klasse, en iedereen anders blijft. Je kan elk voorstel aanpassen. Bij een
          gelijke stand op de promotiegrens beslist het bestuur.
        </p>
      </div>
      {(alreadySet > 0 || nextEntries > 0) && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Let op: voor {year + 1} zijn al {alreadySet} schutters ingedeeld
          {nextEntries > 0 ? ` en zijn er al ${nextEntries} inschrijvingen in wedstrijden van ${year + 1}` : ""}. Opnieuw opslaan overschrijft
          de klassen van de schutters hieronder.
        </p>
      )}
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-muted">Nog geen schutters ingedeeld in seizoen {year}.</p>
      ) : (
        <PromotionWizard year={year} ranks={ranks} rows={rows} />
      )}
    </div>
  );
}
