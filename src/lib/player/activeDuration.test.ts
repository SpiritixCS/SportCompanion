import { describe, it, expect } from "vitest";
import { activeDurationSeconds, isInactive, INACTIVITY_LIMIT_SECONDS } from "./activeDuration";

const T0 = Date.parse("2026-10-03T10:00:00.000Z");
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

describe("activeDurationSeconds", () => {
  it("sums short gaps up to now", () => {
    expect(activeDurationSeconds([at(0), at(60), at(150)], T0 + 200_000)).toBe(200);
  });

  it("ignores a gap longer than one hour", () => {
    // début, oubli d'une nuit, série 10 min plus tard
    expect(activeDurationSeconds([at(0), at(30_000)], T0 + 30_600_000)).toBe(600);
  });

  it("counts from the resume event after a long pause", () => {
    expect(activeDurationSeconds([at(0), at(120), at(40_000)], T0 + 40_300_000)).toBe(120 + 300);
  });

  it("ignores null/undefined and unordered events", () => {
    expect(activeDurationSeconds([at(60), null, at(0), undefined], T0 + 90_000)).toBe(90);
  });

  it("returns 0 with no events", () => {
    expect(activeDurationSeconds([], T0)).toBe(0);
  });

  it("counts a gap of exactly one hour", () => {
    expect(activeDurationSeconds([at(0)], T0 + INACTIVITY_LIMIT_SECONDS * 1000)).toBe(INACTIVITY_LIMIT_SECONDS);
  });
});

describe("isInactive", () => {
  it("is false within the hour after the last event", () => {
    expect(isInactive([at(0), at(1000)], T0 + 1000_000 + 3_000_000)).toBe(false);
  });

  it("is true more than an hour after the last event", () => {
    expect(isInactive([at(0), at(1000)], T0 + 1000_000 + 3_601_000)).toBe(true);
  });

  it("is false with no events", () => {
    expect(isInactive([], T0)).toBe(false);
  });
});
