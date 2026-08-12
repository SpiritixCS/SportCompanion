import { describe, it, expect } from "vitest";
import { EXERCICES_FIXES } from "./exercicesFixes";

describe("EXERCICES_FIXES", () => {
  it("has all 6 training days, none empty", () => {
    const jours = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
    for (const jour of jours) {
      expect(EXERCICES_FIXES[jour].length).toBeGreaterThan(0);
    }
  });

  it("matches §5 exactly for mardi (4 items) and vendredi (1 item, échauffement)", () => {
    expect(EXERCICES_FIXES.mardi).toHaveLength(4);
    expect(EXERCICES_FIXES.mardi.map((e) => e.nom)).toEqual([
      "Bascules de bassin quadrupédie", "Chat-chameau lent", "Bird dog", "Butées",
    ]);
    expect(EXERCICES_FIXES.vendredi).toEqual([
      { id: "vendredi-pont-fessier-echauffement", nom: "Pont fessier bilatéral", sets: 2, target: { unit: "reps", value: 15, maxEffort: false, eachSide: false } },
    ]);
  });

  it("every id is day-prefixed, never matching the arbre id pattern", () => {
    for (const jour of Object.keys(EXERCICES_FIXES) as (keyof typeof EXERCICES_FIXES)[]) {
      for (const exercice of EXERCICES_FIXES[jour]) {
        expect(exercice.id.startsWith(`${jour}-`)).toBe(true);
        expect(exercice.id).not.toMatch(/^[A-J]-\d+$/);
      }
    }
  });

  it("bird dog uses a seconds range target for the tenue duration (6-10 s per set — rep count not separately modeled)", () => {
    const birdDog = EXERCICES_FIXES.mardi.find((e) => e.nom === "Bird dog");
    expect(birdDog?.sets).toBe(3);
    expect(birdDog?.target).toEqual({ unit: "s", value: [6, 10], maxEffort: false, eachSide: false });
  });
});
