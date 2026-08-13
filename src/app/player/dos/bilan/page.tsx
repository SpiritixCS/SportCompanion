import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { getEvaluations } from "@/lib/backpain/db";
import { getCurrentCran } from "@/lib/backpain/progression";
import { computeBlock } from "@/lib/backpain/periode";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { getDosSeanceById, getSkippedDosExercises } from "@/lib/dos/db";
import { buildDosDay, ARBRES_DU_JOUR } from "@/lib/dos/buildDosDay";
import { completeDosSeanceAction } from "@/lib/dos/actions";
import { ARBRE_EXERCISE_ID } from "@/lib/dos/bilan";
import { BilanDosClient } from "@/components/dos/BilanDosClient";

export const dynamic = "force-dynamic";

export default async function DosBilanPage({
  searchParams,
}: {
  searchParams: Promise<{ seanceId?: string }>;
}) {
  const user = await currentUser();
  if (user.slug !== "mathis") redirect("/");

  const params = await searchParams;
  const seanceId = Number(params.seanceId);
  const db = getDbForUser(user);
  const seance = getDosSeanceById(db, seanceId);

  if (!seance) {
    return (
      <main className="p-5">
        <p className="text-15 text-graphite">Séance introuvable.</p>
      </main>
    );
  }

  const jourSemaine = seance.jourSemaine as keyof typeof ARBRES_DU_JOUR;
  const jourArbres = ARBRES_DU_JOUR[jourSemaine] ?? [];
  const evaluations = getEvaluations(db);
  const cranCourant = {} as Record<ArbreId, number>;
  for (const arbre of jourArbres) {
    cranCourant[arbre] = getCurrentCran(evaluations, arbre);
  }

  // Don't ask for a reserve answer on an exercise the user explicitly
  // skipped during the session — buildArbreEvaluationInputs discards it
  // anyway, so asking is pure friction with no correctness upside.
  const day = buildDosDay(jourSemaine, computeBlock(seance.semaine), cranCourant);
  const skipped = new Set(getSkippedDosExercises(db, seanceId));
  const skippedArbres = new Set(
    day.exercises
      .map((exercise, exerciseOrder) => ({ exercise, exerciseOrder }))
      .filter(({ exerciseOrder }) => skipped.has(exerciseOrder))
      .map(({ exercise }) => exercise.id.match(ARBRE_EXERCISE_ID)?.[1])
      .filter((arbre): arbre is ArbreId => arbre !== undefined),
  );

  const arbres = jourArbres
    .filter((arbre) => !skippedArbres.has(arbre))
    .map((arbre) => {
      const cran = cranCourant[arbre];
      return { arbre, nom: ARBRES[arbre].crans[cran - 1]!.nom };
    });

  return <BilanDosClient seanceId={seanceId} arbres={arbres} completeAction={completeDosSeanceAction} />;
}
