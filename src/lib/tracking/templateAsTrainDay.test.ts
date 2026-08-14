import { describe, it, expect } from "vitest";
import { templateAsTrainDay } from "./templateAsTrainDay";
import type { Template } from "./templates";

const TEMPLATE: Template = {
  id: 3,
  nom: "Push",
  createdAt: "2026-08-14T00:00:00.000Z",
  exercises: [
    { ordre: 0, name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
    { ordre: 1, name: "Planche", unit: "seconds", setsCount: 3, targetValue: 45 },
  ],
};

describe("templateAsTrainDay", () => {
  it("maps each template exercise to a TrainDay exercise with a single uniform target", () => {
    expect(templateAsTrainDay(TEMPLATE)).toEqual({
      kind: "train",
      label: "Push",
      exercises: [
        {
          id: "tpl-3-0",
          name: "Développé couché",
          movementFamily: "other",
          countsInStats: true,
          videoId: null,
          sets: 4,
          target: { unit: "reps", value: 8, maxEffort: false, eachSide: false },
        },
        {
          id: "tpl-3-1",
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

  it("maps a template with no exercises to a day with an empty exercise list", () => {
    expect(templateAsTrainDay({ ...TEMPLATE, exercises: [] }).exercises).toEqual([]);
  });
});
