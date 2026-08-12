import { describe, it, expect } from "vitest";
import { PARCOURS, getParcours } from "./parcours";

describe("parcours metadata", () => {
  it("lists the 3 parcours in order with the right French labels", () => {
    expect(PARCOURS.map((p) => p.id)).toEqual(["beginner", "intermediate", "advanced"]);
    expect(PARCOURS.map((p) => p.label)).toEqual(["Débutant", "Intermédiaire", "Advanced"]);
  });

  it("reports the real level count per parcours", () => {
    expect(getParcours("beginner")?.levelCount).toBe(8);
    expect(getParcours("intermediate")?.levelCount).toBe(8);
    expect(getParcours("advanced")?.levelCount).toBe(4);
  });

  it("returns undefined for an unknown id", () => {
    expect(getParcours("nope")).toBeUndefined();
  });
});
