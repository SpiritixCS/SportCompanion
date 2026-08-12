import path from "node:path";
import { getDb } from "@/lib/db/client";
import { getEvaluations } from "@/lib/backpain/db";
import { getCurrentCran } from "@/lib/backpain/progression";
import { ARBRES } from "@/lib/backpain/arbres";
import { getDosSeanceById } from "@/lib/dos/db";
import { ARBRES_DU_JOUR } from "@/lib/dos/buildDosDay";
import { completeDosSeanceAction } from "@/lib/dos/actions";
import { BilanDosClient } from "@/components/dos/BilanDosClient";

export const dynamic = "force-dynamic";

function dbPath(): string {
  return process.env.DB_PATH ?? path.join(process.cwd(), "data", "sportcompanion.db");
}

export default async function DosBilanPage({
  searchParams,
}: {
  searchParams: Promise<{ seanceId?: string }>;
}) {
  const params = await searchParams;
  const seanceId = Number(params.seanceId);
  const db = getDb(dbPath());
  const seance = getDosSeanceById(db, seanceId);

  if (!seance) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Séance introuvable.</p>
      </main>
    );
  }

  const jourArbres = ARBRES_DU_JOUR[seance.jourSemaine as keyof typeof ARBRES_DU_JOUR] ?? [];
  const evaluations = getEvaluations(db);
  const arbres = jourArbres.map((arbre) => {
    const cran = getCurrentCran(evaluations, arbre);
    return { arbre, nom: ARBRES[arbre].crans[cran - 1]!.nom };
  });

  return <BilanDosClient seanceId={seanceId} arbres={arbres} completeAction={completeDosSeanceAction} />;
}
