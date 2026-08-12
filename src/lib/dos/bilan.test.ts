import { describe, it, expect } from "vitest";
import { reserveToRpe, computeSeriesAuHaut, buildArbreEvaluationInputs } from "./bilan";
import type { TrainDay } from "@/lib/workout/types";
import type { EvalRow } from "@/lib/backpain/progression";

describe("reserveToRpe", () => {
  it("maps the full §2 table, reserve 4 distinct from 5", () => {
    expect(reserveToRpe(0)).toBe(10);
    expect(reserveToRpe(1)).toBe(9);
    expect(reserveToRpe(2)).toBe(8);
    expect(reserveToRpe(3)).toBe(7);
    expect(reserveToRpe(4)).toBe(6);
    expect(reserveToRpe(5)).toBe(5);
  });
});

describe("computeSeriesAuHaut", () => {
  it("is false with no logged sets", () => {
    expect(computeSeriesAuHaut([], 10)).toBe(false);
  });

  it("is true only when every set reaches the max", () => {
    expect(computeSeriesAuHaut([{ valeurActual: 10 }, { valeurActual: 10 }], 10)).toBe(true);
    expect(computeSeriesAuHaut([{ valeurActual: 10 }, { valeurActual: 9 }], 10)).toBe(false);
  });

  it("a set above the max still counts as reaching it", () => {
    expect(computeSeriesAuHaut([{ valeurActual: 12 }], 10)).toBe(true);
  });
});

describe("buildArbreEvaluationInputs", () => {
  const DAY: TrainDay = {
    kind: "train",
    label: "lundi",
    exercises: [
      { id: "lundi-hip-hinge-echauffement", name: "Hip hinge au bâton", movementFamily: "dos-fixe", countsInStats: false, videoId: null, sets: 2, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
      { id: "A-1", name: "Hip hinge au bâton", movementFamily: "arbre-A", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: [8, 10], maxEffort: false, eachSide: false } },
      { id: "B-1", name: "Pont fessier bilatéral", movementFamily: "arbre-B", countsInStats: true, videoId: null, sets: 3, target: { unit: "reps", value: [12, 15], maxEffort: false, eachSide: false } },
    ],
  };

  it("produces one input per non-skipped arbre exercise, ignores the fixed exercise", () => {
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map([
        [1, [{ valeurActual: 10 }, { valeurActual: 10 }, { valeurActual: 10 }]],
        [2, [{ valeurActual: 12 }, { valeurActual: 12 }, { valeurActual: 12 }]],
      ]),
      skippedExerciseOrders: new Set(),
      semaine: 5,
      evaluations: [],
      genePendant: 1,
      reserves: { A: 0, B: 3 },
    });
    expect(inputs.map((i) => i.arbre)).toEqual(["A", "B"]);
    // semaine 5 → bloc 2 → RPE_CIBLE[1] = 7 ; reserve 0 → RPE 10 (échec, §2) ; 10 > 7 donc rpeAuCibleOuMoins est faux (§6 règle 6).
    expect(inputs[0]).toMatchObject({ arbre: "A", currentCran: 1, seriesAuHaut: true, rpeAuCibleOuMoins: false });
  });

  it("skips an exercise entirely when its order is in skippedExerciseOrders", () => {
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map(),
      skippedExerciseOrders: new Set([2]),
      semaine: 5,
      evaluations: [],
      genePendant: 0,
      reserves: { A: 0, B: 0 },
    });
    expect(inputs.map((i) => i.arbre)).toEqual(["A"]);
  });

  it("uses getCurrentCran/hasAlreadyRisenThisWeek from the evaluation history", () => {
    const evaluations: EvalRow[] = [
      { arbre: "A", semaine: 5, cranApres: 3, resultat: "montee", horodatage: "2026-08-10T09:00:00.000Z" },
    ];
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map([[1, [{ valeurActual: 10 }]]]),
      skippedExerciseOrders: new Set([2]),
      semaine: 5,
      evaluations,
      genePendant: 0,
      reserves: { A: 0 },
    });
    expect(inputs[0]).toMatchObject({ currentCran: 3, dejaMonteeCetteSemaine: true });
  });

  it("omits an arbre exercise when no reserve was answered for it", () => {
    const inputs = buildArbreEvaluationInputs({
      day: DAY,
      setsLoggedByExerciseOrder: new Map(),
      skippedExerciseOrders: new Set(),
      semaine: 5,
      evaluations: [],
      genePendant: 0,
      reserves: { A: 0 },
    });
    expect(inputs.map((i) => i.arbre)).toEqual(["A"]);
  });
});
