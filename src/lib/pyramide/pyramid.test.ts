import { describe, it, expect } from "vitest";
import { clampPeak, pyramidLabel, pyramidRestSeconds, pyramidSteps, pyramidTotal, setTarget } from "./pyramid";

describe("pyramidSteps", () => {
  it("climbs to the peak and back down for a classic pyramid", () => {
    expect(pyramidSteps("classic", 4)).toEqual([1, 2, 3, 4, 3, 2, 1]);
  });

  it("starts at the peak, drops to 1 and climbs back for an inverted pyramid", () => {
    expect(pyramidSteps("inverted", 4)).toEqual([4, 3, 2, 1, 2, 3, 4]);
  });
});

describe("pyramidTotal", () => {
  it("is peak² for a classic pyramid and peak² + peak − 1 for an inverted one", () => {
    expect(pyramidTotal("classic", 7)).toBe(49);
    expect(pyramidTotal("inverted", 4)).toBe(19);
  });
});

describe("pyramidRestSeconds", () => {
  it("grows with the height of the step, as in the video for a peak of 15", () => {
    expect([1, 5, 10, 15].map((r) => pyramidRestSeconds(r, 15))).toEqual([15, 30, 75, 120]);
  });

  it("scales to the peak for a beginner pyramid", () => {
    expect([1, 3, 5].map((r) => pyramidRestSeconds(r, 5))).toEqual([30, 60, 120]);
  });
});

describe("clampPeak", () => {
  it("keeps the peak between 2 and 30, rounded", () => {
    expect(clampPeak(1)).toBe(2);
    expect(clampPeak(99)).toBe(30);
    expect(clampPeak(7.6)).toBe(8);
  });
});

describe("pyramidLabel", () => {
  it("names the shape by its steps", () => {
    expect(pyramidLabel("classic", 7)).toBe("Pyramide 1→7→1");
    expect(pyramidLabel("inverted", 7)).toBe("Pyramide 7→1→7");
  });
});

describe("setTarget", () => {
  it("gives each step its own target in a pyramid", () => {
    const ex = { pyramid: { shape: "classic" as const, peak: 3 } };
    expect([1, 2, 3, 4, 5].map((s) => setTarget(ex, s))).toEqual([1, 2, 3, 2, 1]);
  });

  it("is null outside a pyramid", () => {
    expect(setTarget({}, 1)).toBeNull();
  });
});
