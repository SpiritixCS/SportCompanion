import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getOrStartDosSeance, getSetsForDosSeance, getSkippedDosExercises } from "./db";

export type DosPlayerState =
  | {
      phase: "in-progress";
      seanceId: number;
      startedAt: string;
      next: NextSet;
      skippedExerciseOrders: number[];
    }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number };

export function loadDosPlayerState(
  db: Database.Database,
  date: string,
  jourSemaine: string,
  semaine: number,
  day: TrainDay,
): DosPlayerState {
  const seance = getOrStartDosSeance(db, date, jourSemaine, semaine);

  if (seance.completedAt) {
    return { phase: "completed", seanceId: seance.id };
  }

  const sets = getSetsForDosSeance(db, seance.id);
  const skippedExerciseOrders = getSkippedDosExercises(db, seance.id);
  const progress = deriveState(day, sets, new Set(skippedExerciseOrders));

  if (progress.allSetsDone) {
    return { phase: "pending-validation", seanceId: seance.id, startedAt: seance.startedAt };
  }

  return {
    phase: "in-progress",
    seanceId: seance.id,
    startedAt: seance.startedAt,
    next: progress.next,
    skippedExerciseOrders,
  };
}
