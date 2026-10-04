import { describe, it, expect } from "vitest";
import { dayAsTrainDay } from "./dayAsTrainDay";
import type { TrackingProgramDay } from "./program";

const DAY: TrackingProgramDay = {
  dayOfWeek: 0,
  label: "Lundi",
  isRest: false,
  exercises: [
    { ordre: 0, name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8, restSeconds: null, pyramid: null },
    { ordre: 1, name: "Planche", unit: "seconds", setsCount: 3, targetValue: 45, restSeconds: null, pyramid: null },
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

  it("carries the per-exercise rest when set, and omits it otherwise", () => {
    const train = dayAsTrainDay({
      ...DAY,
      exercises: [
        { ordre: 0, name: "Tractions", unit: "reps", setsCount: 4, targetValue: 8, restSeconds: 120, pyramid: null },
        { ordre: 1, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12, restSeconds: null, pyramid: null },
      ],
    });
    expect(train.exercises[0]!.restSeconds).toBe(120);
    expect(train.exercises[1]).not.toHaveProperty("restSeconds");
  });

  it("turns a pyramid exercise into steps, linked to the catalogue when its name matches", () => {
    const train = dayAsTrainDay({
      ...DAY,
      exercises: [
        { ordre: 0, name: "pull ups", unit: "reps", setsCount: 11, targetValue: 6, restSeconds: null, pyramid: { shape: "inverted", peak: 6 } },
        { ordre: 1, name: "Corde", unit: "reps", setsCount: 5, targetValue: 3, restSeconds: null, pyramid: { shape: "classic", peak: 3 } },
      ],
    });
    expect(train.exercises[0]).toMatchObject({ id: "pull-ups", name: "pull ups", movementFamily: "pull", sets: 11, pyramid: { shape: "inverted", peak: 6 } });
    expect(train.exercises[1]).toMatchObject({ id: "day-0-1", movementFamily: "other", sets: 5, pyramid: { shape: "classic", peak: 3 } });
  });
});
