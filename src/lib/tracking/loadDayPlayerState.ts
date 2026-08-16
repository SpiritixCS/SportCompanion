import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type DayPlayerState =
  | { phase: "in-progress"; seanceId: number; startedAt: string; next: NextSet; skippedExerciseOrders: number[] }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number }
  | { phase: "wrong-seance"; seanceId: number };

export function loadDayPlayerState(db: Database.Database, dayOfWeek: number, day: TrainDay): DayPlayerState {
  const seance = getOrStartSeance(db, dayOfWeek);

  if (seance.dayOfWeek !== dayOfWeek) {
    return { phase: "wrong-seance", seanceId: seance.id };
  }

  // seance.completedAt est toujours null ici — getOrStartSeance ne renvoie que
  // la séance active (non validée) ou une séance fraîchement démarrée — donc un
  // jour reste rejouable indéfiniment, exactement comme un jour de Programme
  // (CLAUDE.md §5, « refaire un niveau »). Cette branche reste inatteignable,
  // gardée pour la parité de type avec loadPlayerState.ts.
  if (seance.completedAt) {
    return { phase: "completed", seanceId: seance.id };
  }

  const sets = getSetsForSeance(db, seance.id);
  const skippedExerciseOrders = getSkippedExercises(db, seance.id);
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
