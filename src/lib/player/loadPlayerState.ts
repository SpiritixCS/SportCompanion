import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "./deriveState";
import { getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type PlayerState =
  | {
      phase: "in-progress";
      seanceId: number;
      startedAt: string;
      resumedAt: string | null;
      next: NextSet;
      skippedExerciseOrders: number[];
    }
  | { phase: "pending-validation"; seanceId: number; startedAt: string; resumedAt: string | null }
  | { phase: "completed"; seanceId: number };

export function loadPlayerState(
  db: Database.Database,
  parcours: string,
  level: number,
  dayIndex: number,
  day: TrainDay,
  cycle = 0,
): PlayerState {
  const seance = getOrStartSeance(db, parcours, level, dayIndex, cycle);

  if (seance.completedAt) {
    return { phase: "completed", seanceId: seance.id };
  }

  const sets = getSetsForSeance(db, seance.id);
  const skippedExerciseOrders = getSkippedExercises(db, seance.id);
  const progress = deriveState(day, sets, new Set(skippedExerciseOrders));

  if (progress.allSetsDone) {
    return { phase: "pending-validation", seanceId: seance.id, startedAt: seance.startedAt, resumedAt: seance.resumedAt };
  }

  return {
    phase: "in-progress",
    seanceId: seance.id,
    startedAt: seance.startedAt,
    resumedAt: seance.resumedAt,
    next: progress.next,
    skippedExerciseOrders,
  };
}
