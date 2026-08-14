// src/lib/tracking/db.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  findOrCreateExercise,
  listExercises,
  getActiveSeance,
  startSeance,
  getOrStartSeance,
  getSeanceById,
  getSetsForSeance,
  logSetForExercise,
  updateSet,
  deleteSet,
  deleteSetsForExercise,
  deleteSeance,
  completeSeance,
  listCompletedSeances,
  skipExercise,
  getSkippedExercises,
} from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-tracking-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("findOrCreateExercise", () => {
  it("creates a new exercise with the given unit", () => {
    const db = setup();
    const exercise = findOrCreateExercise(db, "Planche", "seconds");
    expect(exercise).toMatchObject({ name: "Planche", unit: "seconds" });
  });

  it("defaults to reps when no unit is passed", () => {
    const db = setup();
    expect(findOrCreateExercise(db, "Squats").unit).toBe("reps");
  });

  it("returns the same row on a second call, ignoring a different unit passed the second time", () => {
    const db = setup();
    const first = findOrCreateExercise(db, "Squats", "reps");
    const second = findOrCreateExercise(db, "Squats", "seconds");
    expect(second.id).toBe(first.id);
    expect(second.unit).toBe("reps");
  });
});

describe("listExercises", () => {
  it("lists name and unit, alphabetically", () => {
    const db = setup();
    findOrCreateExercise(db, "Squats", "reps");
    findOrCreateExercise(db, "Planche", "seconds");
    expect(listExercises(db)).toEqual([
      { name: "Planche", unit: "seconds" },
      { name: "Squats", unit: "reps" },
    ]);
  });
});

describe("seances", () => {
  it("returns null before any seance exists", () => {
    const db = setup();
    expect(getActiveSeance(db)).toBeNull();
  });

  it("getOrStartSeance creates once, returns the same active row on a second call", () => {
    const db = setup();
    const first = getOrStartSeance(db);
    const second = getOrStartSeance(db);
    expect(second.id).toBe(first.id);
    expect(first.completedAt).toBeNull();
  });

  it("completeSeance stops it from being returned as active", () => {
    const db = setup();
    const seance = startSeance(db);
    completeSeance(db, seance.id);
    expect(getActiveSeance(db)).toBeNull();
    expect(getSeanceById(db, seance.id)!.completedAt).not.toBeNull();
  });

  it("breaks a started_at tie by id, returning the most recently inserted active seance", () => {
    const db = setup();
    const sameInstant = "2026-08-13T10:00:00.000Z";
    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(sameInstant);
    const second = db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(sameInstant);
    expect(getActiveSeance(db)!.id).toBe(Number(second.lastInsertRowid));
  });
});

describe("logSetForExercise", () => {
  it("logs a single set at exerciseOrder 0, setNumber 1, carrying the exercise's unit", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 12);
    expect(set).toMatchObject({ seanceId: seance.id, exerciseName: "Squats", exerciseUnit: "reps", exerciseOrder: 0, setNumber: 1, valeurActual: 12 });
  });

  it("creates count separate sets with incrementing setNumber, same exerciseOrder", () => {
    const db = setup();
    const seance = startSeance(db);
    const sets = logSetForExercise(db, seance.id, "Pompes", "reps", 10, 4);
    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4]);
    expect(sets.every((s) => s.exerciseOrder === 0 && s.valeurActual === 10)).toBe(true);
  });

  it("increments setNumber for a further call on the same exercise, keeps exerciseOrder", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    const [second] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    expect(second).toMatchObject({ exerciseOrder: 0, setNumber: 2 });
  });

  it("assigns the next exerciseOrder to a second distinct exercise in the same seance", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    const [secondExercise] = logSetForExercise(db, seance.id, "Fentes", "reps", 10);
    expect(secondExercise).toMatchObject({ exerciseOrder: 1, setNumber: 1 });
  });

  it("reuses the same tracking_exercises row and its original unit across seances", () => {
    const db = setup();
    const seanceA = startSeance(db);
    const [setA] = logSetForExercise(db, seanceA.id, "Planche", "seconds", 30);
    completeSeance(db, seanceA.id);
    const seanceB = startSeance(db);
    const [setB] = logSetForExercise(db, seanceB.id, "Planche", "reps", 45);
    expect(setB!.exerciseId).toBe(setA!.exerciseId);
    expect(setB!.exerciseUnit).toBe("seconds");
  });
});

describe("getSetsForSeance", () => {
  it("returns sets in insertion order, joined with the exercise name and unit", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Planche", "seconds", 30);
    logSetForExercise(db, seance.id, "Planche", "seconds", 45);
    const sets = getSetsForSeance(db, seance.id);
    expect(sets.map((s) => s.valeurActual)).toEqual([30, 45]);
    expect(sets.every((s) => s.exerciseName === "Planche" && s.exerciseUnit === "seconds")).toBe(true);
  });
});

describe("updateSet / deleteSet", () => {
  it("updates a set's value in place", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    updateSet(db, set!.id, 12);
    const [reloaded] = getSetsForSeance(db, seance.id);
    expect(reloaded!.valeurActual).toBe(12);
  });

  it("deletes a set without touching sibling sets", () => {
    const db = setup();
    const seance = startSeance(db);
    const [first] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    deleteSet(db, first!.id);
    const remaining = getSetsForSeance(db, seance.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.valeurActual).toBe(12);
  });

  it("update/delete work on a set belonging to an already-completed seance", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 10);
    completeSeance(db, seance.id);
    updateSet(db, set!.id, 15);
    expect(getSetsForSeance(db, seance.id)[0]!.valeurActual).toBe(15);
    deleteSet(db, set!.id);
    expect(getSetsForSeance(db, seance.id)).toHaveLength(0);
  });
});

describe("deleteSetsForExercise", () => {
  it("removes all sets for one exercise, leaves other exercises' sets intact", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12, 2);
    const [fentes] = logSetForExercise(db, seance.id, "Fentes", "reps", 8);
    deleteSetsForExercise(db, seance.id, fentes!.exerciseId);
    const remaining = getSetsForSeance(db, seance.id);
    expect(remaining).toHaveLength(2);
    expect(remaining.every((s) => s.exerciseName === "Squats")).toBe(true);
  });

  it("works on an already-completed seance", () => {
    const db = setup();
    const seance = startSeance(db);
    const [set] = logSetForExercise(db, seance.id, "Squats", "reps", 12);
    completeSeance(db, seance.id);
    deleteSetsForExercise(db, seance.id, set!.exerciseId);
    expect(getSetsForSeance(db, seance.id)).toHaveLength(0);
  });
});

describe("deleteSeance", () => {
  it("removes the seance and all its sets", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    completeSeance(db, seance.id);
    deleteSeance(db, seance.id);
    expect(getSeanceById(db, seance.id)).toBeNull();
    expect(getSetsForSeance(db, seance.id)).toHaveLength(0);
  });

  it("does not affect a different seance", () => {
    const db = setup();
    const seanceA = startSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", "reps", 12);
    completeSeance(db, seanceA.id);
    const seanceB = startSeance(db);
    logSetForExercise(db, seanceB.id, "Fentes", "reps", 8);
    completeSeance(db, seanceB.id);

    deleteSeance(db, seanceA.id);
    expect(getSeanceById(db, seanceB.id)).not.toBeNull();
    expect(getSetsForSeance(db, seanceB.id)).toHaveLength(1);
  });
});

describe("listCompletedSeances", () => {
  it("excludes the active (uncompleted) seance", () => {
    const db = setup();
    startSeance(db);
    expect(listCompletedSeances(db)).toEqual([]);
  });

  it("separates reps and seconds totals, never summed together", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    logSetForExercise(db, seance.id, "Squats", "reps", 10);
    logSetForExercise(db, seance.id, "Planche", "seconds", 30);
    completeSeance(db, seance.id);

    const [summary] = listCompletedSeances(db);
    expect(summary).toMatchObject({ totalReps: 22, totalSeconds: 30, exerciseCount: 2 });
  });

  it("orders most recent first", () => {
    const db = setup();
    const seanceA = startSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", "reps", 12);
    completeSeance(db, seanceA.id);

    const seanceB = startSeance(db);
    logSetForExercise(db, seanceB.id, "Squats", "reps", 8);
    completeSeance(db, seanceB.id);

    const summaries = listCompletedSeances(db);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]!.id).toBe(seanceB.id);
  });
});

describe("seance templateId", () => {
  it("defaults to null when no template is given", () => {
    const db = setup();
    expect(startSeance(db).templateId).toBeNull();
  });

  it("carries the template id through to getOrStartSeance and getActiveSeance", () => {
    const db = setup();
    startSeance(db, 5);
    expect(getActiveSeance(db)!.templateId).toBe(5);
    expect(getOrStartSeance(db, 5).templateId).toBe(5);
  });

  it("resumes whatever is active regardless of the templateId requested", () => {
    const db = setup();
    const started = startSeance(db, 5);
    const resumed = getOrStartSeance(db, 9);
    expect(resumed.id).toBe(started.id);
    expect(resumed.templateId).toBe(5);
  });
});

describe("logSetForExercise with an explicit exerciseOrder", () => {
  it("uses the given order instead of deriving it from insertion, numbering sets within that order", () => {
    const db = setup();
    const seance = startSeance(db);
    const [first] = logSetForExercise(db, seance.id, "Dips", "reps", 12, 1, 3);
    expect(first).toMatchObject({ exerciseOrder: 3, setNumber: 1 });
    const [second] = logSetForExercise(db, seance.id, "Dips", "reps", 10, 1, 3);
    expect(second).toMatchObject({ exerciseOrder: 3, setNumber: 2 });
  });

  it("keeps the auto-derived order unchanged when exerciseOrder is omitted", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    const [second] = logSetForExercise(db, seance.id, "Fentes", "reps", 10);
    expect(second).toMatchObject({ exerciseOrder: 1, setNumber: 1 });
  });
});

describe("skipExercise / getSkippedExercises", () => {
  it("records a skipped exercise order and lists it back", () => {
    const db = setup();
    const seance = startSeance(db);
    skipExercise(db, seance.id, 2);
    expect(getSkippedExercises(db, seance.id)).toEqual([2]);
  });

  it("ignores a duplicate skip of the same order", () => {
    const db = setup();
    const seance = startSeance(db);
    skipExercise(db, seance.id, 2);
    skipExercise(db, seance.id, 2);
    expect(getSkippedExercises(db, seance.id)).toEqual([2]);
  });

  it("scopes skipped exercises to their own seance", () => {
    const db = setup();
    const seanceA = startSeance(db);
    const seanceB = startSeance(db);
    skipExercise(db, seanceA.id, 1);
    expect(getSkippedExercises(db, seanceB.id)).toEqual([]);
  });
});
