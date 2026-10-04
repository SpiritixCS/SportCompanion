// src/lib/tracking/dayAsTrainDay.ts
import type { TrainDay } from "@/lib/workout/types";
import type { TrackingProgramDay } from "./program";

// A synthetic exercise id, e.g. "day-0-0" — only ever used as an image-src
// key by ExerciseView (`/exercises/{id}.jpg`); a missing file already falls
// back gracefully there (imageFailed), so no thumbnail is needed for a
// user-authored exercise.
export function dayAsTrainDay(day: TrackingProgramDay): TrainDay {
  return {
    kind: "train",
    label: day.label,
    exercises: day.exercises.map((exercise) => ({
      id: `day-${day.dayOfWeek}-${exercise.ordre}`,
      name: exercise.name,
      movementFamily: "other",
      countsInStats: true,
      videoId: null,
      sets: exercise.setsCount,
      target: { unit: exercise.unit, value: exercise.targetValue, maxEffort: false, eachSide: false },
      ...(exercise.restSeconds != null && { restSeconds: exercise.restSeconds }),
    })),
  };
}
