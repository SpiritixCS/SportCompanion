import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getProgramDays, getProgramDay, setDayRest, setDayExercises, getPointer, advancePointer, WEEKDAY_LABELS } from "./program";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-program-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("getProgramDays", () => {
  it("returns all 7 days in order, resting with no exercises", () => {
    const db = setup();
    const days = getProgramDays(db);
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(days.map((d) => d.label)).toEqual([...WEEKDAY_LABELS]);
    expect(days.every((d) => d.isRest)).toBe(true);
    expect(days.every((d) => d.exercises.length === 0)).toBe(true);
  });
});

describe("getProgramDay", () => {
  it("returns a single day by index", () => {
    const db = setup();
    expect(getProgramDay(db, 2)).toEqual({ dayOfWeek: 2, label: "Mercredi", isRest: true, exercises: [] });
  });
});

describe("setDayRest", () => {
  it("toggles a day to séance and back to repos", () => {
    const db = setup();
    expect(setDayRest(db, 1, false).isRest).toBe(false);
    expect(getProgramDay(db, 1).isRest).toBe(false);
    expect(setDayRest(db, 1, true).isRest).toBe(true);
  });

  it("preserves exercises when toggling back to repos then séance", () => {
    const db = setup();
    setDayRest(db, 0, false);
    setDayExercises(db, 0, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
    setDayRest(db, 0, true);
    const day = setDayRest(db, 0, false);
    expect(day.exercises).toEqual([{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12, restSeconds: null }]);
  });
});

describe("setDayExercises", () => {
  it("replaces the exercise list in block, in order", () => {
    const db = setup();
    setDayExercises(db, 0, [
      { name: "Développé couché", unit: "reps", setsCount: 4, targetValue: 8 },
      { name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
    ]);
    const updated = setDayExercises(db, 0, [{ name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15 }]);
    expect(updated.exercises).toEqual([{ ordre: 0, name: "Pompes", unit: "reps", setsCount: 3, targetValue: 15, restSeconds: null }]);
  });

  it("stores a per-exercise rest, null meaning the global setting", () => {
    const db = setup();
    const updated = setDayExercises(db, 0, [
      { name: "Tractions", unit: "reps", setsCount: 4, targetValue: 8, restSeconds: 120 },
      { name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 },
    ]);
    expect(updated.exercises.map((e) => e.restSeconds)).toEqual([120, null]);
  });

  it("rejects an unknown dayOfWeek", () => {
    const db = setup();
    expect(() => setDayExercises(db, 9, [])).toThrow();
  });
});

describe("pointer", () => {
  it("starts at day 0", () => {
    const db = setup();
    expect(getPointer(db)).toBe(0);
  });

  it("advances by 1 and wraps around after day 6", () => {
    const db = setup();
    for (let expected = 1; expected <= 6; expected++) {
      expect(advancePointer(db)).toBe(expected);
    }
    expect(advancePointer(db)).toBe(0);
  });
});
