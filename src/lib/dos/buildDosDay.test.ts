import { describe, it, expect } from "vitest";
import { buildDosDay, ARBRES_DU_JOUR } from "./buildDosDay";
import type { ArbreId } from "@/lib/backpain/arbres";

const ALL_CRAN_1: Record<ArbreId, number> = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1, G: 1, H: 1, I: 1, J: 1 };

describe("ARBRES_DU_JOUR", () => {
  it("matches §5's schedule exactly", () => {
    expect(ARBRES_DU_JOUR.lundi).toEqual(["A", "B", "C"]);
    expect(ARBRES_DU_JOUR.mardi).toEqual(["J", "H"]);
    expect(ARBRES_DU_JOUR.mercredi).toEqual(["D", "A"]);
    expect(ARBRES_DU_JOUR.jeudi).toEqual(["E", "F"]);
    expect(ARBRES_DU_JOUR.vendredi).toEqual(["B", "H", "I"]);
    expect(ARBRES_DU_JOUR.samedi).toEqual(["G", "J"]);
  });
});

describe("buildDosDay", () => {
  it("puts fixed exercises before arbre exercises, in order", () => {
    const day = buildDosDay("lundi", 1, ALL_CRAN_1);
    expect(day.kind).toBe("train");
    expect(day.exercises.map((e) => e.id)).toEqual(["lundi-hip-hinge-echauffement", "A-1", "B-1", "C-1"]);
  });

  it("resolves each arbre exercise to its current cran's name and the current block's prescription", () => {
    const day = buildDosDay("lundi", 3, { ...ALL_CRAN_1, A: 5 });
    const nordic = day.exercises.find((e) => e.id === "A-5");
    expect(nordic?.name).toBe("Nordic curl excentrique assisté");
    expect(nordic?.sets).toBe(4); // bloc 3, A: 4 × 6-8 reps
    expect(nordic?.target).toEqual({ unit: "reps", value: [6, 8], maxEffort: false, eachSide: false });
  });

  it("marks fixed exercises countsInStats:false and arbre exercises countsInStats:true", () => {
    const day = buildDosDay("mardi", 1, ALL_CRAN_1);
    const fixed = day.exercises.find((e) => e.id === "mardi-butees")!;
    const arbre = day.exercises.find((e) => e.id === "J-1")!;
    expect(fixed.countsInStats).toBe(false);
    expect(arbre.countsInStats).toBe(true);
  });

  it("resolves a twice-weekly tree (H) independently on its two days", () => {
    const mardi = buildDosDay("mardi", 1, { ...ALL_CRAN_1, H: 2 });
    const vendredi = buildDosDay("vendredi", 1, { ...ALL_CRAN_1, H: 2 });
    expect(mardi.exercises.find((e) => e.id === "H-2")?.name).toBe("Side plank pieds");
    expect(vendredi.exercises.find((e) => e.id === "H-2")?.name).toBe("Side plank pieds");
  });
});
