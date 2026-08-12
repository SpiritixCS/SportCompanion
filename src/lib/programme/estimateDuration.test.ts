import { describe, it, expect } from "vitest";
import { estimateDurationMinutes } from "./estimateDuration";

describe("estimateDurationMinutes", () => {
  it("returns the 18-minute base with no exercises", () => {
    expect(estimateDurationMinutes(0)).toBe(18);
  });

  it("adds 4 minutes per exercise", () => {
    expect(estimateDurationMinutes(6)).toBe(42);
  });
});
