import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { getDb, schema } from "@/lib/db";
import { requireRole } from "@/lib/session";
import { Lead, PageHead } from "../kit";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Opstellingen" };

export default async function SetupsPage() {
  await requireRole("admin");
  const setups = await getDb().select().from(schema.setups).orderBy(asc(schema.setups.name));
  return (
    <>
      <PageHead title="Opstellingen">
        <Lead>
          De knockdowns met hun doelen. De naam is wat de scheidsrechter roept bij afkamping. Wijzigingen gelden voor nieuwe wedstrijden;
          een wedstrijd houdt de opstelling waarmee ze aangemaakt is.
        </Lead>
      </PageHead>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,22rem),1fr))] items-start gap-4">
        {setups.map((s) => (
          <SetupForm key={s.id} id={s.id} setup={s.definition} />
        ))}
      </div>
    </>
  );
}
