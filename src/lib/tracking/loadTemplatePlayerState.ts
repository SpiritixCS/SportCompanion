import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type TemplatePlayerState =
  | { phase: "in-progress"; seanceId: number; startedAt: string; next: NextSet; skippedExerciseOrders: number[] }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number }
  | { phase: "wrong-seance"; seanceId: number };

export function loadTemplatePlayerState(db: Database.Database, templateId: number, day: TrainDay): TemplatePlayerState {
  const seance = getOrStartSeance(db, templateId);

  if (seance.templateId !== templateId) {
    return { phase: "wrong-seance", seanceId: seance.id };
  }

  // seance.completedAt est toujours null ici — getOrStartSeance ne renvoie que
  // la séance active (non validée) ou une séance fraîchement démarrée — donc un
  // modèle reste rejouable indéfiniment, exactement comme un jour de Programme
  // (CLAUDE.md §5, « refaire un niveau »). Cette branche reprend le contrôle
  // (tout aussi inatteignable) de loadPlayerState.ts, gardée pour la parité de type.
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
