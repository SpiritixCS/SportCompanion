import type { TrainDay } from "@/lib/workout/types";
import type { Template } from "./templates";

// A synthetic exercise id, e.g. "tpl-3-0" — only ever used as an image-src
// key by ExerciseView (`/exercises/{id}.jpg`); a missing file already falls
// back gracefully there (imageFailed), so no thumbnail is needed for a
// user-authored exercise.
export function templateAsTrainDay(template: Template): TrainDay {
  return {
    kind: "train",
    label: template.nom,
    exercises: template.exercises.map((exercise) => ({
      id: `tpl-${template.id}-${exercise.ordre}`,
      name: exercise.name,
      movementFamily: "other",
      countsInStats: true,
      videoId: null,
      sets: exercise.setsCount,
      target: { unit: exercise.unit, value: exercise.targetValue, maxEffort: false, eachSide: false },
    })),
  };
}
