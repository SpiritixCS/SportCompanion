import { describe, it, expect } from "vitest";
import { computeWeek, computeBlock, isDechargeWeek, isCalibrageWeek, RPE_CIBLE } from "./periode";

describe("computeWeek", () => {
  it("is week 1 on the start date itself", () => {
    expect(computeWeek("2026-08-12", "2026-08-12")).toBe(1);
  });

  it("stays week 1 through day 6 (0-6 days elapsed)", () => {
    expect(computeWeek("2026-08-12", "2026-08-18")).toBe(1);
  });

  it("becomes week 2 on day 7 elapsed", () => {
    expect(computeWeek("2026-08-12", "2026-08-19")).toBe(2);
  });

  it("clamps at week 16 past the 16-week mark", () => {
    expect(computeWeek("2026-08-12", "2027-06-01")).toBe(16);
  });
});

describe("computeBlock", () => {
  it("maps weeks 1-4 to block 1, 5-8 to block 2, 9-12 to block 3, 13-16 to block 4", () => {
    expect(computeBlock(1)).toBe(1);
    expect(computeBlock(4)).toBe(1);
    expect(computeBlock(5)).toBe(2);
    expect(computeBlock(8)).toBe(2);
    expect(computeBlock(9)).toBe(3);
    expect(computeBlock(12)).toBe(3);
    expect(computeBlock(13)).toBe(4);
    expect(computeBlock(16)).toBe(4);
  });
});

describe("isDechargeWeek", () => {
  it("is true only for weeks 4, 8, 12, 16", () => {
    expect([4, 8, 12, 16].map(isDechargeWeek)).toEqual([true, true, true, true]);
    expect([1, 2, 3, 5, 9, 13, 15].map(isDechargeWeek)).toEqual([false, false, false, false, false, false, false]);
  });
});

describe("isCalibrageWeek", () => {
  it("is true only for week 1", () => {
    expect(isCalibrageWeek(1)).toBe(true);
    expect(isCalibrageWeek(2)).toBe(false);
  });
});

describe("RPE_CIBLE", () => {
  it("gives the target RPE for each block per week (§1: 6, 7, 8, 8)", () => {
    expect(RPE_CIBLE[computeBlock(2) - 1]).toBe(6);
    expect(RPE_CIBLE[computeBlock(6) - 1]).toBe(7);
    expect(RPE_CIBLE[computeBlock(10) - 1]).toBe(8);
    expect(RPE_CIBLE[computeBlock(14) - 1]).toBe(8);
  });
});
