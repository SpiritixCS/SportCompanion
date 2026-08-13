import { describe, it, expect } from "vitest";
import { PALIERS, palierAtteint, prochainPalier } from "./paliers";

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
