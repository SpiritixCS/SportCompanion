import { describe, it, expect } from "vitest";
import { getJourSemaine, getDosRestSeconds } from "./schedule";

describe("getJourSemaine", () => {
  it("maps ISO dates to the right weekday, dimanche included", () => {
    // 2026-08-17 is a Monday.
    expect(getJourSemaine("2026-08-17")).toBe("lundi");
    expect(getJourSemaine("2026-08-18")).toBe("mardi");
    expect(getJourSemaine("2026-08-19")).toBe("mercredi");
    expect(getJourSemaine("2026-08-20")).toBe("jeudi");
    expect(getJourSemaine("2026-08-21")).toBe("vendredi");
    expect(getJourSemaine("2026-08-22")).toBe("samedi");
    expect(getJourSemaine("2026-08-23")).toBe("dimanche");
  });
});

describe("getDosRestSeconds", () => {
  it("is 60 on mardi, 90 on every other training day", () => {
    expect(getDosRestSeconds("mardi")).toBe(60);
    expect(getDosRestSeconds("lundi")).toBe(90);
    expect(getDosRestSeconds("mercredi")).toBe(90);
    expect(getDosRestSeconds("jeudi")).toBe(90);
    expect(getDosRestSeconds("vendredi")).toBe(90);
    expect(getDosRestSeconds("samedi")).toBe(90);
  });
});
