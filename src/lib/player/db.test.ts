import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  getActiveSeance,
  startSeance,
  getOrStartSeance,
  getSetsForSeance,
  logSet,
  skipExercise,
  getSkippedExercises,
  completeSeance,
  resumeSeance,
  deleteSeance,
} from "./db";
import { computeTrophies } from "@/lib/trophies/computeTrophies";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-player-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("seance lifecycle", () => {
  it("returns null when no active seance exists", () => {
    const db = setup();
    expect(getActiveSeance(db, "beginner", 0, 0)).toBeNull();
  });

  it("creates a seance with completedAt null", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    expect(seance.parcours).toBe("beginner");
    expect(seance.level).toBe(0);
    expect(seance.dayIndex).toBe(0);
    expect(seance.completedAt).toBeNull();
    expect(getActiveSeance(db, "beginner", 0, 0)).toEqual(seance);
  });

  it("getOrStartSeance reuses the existing active seance instead of creating a second one", () => {
    const db = setup();
    const first = getOrStartSeance(db, "beginner", 0, 0);
    const second = getOrStartSeance(db, "beginner", 0, 0);
    expect(second.id).toBe(first.id);
  });

  it("completeSeance sets completedAt, after which getActiveSeance no longer returns it", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    completeSeance(db, seance.id);
    expect(getActiveSeance(db, "beginner", 0, 0)).toBeNull();
  });

  it("scopes seances by cycle — a completed cycle 0 doesn't block starting a fresh cycle 1", () => {
    const db = setup();
    const first = startSeance(db, "beginner", 0, 0, 0);
    completeSeance(db, first.id);
    expect(getActiveSeance(db, "beginner", 0, 0, 1)).toBeNull();

    const second = startSeance(db, "beginner", 0, 0, 1);
    expect(second.id).not.toBe(first.id);
    expect(second.cycle).toBe(1);
    expect(getActiveSeance(db, "beginner", 0, 0, 0)).toBeNull(); // cycle 0's seance is completed
    expect(getActiveSeance(db, "beginner", 0, 0, 1)).toEqual(second);
  });
});

describe("sets_logged", () => {
  it("logs a set and returns it with an id and completedAt", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    const set = logSet(db, {
      seanceId: seance.id,
      exerciseOrder: 0,
      setNumber: 1,
      repsTarget: "10",
      repsActual: 9,
      restSeconds: 90,
    });
    expect(set.id).toBeGreaterThan(0);
    expect(set.repsActual).toBe(9);
    expect(set.completedAt).toBeTruthy();
  });

  it("getSetsForSeance returns only rows for that seance, in insertion order", () => {
    const db = setup();
    const seanceA = startSeance(db, "beginner", 0, 0);
    const seanceB = startSeance(db, "beginner", 0, 1);
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90 });
    logSet(db, { seanceId: seanceB.id, exerciseOrder: 0, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90 });
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 0, setNumber: 2, repsTarget: "10", repsActual: 8, restSeconds: 90 });

    const rows = getSetsForSeance(db, seanceA.id);
    expect(rows.map((r) => r.setNumber)).toEqual([1, 2]);
    expect(rows.every((r) => r.seanceId === seanceA.id)).toBe(true);
  });
});

describe("skipped_exercises", () => {
  it("records a skip and getSkippedExercises returns it", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    skipExercise(db, seance.id, 1);
    expect(getSkippedExercises(db, seance.id)).toEqual([1]);
  });

  it("is idempotent — skipping the same exercise twice does not duplicate or throw", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    skipExercise(db, seance.id, 1);
    skipExercise(db, seance.id, 1);
    expect(getSkippedExercises(db, seance.id)).toEqual([1]);
  });
});

describe("resume and delete", () => {
  it("records resumedAt and reads it back on the active seance", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    expect(getActiveSeance(db, "beginner", 0, 0)!.resumedAt).toBeNull();
    resumeSeance(db, seance.id);
    expect(typeof getActiveSeance(db, "beginner", 0, 0)!.resumedAt).toBe("string");
  });

  it("deletes the seance, its sets and its skipped exercises, removing reps from Trophées", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    // ordre 2 = triceps-bench-dips, countsInStats: true en Débutant niveau 0 jour 0
    logSet(db, { seanceId: seance.id, exerciseOrder: 2, setNumber: 1, repsTarget: "10", repsActual: 10, restSeconds: 90 });
    skipExercise(db, seance.id, 1);
    const before = computeTrophies(db).reduce((sum, c) => sum + c.total, 0);
    expect(before).toBeGreaterThan(0);

    deleteSeance(db, seance.id);

    expect(getActiveSeance(db, "beginner", 0, 0)).toBeNull();
    expect(getSetsForSeance(db, seance.id)).toEqual([]);
    expect(getSkippedExercises(db, seance.id)).toEqual([]);
    expect(computeTrophies(db).reduce((sum, c) => sum + c.total, 0)).toBe(0);
  });
});
