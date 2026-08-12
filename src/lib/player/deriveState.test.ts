import { describe, it, expect } from "vitest";
import { deriveState } from "./deriveState";
import type { TrainDay } from "@/lib/workout/types";

const DAY: TrainDay = {
  kind: "train",
  label: "Day 1",
  exercises: [
    {
      id: "push-ups",
      name: "Push ups",
      movementFamily: "push",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 10, maxEffort: false, eachSide: false },
    },
    {
      id: "squats",
      name: "Squats",
      movementFamily: "legs",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 15, maxEffort: false, eachSide: false },
    },
  ],
};

const DAY_3_EXERCISES: TrainDay = {
  kind: "train",
  label: "Day 2",
  exercises: [
    {
      id: "push-ups",
      name: "Push ups",
      movementFamily: "push",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 10, maxEffort: false, eachSide: false },
    },
    {
      id: "squats",
      name: "Squats",
      movementFamily: "legs",
      countsInStats: true,
      videoId: null,
      sets: 2,
      target: { unit: "reps", value: 15, maxEffort: false, eachSide: false },
    },
    {
      id: "pull-ups",
      name: "Pull ups",
      movementFamily: "pull",
      countsInStats: true,
      videoId: null,
      sets: 3,
      target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
    },
  ],
};

describe("deriveState", () => {
  it("points to the first set of the first exercise when nothing is logged", () => {
    const result = deriveState(DAY, []);
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: false },
    });
  });

  it("points to the next unlogged set within the same exercise", () => {
    const result = deriveState(DAY, [{ exerciseOrder: 0, setNumber: 1 }]);
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 0, setNumber: 2, isLastSetOfExercise: true, isLastExerciseOfDay: false },
    });
  });

  it("moves to the next exercise once the current one's sets are all logged", () => {
    const result = deriveState(DAY, [
      { exerciseOrder: 0, setNumber: 1 },
      { exerciseOrder: 0, setNumber: 2 },
    ]);
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 1, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true },
    });
  });

  it("reports allSetsDone once every set of every exercise is logged", () => {
    const result = deriveState(DAY, [
      { exerciseOrder: 0, setNumber: 1 },
      { exerciseOrder: 0, setNumber: 2 },
      { exerciseOrder: 1, setNumber: 1 },
      { exerciseOrder: 1, setNumber: 2 },
    ]);
    expect(result).toEqual({ allSetsDone: true, next: null });
  });

  it("skips over a wholesale-skipped exercise when computing next", () => {
    const result = deriveState(DAY, [], new Set([0]));
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 1, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true },
    });
  });

  it("reports allSetsDone when the only remaining exercise is skipped", () => {
    const result = deriveState(
      DAY,
      [{ exerciseOrder: 0, setNumber: 1 }, { exerciseOrder: 0, setNumber: 2 }],
      new Set([1]),
    );
    expect(result).toEqual({ allSetsDone: true, next: null });
  });

  // Tests for remainingAfterAreAllSkipped multi-iteration lookahead (3+ exercise scenarios)
  it("returns isLastExerciseOfDay: false when next exercise is skipped but a further one is not", () => {
    // At exercise 0, exercise 1 is skipped, but exercise 2 is not
    // Loop must iterate past index 1 and find index 2 is unskipped
    const result = deriveState(DAY_3_EXERCISES, [], new Set([1]));
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: false },
    });
  });

  it("returns isLastExerciseOfDay: true when all trailing exercises are skipped", () => {
    // At exercise 0, exercises 1 and 2 are both skipped
    // Loop must iterate through both before returning true
    const result = deriveState(DAY_3_EXERCISES, [], new Set([1, 2]));
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true },
    });
  });

  it("correctly handles non-contiguous skip pattern when scanning ahead", () => {
    // At exercise 0, exercise 1 is skipped but exercise 2 is not
    // The loop must skip index 1, then find 2 is not skipped, returning false
    // Complete first exercise and move to next
    const result = deriveState(
      DAY_3_EXERCISES,
      [
        { exerciseOrder: 0, setNumber: 1 },
        { exerciseOrder: 0, setNumber: 2 },
      ],
      new Set([1]),
    );
    expect(result).toEqual({
      allSetsDone: false,
      next: { exerciseOrder: 2, setNumber: 1, isLastSetOfExercise: false, isLastExerciseOfDay: true },
    });
  });
});
