import type { TrainDay } from "@/lib/workout/types";

export type SetLoggedRow = {
  exerciseOrder: number;
  setNumber: number;
};

export type NextSet = {
  exerciseOrder: number;
  setNumber: number;
  isLastSetOfExercise: boolean;
  isLastExerciseOfDay: boolean;
};

export type DerivedProgress =
  | { allSetsDone: false; next: NextSet }
  | { allSetsDone: true; next: null };

function remainingAfterAreAllSkipped(
  day: TrainDay,
  exerciseOrder: number,
  skipped: Set<number>,
): boolean {
  for (let i = exerciseOrder + 1; i < day.exercises.length; i++) {
    if (!skipped.has(i)) return false;
  }
  return true;
}

export function deriveState(
  day: TrainDay,
  setsLogged: SetLoggedRow[],
  skippedExerciseOrders: Set<number> = new Set(),
): DerivedProgress {
  const logged = new Set(setsLogged.map((s) => `${s.exerciseOrder}:${s.setNumber}`));

  for (let exerciseOrder = 0; exerciseOrder < day.exercises.length; exerciseOrder++) {
    if (skippedExerciseOrders.has(exerciseOrder)) continue;

    const exercise = day.exercises[exerciseOrder]!;
    for (let setNumber = 1; setNumber <= exercise.sets; setNumber++) {
      if (!logged.has(`${exerciseOrder}:${setNumber}`)) {
        return {
          allSetsDone: false,
          next: {
            exerciseOrder,
            setNumber,
            isLastSetOfExercise: setNumber === exercise.sets,
            isLastExerciseOfDay: remainingAfterAreAllSkipped(day, exerciseOrder, skippedExerciseOrders),
          },
        };
      }
    }
  }

  return { allSetsDone: true, next: null };
}
