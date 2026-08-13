"use server";

import { redirect } from "next/navigation";
import { getDbForUser } from "@/lib/db/client";
import { currentUser } from "@/lib/auth/currentUser";
import { setStartDate, getEvaluations, recordEvaluation } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { evaluateProgression, getCurrentCran } from "@/lib/backpain/progression";
import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { buildDosDay, ARBRES_DU_JOUR } from "./buildDosDay";
import {
  logDosSet,
  skipDosExercise,
  getSetsForDosSeance,
  getSkippedDosExercises,
  completeDosSeance,
  getDosSeanceById,
} from "./db";
import { buildArbreEvaluationInputs, type Reserve } from "./bilan";

async function db() {
  return getDbForUser(await currentUser());
}

export async function setStartDateAction(date: string): Promise<void> {
  setStartDate(await db(), date);
}

// External signature matches src/lib/player/actions.ts's logSetAction exactly
// (repsTarget/repsActual, not valeurTarget/valeurActual) so PlayerScreen's
// onLogSet prop (Task 8) can take either action interchangeably — Next.js
// requires a Server Action passed across the Server->Client boundary to be
// the action itself, not a page-level wrapper closure. The DB layer
// (logDosSet, Task 5) keeps the domain-honest valeur_target/valeur_actual
// naming; this is the one place that renames at the boundary.
export async function logDosSetAction(params: {
  seanceId: number;
  exerciseOrder: number;
  exerciseId: string;
  setNumber: number;
  repsTarget: string;
  repsActual: number;
  restSeconds: number;
}): Promise<void> {
  logDosSet(await db(), {
    seanceId: params.seanceId,
    exerciseOrder: params.exerciseOrder,
    exerciseId: params.exerciseId,
    setNumber: params.setNumber,
    valeurTarget: params.repsTarget,
    valeurActual: params.repsActual,
    restSeconds: params.restSeconds,
  });
}

export async function skipDosExerciseAction(seanceId: number, exerciseOrder: number): Promise<void> {
  skipDosExercise(await db(), seanceId, exerciseOrder);
}

export async function startDosBilanAction(seanceId: number): Promise<never> {
  redirect(`/player/dos/bilan?seanceId=${seanceId}`);
}

export async function completeDosSeanceAction(
  seanceId: number,
  genePendant: number,
  reserves: Partial<Record<ArbreId, Reserve>>,
): Promise<{ arbre: ArbreId; nom: string; message: string }[]> {
  const database = await db();
  const seance = getDosSeanceById(database, seanceId)!;

  // Idempotency guard against a double-tap (or a slow network + impatient
  // second tap) on "Valider la séance": without this, a second pass would
  // re-run recordEvaluation and see the first pass's own "montee" row via
  // hasAlreadyRisenThisWeek, flipping the result to a misleading "plafond"
  // message. The user already saw the real messages on the first submit,
  // so an empty result list here is fine — nothing new to re-evaluate.
  if (seance.completedAt) {
    return [];
  }

  const bloc = computeBlock(seance.semaine);

  const cranCourant = {} as Record<ArbreId, number>;
  const allEvaluations = getEvaluations(database);
  const jourArbres = ARBRES_DU_JOUR[seance.jourSemaine as keyof typeof ARBRES_DU_JOUR] ?? [];
  for (const arbre of jourArbres) {
    cranCourant[arbre] = getCurrentCran(allEvaluations, arbre);
  }

  const day = buildDosDay(seance.jourSemaine as keyof typeof ARBRES_DU_JOUR, bloc, cranCourant);
  const sets = getSetsForDosSeance(database, seanceId);
  const setsByExerciseOrder = new Map<number, { valeurActual: number }[]>();
  for (const set of sets) {
    const list = setsByExerciseOrder.get(set.exerciseOrder) ?? [];
    list.push({ valeurActual: set.valeurActual });
    setsByExerciseOrder.set(set.exerciseOrder, list);
  }
  const skipped = new Set(getSkippedDosExercises(database, seanceId));

  const inputs = buildArbreEvaluationInputs({
    day,
    setsLoggedByExerciseOrder: setsByExerciseOrder,
    skippedExerciseOrders: skipped,
    semaine: seance.semaine,
    evaluations: allEvaluations,
    genePendant,
    reserves,
  });

  const results: { arbre: ArbreId; nom: string; message: string }[] = [];
  for (const input of inputs) {
    const result = evaluateProgression(input);
    recordEvaluation(database, {
      arbre: input.arbre,
      semaine: input.semaine,
      cranApres: result.cranApres,
      resultat: result.resultat,
      horodatage: new Date().toISOString(),
    });
    results.push({ arbre: input.arbre, nom: ARBRES[input.arbre].nom, message: result.message });
  }

  completeDosSeance(database, seanceId, genePendant);
  return results;
}
