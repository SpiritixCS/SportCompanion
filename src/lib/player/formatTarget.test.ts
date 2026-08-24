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

  it("appends 's' for a seconds target", () => {
    expect(formatTarget(3, target({ value: 30, unit: "seconds" }))).toBe("3 × 30 s");
  });

  it("appends 'min' for a minutes target", () => {
    expect(formatTarget(1, target({ value: 10, unit: "minutes" }))).toBe("1 × 10 min");
  });

  it("says nothing extra for a reps target", () => {
    expect(formatTarget(3, target({ value: 12, unit: "reps" }))).toBe("3 × 12");
  });

  it("combines a unit suffix with the per-side suffix", () => {
    expect(formatTarget(3, target({ value: 30, unit: "seconds", eachSide: true }))).toBe("3 × 30 s / côté");
  });

  it("does not append a unit suffix for max effort", () => {
    expect(formatTarget(2, target({ value: null, maxEffort: true, unit: "seconds" }))).toBe("2 × max");
  });
});
