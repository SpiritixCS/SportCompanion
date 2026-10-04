// src/lib/tracking/loadTrackingScreenState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSetForExercise, completeSeance, startPyramidSeance } from "./db";
import { setDayRest, setDayExercises, advancePointer } from "./program";
import { loadTrackingScreenState } from "./loadTrackingScreenState";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-tracking-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTrackingScreenState", () => {
  it("reports the day at the pointer (Lundi, repos par défaut), no active seance, no history initially", () => {
    const db = setup();
    expect(loadTrackingScreenState(db)).toEqual({
      programDay: { dayOfWeek: 0, label: "Lundi", isRest: true, exercises: [] },
      programEmpty: true,
      activeSeance: null,
      seances: [],
    });
  });

  it("reports the séance day at the pointer with its planned exercises", () => {
    const db = setup();
    setDayRest(db, 0, false);
    setDayExercises(db, 0, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);

    const state = loadTrackingScreenState(db);
    expect(state.programDay).toEqual({
      dayOfWeek: 0,
      label: "Lundi",
      isRest: false,
      exercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12, restSeconds: null, pyramid: null }],
    });
  });

  it("surfaces the active seance's day, planned exercises and exercises logged so far, separately from completed history", () => {
    const db = setup();
    setDayRest(db, 0, false);
    setDayExercises(db, 0, [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
    const active = startSeance(db, 0);
    logSetForExercise(db, active.id, "Dips", "reps", 12, 2);
    const past = startSeance(db);
    logSetForExercise(db, past.id, "Squats", "reps", 10);
    completeSeance(db, past.id);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({
      id: active.id,
      dayOfWeek: 0,
      dayLabel: "Lundi",
      plannedExercises: [{ ordre: 0, name: "Dips", unit: "reps", setsCount: 3, targetValue: 12, restSeconds: null, pyramid: null }],
      loggedExercises: [{ name: "Dips", unit: "reps", setsCount: 2, totalValue: 24 }],
      pyramid: null,
    });
    expect(state.seances).toHaveLength(1);
    expect(state.seances[0]!.id).toBe(past.id);
  });

  it("surfaces exercises logged so far, and no planned exercises, for a legacy seance with no day (freeform)", () => {
    const db = setup();
    const active = startSeance(db);
    logSetForExercise(db, active.id, "Squats", "reps", 10, 3);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({
      id: active.id,
      dayOfWeek: null,
      dayLabel: null,
      plannedExercises: null,
      loggedExercises: [{ name: "Squats", unit: "reps", setsCount: 3, totalValue: 30 }],
      pyramid: null,
    });
  });

  it("reflects the pointer after it has advanced", () => {
    const db = setup();
    advancePointer(db);
    expect(loadTrackingScreenState(db).programDay.dayOfWeek).toBe(1);
    expect(loadTrackingScreenState(db).programDay.label).toBe("Mardi");
  });

  it("treats an out-of-range dayOfWeek on the active seance like a legacy/freeform seance instead of throwing", () => {
    const db = setup();
    const active = startSeance(db, 9);
    logSetForExercise(db, active.id, "Squats", "reps", 10, 3);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({
      id: active.id,
      dayOfWeek: 9,
      dayLabel: null,
      plannedExercises: null,
      loggedExercises: [{ name: "Squats", unit: "reps", setsCount: 3, totalValue: 30 }],
      pyramid: null,
    });
  });
});

describe("loadTrackingScreenState — programEmpty", () => {
  it("is true for a program never composed (7 rest days, no exercise)", () => {
    const db = setup();
    expect(loadTrackingScreenState(db).programEmpty).toBe(true);
  });

  it("is false once one day has an exercise", () => {
    const db = setup();
    setDayExercises(db, 2, [{ name: "Tractions", unit: "reps", setsCount: 3, targetValue: 8 }]);
    expect(loadTrackingScreenState(db).programEmpty).toBe(false);
  });
});

describe("loadTrackingScreenState — pyramide", () => {
  it("exposes the configuration of an active pyramid", () => {
    const db = setup();
    startPyramidSeance(db, { exerciseName: "Dips", shape: "classic", peak: 5 });
    expect(loadTrackingScreenState(db).activeSeance?.pyramid).toEqual({ exerciseName: "Dips", shape: "classic", peak: 5 });
  });
});
