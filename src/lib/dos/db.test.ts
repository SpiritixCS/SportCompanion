import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  getDosSeanceByDate, getOrStartDosSeance, getSetsForDosSeance, logDosSet,
  skipDosExercise, getSkippedDosExercises, completeDosSeance, toPlayerSetsLogged,
} from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("dos_seances", () => {
  it("returns null before any seance exists for a date", () => {
    const db = setup();
    expect(getDosSeanceByDate(db, "2026-08-17")).toBeNull();
  });

  it("getOrStartDosSeance creates once, returns the same row on a second call", () => {
    const db = setup();
    const first = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    const second = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    expect(second.id).toBe(first.id);
    expect(first.semaine).toBe(1);
    expect(first.completedAt).toBeNull();
  });

  it("completeDosSeance writes completed_at and gene_pendant", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    completeDosSeance(db, seance.id, 2);
    const reloaded = getDosSeanceByDate(db, "2026-08-17")!;
    expect(reloaded.completedAt).not.toBeNull();
    expect(reloaded.genePendant).toBe(2);
  });
});

describe("dos_sets_logged / dos_skipped_exercises", () => {
  it("logs a set and reads it back in order", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, exerciseId: "A-1", setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, exerciseId: "A-1", setNumber: 2, valeurTarget: "10", valeurActual: 9, restSeconds: 90 });
    const sets = getSetsForDosSeance(db, seance.id);
    expect(sets.map((s) => s.valeurActual)).toEqual([10, 9]);
    expect(sets.map((s) => s.exerciseId)).toEqual(["A-1", "A-1"]);
  });

  it("skips an exercise and reads it back", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    skipDosExercise(db, seance.id, 2);
    expect(getSkippedDosExercises(db, seance.id)).toEqual([2]);
  });
});

describe("toPlayerSetsLogged", () => {
  it("renames valeurTarget/valeurActual to repsTarget/repsActual", () => {
    const mapped = toPlayerSetsLogged([
      { id: 1, seanceId: 1, exerciseOrder: 0, exerciseId: "A-1", setNumber: 1, valeurTarget: "8-10", valeurActual: 9, restSeconds: 90, completedAt: "2026-08-17T09:00:00.000Z" },
    ]);
    expect(mapped).toEqual([
      { id: 1, seanceId: 1, exerciseOrder: 0, setNumber: 1, repsTarget: "8-10", repsActual: 9, restSeconds: 90, completedAt: "2026-08-17T09:00:00.000Z" },
    ]);
  });
});
