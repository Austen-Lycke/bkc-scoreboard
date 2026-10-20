import type { Metadata } from "next";
import { currentSeasonYear, rankDefs } from "@/lib/server/season";
import { requireRole } from "@/lib/session";
import { ShooterForm } from "../shooter-form";

export const metadata: Metadata = { title: "Nieuwe schutter" };

export default async function NewShooterPage() {
  await requireRole("admin");
  const [year, ranks] = await Promise.all([currentSeasonYear(), rankDefs()]);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">Nieuwe schutter</h1>
      <ShooterForm values={{ firstName: "", lastName: "", birthdate: "", active: true, notes: "", rankCode: "" }} ranks={ranks} seasonYear={year} canDelete={false} />
    </div>
  );
}
