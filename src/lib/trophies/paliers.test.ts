import { describe, it, expect } from "vitest";
import { PALIERS, palierAtteint, prochainPalier, palierProgress, closestPalier } from "./paliers";

describe("PALIERS", () => {
  it("is the exact brief sequence", () => {
    expect(PALIERS).toEqual([100, 500, 1000, 5000, 10000, 25000]);
  });
});

describe("palierAtteint", () => {
  it("returns null below the first threshold", () => {
    expect(palierAtteint(0)).toBeNull();
    expect(palierAtteint(99)).toBeNull();
  });

  it("returns the threshold exactly at the boundary", () => {
    expect(palierAtteint(100)).toBe(100);
  });

  it("returns the highest threshold reached, not the nearest", () => {
    expect(palierAtteint(101)).toBe(100);
    expect(palierAtteint(999)).toBe(500);
    expect(palierAtteint(24999)).toBe(10000);
  });

  it("returns the last threshold beyond the top of the scale", () => {
    expect(palierAtteint(25000)).toBe(25000);
    expect(palierAtteint(25001)).toBe(25000);
    expect(palierAtteint(1_000_000)).toBe(25000);
  });
});

describe("prochainPalier", () => {
  it("returns the first threshold above the total", () => {
    expect(prochainPalier(0)).toBe(100);
    expect(prochainPalier(99)).toBe(100);
    expect(prochainPalier(100)).toBe(500);
    expect(prochainPalier(24999)).toBe(25000);
  });

  it("returns null once every threshold is passed", () => {
    expect(prochainPalier(25000)).toBeNull();
    expect(prochainPalier(30000)).toBeNull();
  });
});

describe("palierProgress", () => {
  it("measures progress from the previous threshold to the next", () => {
    expect(palierProgress(47)).toEqual({ prev: 0, next: 100, fraction: 0.47 });
    expect(palierProgress(300)).toEqual({ prev: 100, next: 500, fraction: 0.5 });
  });

  it("starts the next threshold at 0 exactly on a boundary", () => {
    expect(palierProgress(100)).toEqual({ prev: 100, next: 500, fraction: 0 });
  });

  it("returns null once every threshold is reached", () => {
    expect(palierProgress(25000)).toBeNull();
  });
});

describe("closestPalier", () => {
  const card = (id: string, total: number, unit: "reps" | "seconds" = "reps") => ({ id, total, unit });

  it("picks the reps card with the fewest reps left to its next threshold", () => {
    const best = closestPalier([card("a", 47), card("b", 480), card("c", 90)]);
    expect(best?.card.id).toBe("c");
    expect(best?.left).toBe(10);
    expect(best?.progress).toEqual({ prev: 0, next: 100, fraction: 0.9 });
  });

  it("ignores seconds cards and cards past every threshold", () => {
    expect(closestPalier([card("s", 95, "seconds"), card("max", 30000)])).toBeNull();
  });
});
