import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startPyramidSeance, startSeance, logSetForExercise } from "./db";
import { loadPyramidPlayerState } from "./loadPyramidPlayerState";
import { findCatalogByName } from "@/lib/pyramide/catalog";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-pyramid-player-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadPyramidPlayerState", () => {
  it("is null without an active pyramid", () => {
    const db = setup();
    expect(loadPyramidPlayerState(db)).toBeNull();
    startSeance(db, 1);
    expect(loadPyramidPlayerState(db)).toBeNull();
  });

  it("builds a one-exercise day linked to the catalogue", () => {
    const db = setup();
    startPyramidSeance(db, { exerciseName: "pull ups", shape: "classic", peak: 3 });
    const loaded = loadPyramidPlayerState(db)!;
    expect(loaded.day.exercises).toEqual([
      expect.objectContaining({ id: "pull-ups", name: "pull ups", movementFamily: "pull", sets: 5, pyramid: { shape: "classic", peak: 3 } }),
    ]);
  });

  it("keeps a free exercise apart, with an initial", () => {
    const db = setup();
    const seance = startPyramidSeance(db, { exerciseName: "Corde", shape: "inverted", peak: 4 });
    const loaded = loadPyramidPlayerState(db)!;
    expect(loaded.day.exercises[0]).toMatchObject({ id: `pyramide-${seance.id}`, movementFamily: "other", sets: 7 });
    expect(loaded.catalog).toBeNull();
  });

  it("resumes at the step after the last one logged", () => {
    const db = setup();
    const seance = startPyramidSeance(db, { exerciseName: "Pull ups", shape: "classic", peak: 3 });
    const catalog = findCatalogByName("Pull ups")!;
    for (const reps of [1, 2, 3]) logSetForExercise(db, seance.id, "Pull ups", "reps", reps, 1, 0, catalog);
    const loaded = loadPyramidPlayerState(db)!;
    expect(loaded.state).toMatchObject({ phase: "in-progress", seanceId: seance.id, next: { exerciseOrder: 0, setNumber: 4 } });
    expect(loaded.setsLogged.map((s) => s.repsActual)).toEqual([1, 2, 3]);
  });

  it("waits for validation once every step is logged", () => {
    const db = setup();
    const seance = startPyramidSeance(db, { exerciseName: "Corde", shape: "classic", peak: 2 });
    for (const reps of [1, 2, 1]) logSetForExercise(db, seance.id, "Corde", "reps", reps, 1, 0);
    expect(loadPyramidPlayerState(db)!.state.phase).toBe("pending-validation");
  });
});
