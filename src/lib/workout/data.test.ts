import { describe, it, expect } from "vitest";
import { beginner, intermediate, advanced } from "./data";

describe("generated Caliathletics data", () => {
  it("has the right number of levels per parcours", () => {
    expect(beginner).toHaveLength(8);
    expect(intermediate).toHaveLength(8);
    expect(advanced).toHaveLength(4);
  });

  it("has 7 days per level in every parcours", () => {
    for (const parcours of [beginner, intermediate, advanced]) {
      for (const level of parcours) {
        expect(level).toHaveLength(7);
      }
    }
  });

  it("every day is either train or rest", () => {
    for (const parcours of [beginner, intermediate, advanced]) {
      for (const level of parcours) {
        for (const day of level) {
          expect(["train", "rest"]).toContain(day.kind);
        }
      }
    }
  });
});
