import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Empty } from "@/components/ui";
import { promotionProposal } from "@/lib/server/promotion";
import { requireRole } from "@/lib/session";
import { Lead, PageHead } from "../../../kit";
import { PromotionWizard } from "./promotion-wizard";

export const metadata: Metadata = { title: "Promotie" };

export default async function PromotionPage({ params }: PageProps<"/admin/seizoenen/[jaar]/promotie">) {
  await requireRole("admin");
  const { jaar } = await params;
  const year = Number(jaar);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) notFound();
  const { ranks, rows, alreadySet, nextEntries } = await promotionProposal(year);
  const entryRank = ranks.find((r) => !r.isJunior)?.name ?? "de laagste klasse";

  return (
    <>
      <PageHead back={{ href: "/admin/seizoenen", label: "Seizoenen" }} title={`Promotie ${year} → ${year + 1}`}>
        <Lead>
          Voorstel op basis van het klassement {year}: de top 10 van elke klasse stijgt (behalve de hoogste) en iedereen anders blijft.
          Juniors blijven Junior; zet wie 18 wordt zelf in {entryRank}. Je kan elk voorstel aanpassen. Bij een gelijke stand op de
          promotiegrens beslist het bestuur.
        </Lead>
      </PageHead>
      {(alreadySet > 0 || nextEntries > 0) && (
        <p className="text-pretty rounded-2xl bg-yellow-light px-[1.125rem] py-3 text-sm">
          <strong className="font-semibold">Let op:</strong> voor {year + 1} zijn al {alreadySet} schutters ingedeeld
          {nextEntries > 0 ? ` en zijn er al ${nextEntries} inschrijvingen in wedstrijden van ${year + 1}` : ""}. Opnieuw opslaan overschrijft
          de klassen van de schutters hieronder.
        </p>
      )}
      {rows.length === 0 ? <Empty>Nog geen schutters ingedeeld in seizoen {year}.</Empty> : <PromotionWizard year={year} ranks={ranks} rows={rows} />}
    </>
  );
}
