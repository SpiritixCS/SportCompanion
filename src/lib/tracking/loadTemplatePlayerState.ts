import type Database from "better-sqlite3";
import type { TrainDay } from "@/lib/workout/types";
import { deriveState, type NextSet } from "@/lib/player/deriveState";
import { getActiveSeance, getOrStartSeance, getSetsForSeance, getSkippedExercises } from "./db";

export type TemplatePlayerState =
  | { phase: "in-progress"; seanceId: number; startedAt: string; next: NextSet; skippedExerciseOrders: number[] }
  | { phase: "pending-validation"; seanceId: number; startedAt: string }
  | { phase: "completed"; seanceId: number }
  | { phase: "wrong-seance"; seanceId: number };

function progressForActiveSeance(
  db: Database.Database,
  seanceId: number,
  startedAt: string,
  day: TrainDay,
): TemplatePlayerState {
  const sets = getSetsForSeance(db, seanceId);
  const skippedExerciseOrders = getSkippedExercises(db, seanceId);
  const progress = deriveState(day, sets, new Set(skippedExerciseOrders));

  if (progress.allSetsDone) {
    return { phase: "pending-validation", seanceId, startedAt };
  }
  return { phase: "in-progress", seanceId, startedAt, next: progress.next, skippedExerciseOrders };
}

// db.ts only tracks "the" currently active seance across templates (product
// invariant: at most one active at a time) — it has no lookup for "the most
// recent seance of this specific template, active or not". Once that seance
// is validated it drops out of getActiveSeance entirely, so without this we
// couldn't tell "just completed, show the recap" apart from "never started".
function getMostRecentSeanceForTemplate(
  db: Database.Database,
  templateId: number,
): { id: number; completedAt: string | null } | null {
  const row = db
    .prepare(`SELECT id, completed_at AS completedAt FROM tracking_seances WHERE template_id = ? ORDER BY id DESC LIMIT 1`)
    .get(templateId) as { id: number; completedAt: string | null } | undefined;
  return row ?? null;
}

export function loadTemplatePlayerState(db: Database.Database, templateId: number, day: TrainDay): TemplatePlayerState {
  const active = getActiveSeance(db);
  if (active) {
    if (active.templateId !== templateId) {
      return { phase: "wrong-seance", seanceId: active.id };
    }
    return progressForActiveSeance(db, active.id, active.startedAt, day);
  }

  const mostRecent = getMostRecentSeanceForTemplate(db, templateId);
  if (mostRecent && mostRecent.completedAt) {
    return { phase: "completed", seanceId: mostRecent.id };
  }

  const seance = getOrStartSeance(db, templateId);
  return progressForActiveSeance(db, seance.id, seance.startedAt, day);
}
