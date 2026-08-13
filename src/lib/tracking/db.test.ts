import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  findOrCreateExercise,
  listExerciseNames,
  getActiveSeance,
  startSeance,
  getOrStartSeance,
  getSeanceById,
  getSetsForSeance,
  logSetForExercise,
  completeSeance,
  listCompletedSeances,
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
  it("creates a new exercise on first use", () => {
    const db = setup();
    const exercise = findOrCreateExercise(db, "Squats");
    expect(exercise.name).toBe("Squats");
  });

  it("returns the same row on a second call with the same name", () => {
    const db = setup();
    const first = findOrCreateExercise(db, "Squats");
    const second = findOrCreateExercise(db, "Squats");
    expect(second.id).toBe(first.id);
  });
});

describe("listExerciseNames", () => {
  it("lists distinct exercise names alphabetically", () => {
    const db = setup();
    findOrCreateExercise(db, "Squats");
    findOrCreateExercise(db, "Développé couché");
    expect(listExerciseNames(db)).toEqual(["Développé couché", "Squats"]);
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
  it("logs a first set at exerciseOrder 0, setNumber 1", () => {
    const db = setup();
    const seance = startSeance(db);
    const set = logSetForExercise(db, seance.id, "Squats", 12);
    expect(set).toMatchObject({ seanceId: seance.id, exerciseName: "Squats", exerciseOrder: 0, setNumber: 1, repsActual: 12 });
  });

  it("increments setNumber for a second set of the same exercise, keeps exerciseOrder", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    const second = logSetForExercise(db, seance.id, "Squats", 10);
    expect(second).toMatchObject({ exerciseOrder: 0, setNumber: 2 });
  });

  it("assigns the next exerciseOrder to a second distinct exercise in the same seance", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    const secondExercise = logSetForExercise(db, seance.id, "Fentes", 10);
    expect(secondExercise).toMatchObject({ exerciseOrder: 1, setNumber: 1 });
  });

  it("reuses the same tracking_exercises row across seances", () => {
    const db = setup();
    const seanceA = startSeance(db);
    const setA = logSetForExercise(db, seanceA.id, "Squats", 12);
    completeSeance(db, seanceA.id);
    const seanceB = startSeance(db);
    const setB = logSetForExercise(db, seanceB.id, "Squats", 8);
    expect(setB.exerciseId).toBe(setA.exerciseId);
  });
});

describe("getSetsForSeance", () => {
  it("returns sets in insertion order, joined with the exercise name", () => {
    const db = setup();
    const seance = startSeance(db);
    logSetForExercise(db, seance.id, "Squats", 12);
    logSetForExercise(db, seance.id, "Squats", 10);
    const sets = getSetsForSeance(db, seance.id);
    expect(sets.map((s) => s.repsActual)).toEqual([12, 10]);
    expect(sets.every((s) => s.exerciseName === "Squats")).toBe(true);
  });
});

describe("listCompletedSeances", () => {
  it("excludes the active (uncompleted) seance", () => {
    const db = setup();
    startSeance(db);
    expect(listCompletedSeances(db)).toEqual([]);
  });

  it("summarizes total reps and exercise count, most recent first", () => {
    const db = setup();
    const seanceA = startSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", 12);
    logSetForExercise(db, seanceA.id, "Fentes", 10);
    completeSeance(db, seanceA.id);

    const seanceB = startSeance(db);
    logSetForExercise(db, seanceB.id, "Squats", 8);
    completeSeance(db, seanceB.id);

    const summaries = listCompletedSeances(db);
    expect(summaries).toHaveLength(2);
    expect(summaries[0]!.id).toBe(seanceB.id);
    expect(summaries[1]).toMatchObject({ id: seanceA.id, totalReps: 22, exerciseCount: 2 });
  });
});
