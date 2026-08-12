import type Database from "better-sqlite3";
import { getStartDate, getEvaluations } from "@/lib/backpain/db";
import { computeWeek, computeBlock } from "@/lib/backpain/periode";
import { getCurrentCran } from "@/lib/backpain/progression";
import type { ArbreId } from "@/lib/backpain/arbres";
import { getJourSemaine } from "./schedule";
import { buildDosDay, ARBRES_DU_JOUR } from "./buildDosDay";
import { getDosSeanceByDate, getSetsForDosSeance, getSkippedDosExercises } from "./db";
import { deriveState } from "@/lib/player/deriveState";
import { formatTarget } from "@/lib/player/formatTarget";

const INTITULES: Record<keyof typeof ARBRES_DU_JOUR, string> = {
  lundi: "Charnière & chaîne postérieure",
  mardi: "Contrôle moteur & dissociation",
  mercredi: "Genou & unilatéral",
  jeudi: "Tirage",
  vendredi: "Fessiers, latéral & portés",
  samedi: "Poussée & core suspendu",
};

export type DosTodayState =
  | { phase: "no-start-date" }
  | { phase: "rest" }
  | {
      phase: "normal";
      jourLabel: string;
      intitule: string;
      exercisesPreview: { name: string; dose: string }[];
      exercisesRestCount: number;
      done: boolean;
      doneReps: number | null;
      resume: { exerciseName: string } | null;
    };

export function loadDosTodayState(db: Database.Database): DosTodayState {
  const startDate = getStartDate(db);
  if (!startDate) return { phase: "no-start-date" };

  const today = new Date().toISOString().slice(0, 10);
  const jourSemaine = getJourSemaine(today);
  if (jourSemaine === "dimanche") return { phase: "rest" };

  const semaine = computeWeek(startDate, today);
  const bloc = computeBlock(semaine);
  const evaluations = getEvaluations(db);
  const cranCourant = {} as Record<ArbreId, number>;
  for (const arbre of ARBRES_DU_JOUR[jourSemaine]) {
    cranCourant[arbre] = getCurrentCran(evaluations, arbre);
  }
  const day = buildDosDay(jourSemaine, bloc, cranCourant);

  const seance = getDosSeanceByDate(db, today);
  let done = false;
  let doneReps: number | null = null;
  let resume: { exerciseName: string } | null = null;

  if (seance) {
    const sets = getSetsForDosSeance(db, seance.id);
    const skipped = getSkippedDosExercises(db, seance.id);
    if (seance.completedAt) {
      done = true;
      doneReps = sets.reduce((sum, s) => sum + s.valeurActual, 0);
    } else {
      const progress = deriveState(day, sets, new Set(skipped));
      if (!progress.allSetsDone) {
        resume = { exerciseName: day.exercises[progress.next.exerciseOrder]!.name };
      }
    }
  }

  return {
    phase: "normal",
    jourLabel: jourSemaine[0]!.toUpperCase() + jourSemaine.slice(1),
    intitule: INTITULES[jourSemaine],
    exercisesPreview: day.exercises.slice(0, 3).map((e) => ({ name: e.name, dose: formatTarget(e.sets, e.target) })),
    exercisesRestCount: Math.max(0, day.exercises.length - 3),
    done,
    doneReps,
    resume,
  };
}
