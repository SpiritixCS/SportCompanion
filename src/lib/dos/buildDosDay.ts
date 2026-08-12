import { ARBRES, type ArbreId } from "@/lib/backpain/arbres";
import { EXERCICES_FIXES, type JourEntraine } from "./exercicesFixes";
import type { TrainDay, Exercise } from "@/lib/workout/types";

export const ARBRES_DU_JOUR: Record<JourEntraine, ArbreId[]> = {
  lundi: ["A", "B", "C"],
  mardi: ["J", "H"],
  mercredi: ["D", "A"],
  jeudi: ["E", "F"],
  vendredi: ["B", "H", "I"],
  samedi: ["G", "J"],
};

export function buildDosDay(
  jour: JourEntraine,
  bloc: number,
  cranCourant: Record<ArbreId, number>,
): TrainDay {
  const fixes: Exercise[] = EXERCICES_FIXES[jour].map((e) => ({
    id: e.id,
    name: e.nom,
    movementFamily: "dos-fixe",
    countsInStats: false,
    videoId: null,
    sets: e.sets,
    target: e.target,
  }));

  const arbres: Exercise[] = ARBRES_DU_JOUR[jour].map((arbre) => {
    const cran = cranCourant[arbre];
    const arbreDef = ARBRES[arbre];
    const cranDef = arbreDef.crans[cran - 1]!;
    const prescription = arbreDef.prescriptions[bloc - 1]!;
    return {
      id: `${arbre}-${cran}`,
      name: cranDef.nom,
      movementFamily: `arbre-${arbre}`,
      countsInStats: true,
      videoId: null,
      sets: prescription.series,
      target: { unit: prescription.unite, value: [prescription.min, prescription.max], maxEffort: false, eachSide: false },
    };
  });

  return { kind: "train", label: jour, exercises: [...fixes, ...arbres] };
}
