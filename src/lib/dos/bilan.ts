import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { computeBlock, RPE_CIBLE } from "@/lib/backpain/periode";
import { getCurrentCran, hasAlreadyRisenThisWeek, type EvalRow } from "@/lib/backpain/progression";
import type { TrainDay } from "@/lib/workout/types";

export type Reserve = 0 | 1 | 2 | 3 | 4 | 5;

const RESERVE_TO_RPE: Record<Reserve, number> = { 0: 10, 1: 9, 2: 8, 3: 7, 4: 6, 5: 5 };

export function reserveToRpe(reserve: Reserve): number {
  return RESERVE_TO_RPE[reserve];
}

export function computeSeriesAuHaut(sets: { valeurActual: number }[], prescriptionMax: number): boolean {
  if (sets.length === 0) return false;
  return sets.every((s) => s.valeurActual >= prescriptionMax);
}

export type ArbreEvaluationInput = {
  arbre: ArbreId;
  semaine: number;
  currentCran: number;
  seriesAuHaut: boolean;
  rpeAuCibleOuMoins: boolean;
  genePendant: number;
  dejaMonteeCetteSemaine: boolean;
};

export const ARBRE_EXERCISE_ID = /^([A-J])-(\d+)$/;

export function buildArbreEvaluationInputs(params: {
  day: TrainDay;
  setsLoggedByExerciseOrder: Map<number, { valeurActual: number }[]>;
  skippedExerciseOrders: Set<number>;
  semaine: number;
  evaluations: EvalRow[];
  genePendant: number;
  reserves: Partial<Record<ArbreId, Reserve>>;
}): ArbreEvaluationInput[] {
  const bloc = computeBlock(params.semaine);
  const results: ArbreEvaluationInput[] = [];

  params.day.exercises.forEach((exercise, exerciseOrder) => {
    if (params.skippedExerciseOrders.has(exerciseOrder)) return;
    const match = exercise.id.match(ARBRE_EXERCISE_ID);
    if (!match) return;
    const arbre = match[1] as ArbreId;
    const reserve = params.reserves[arbre];
    if (reserve === undefined) return;

    const sets = params.setsLoggedByExerciseOrder.get(exerciseOrder) ?? [];
    const prescriptionMax = ARBRES[arbre].prescriptions[bloc - 1]!.max;
    const rpe = reserveToRpe(reserve);

    results.push({
      arbre,
      semaine: params.semaine,
      currentCran: getCurrentCran(params.evaluations, arbre),
      seriesAuHaut: computeSeriesAuHaut(sets, prescriptionMax),
      rpeAuCibleOuMoins: rpe <= RPE_CIBLE[bloc - 1]!,
      genePendant: params.genePendant,
      dejaMonteeCetteSemaine: hasAlreadyRisenThisWeek(params.evaluations, arbre, params.semaine),
    });
  });

  return results;
}
