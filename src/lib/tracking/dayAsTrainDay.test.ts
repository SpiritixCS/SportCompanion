import { describe, it, expect } from "vitest";
import { dayAsTrainDay } from "./dayAsTrainDay";
import type { TrackingProgramDay } from "./program";

const DAY: TrackingProgramDay = {
  dayOfWeek: 0,
  label: "Lundi",
  isRest: false,
  exercises: [
    { ordre: 0, name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
    { ordre: 1, name: "Planche", unit: "seconds", setsCount: 3, targetValue: 45 },
  ],
};

describe("dayAsTrainDay", () => {
  it("maps each day exercise to a TrainDay exercise with a single uniform target", () => {
    expect(dayAsTrainDay(DAY)).toEqual({
      kind: "train",
      label: "Lundi",
      exercises: [
        {
          id: "day-0-0",
          name: "Développé couché",
          movementFamily: "other",
          countsInStats: true,
          videoId: null,
          sets: 4,
          target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
        },
        {
          id: "day-0-1",
          name: "Planche",
          movementFamily: "other",
          countsInStats: true,
          videoId: null,
          sets: 3,
          target: { unit: "seconds", value: 45, maxEffort: false, eachSide: false },
        },
      ],
    });
  });

  it("maps a day with no exercises to an empty exercise list", () => {
    expect(dayAsTrainDay({ ...DAY, exercises: [] }).exercises).toEqual([]);
  });
});
