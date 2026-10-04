import { describe, it, expect } from "vitest";
import { activeSeanceHref } from "./activeSeanceHref";

describe("activeSeanceHref", () => {
  it("sends a pyramid to the pyramid player", () => {
    expect(activeSeanceHref({ id: 3, dayOfWeek: null, pyramid: { exerciseName: "Dips", shape: "classic", peak: 5 } })).toBe("/player/pyramide");
  });

  it("sends a day séance to the day player", () => {
    expect(activeSeanceHref({ id: 3, dayOfWeek: 2, pyramid: null })).toBe("/player/tracking?day=2");
  });

  it("sends a legacy free séance to its journal", () => {
    expect(activeSeanceHref({ id: 3, dayOfWeek: null })).toBe("/tracking/3");
  });
});
