import { describe, it, expect } from "vitest";
import { formatTarget } from "./formatTarget";
import type { ExerciseTarget } from "@/lib/workout/types";

function target(overrides: Partial<ExerciseTarget>): ExerciseTarget {
  return { unit: "reps", value: 12, maxEffort: false, eachSide: false, ...overrides };
}

describe("formatTarget", () => {
  it("formats a scalar value", () => {
    expect(formatTarget(3, target({ value: 12 }))).toBe("3 × 12");
  });

  it("formats a range value", () => {
    expect(formatTarget(4, target({ value: [8, 12] }))).toBe("4 × 8-12");
  });

  it("formats maxEffort as max", () => {
    expect(formatTarget(2, target({ value: null, maxEffort: true }))).toBe("2 × max");
  });

  it("formats a null value that isn't flagged maxEffort as max too", () => {
    expect(formatTarget(2, target({ value: null, maxEffort: false }))).toBe("2 × max");
  });

  it("appends a per-side suffix", () => {
    expect(formatTarget(3, target({ value: 10, eachSide: true }))).toBe("3 × 10 / côté");
  });
});
