import { describe, it, expect } from "vitest";
import { formatClock } from "./formatClock";

describe("formatClock", () => {
  it("formats zero seconds", () => {
    expect(formatClock(0)).toBe("0:00");
  });

  it("pads seconds under 10", () => {
    expect(formatClock(65)).toBe("1:05");
  });

  it("formats minutes without leading zero", () => {
    expect(formatClock(600)).toBe("10:00");
  });

  it("floors fractional seconds", () => {
    expect(formatClock(59.9)).toBe("0:59");
  });
});
