import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet } from "@/lib/player/db";
import { logSetForExercise, startSeance as startTrackingSeance } from "@/lib/tracking/db";
import { computeTrophies } from "./computeTrophies";
import { findCatalogByName } from "@/lib/pyramide/catalog";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-trophies-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("computeTrophies — Programme", () => {
  it("merges the same exercise id logged across different days into one card", () => {
    const db = setup();
    // beginner[0][0] (Day 1) exerciseOrder 6 = "squats", countsInStats: true
    const seanceA = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });
    // beginner[0][4] (Day 5) exerciseOrder 6 = "squats" too
    const seanceB = startSeance(db, "beginner", 0, 4);
    logSet(db, { seanceId: seanceB.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 12, restSeconds: 90 });

    const cards = computeTrophies(db);
    const squats = cards.find((c) => c.id === "squats");
    expect(squats).toMatchObject({ module: "programme", name: "Squats", total: 27 });
  });

  it("excludes an exercise with countsInStats: false", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 0 = "push-ups-on-knees-negatives", countsInStats: false
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 0, setNumber: 1, repsTarget: "6", repsActual: 6, restSeconds: 90 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "push-ups-on-knees-negatives")).toBeUndefined();
  });
});

describe("computeTrophies — Tracking", () => {
  it("creates one card per tracking exercise, cumulating reps across seances", () => {
    const db = setup();
    const seanceA = startTrackingSeance(db);
    logSetForExercise(db, seanceA.id, "Squats", "reps", 12);
    const seanceB = startTrackingSeance(db);
    logSetForExercise(db, seanceB.id, "Squats", "reps", 8);

    const cards = computeTrophies(db);
    const squats = cards.find((c) => c.name === "Squats" && c.module === "tracking");
    expect(squats).toMatchObject({ module: "tracking", name: "Squats", total: 20 });
  });

  it("keeps distinct tracking exercises as separate cards", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);
    logSetForExercise(db, seance.id, "Fentes", "reps", 10);

    const cards = computeTrophies(db).filter((c) => c.module === "tracking");
    expect(cards).toHaveLength(2);
  });

  it("carries the exercise's unit onto its card, and keeps a seconds card out of any reps grouping", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Planche", "seconds", 30);
    logSetForExercise(db, seance.id, "Planche", "seconds", 45);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);

    const cards = computeTrophies(db).filter((c) => c.module === "tracking");
    const planche = cards.find((c) => c.name === "Planche");
    const squats = cards.find((c) => c.name === "Squats");
    expect(planche).toMatchObject({ unit: "seconds", total: 75 });
    expect(squats).toMatchObject({ unit: "reps", total: 12 });
  });
});

describe("computeTrophies — Programme cards are always unit: reps", () => {
  it("tags every Programme card as unit reps", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });

    const cards = computeTrophies(db);
    expect(cards.every((c) => c.unit === "reps")).toBe(true);
  });
});

describe("computeTrophies — movementFamily", () => {
  it("carries the exercise's movementFamily for a Programme card", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 6 = "Squats", movementFamily "squat"
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "squats")?.movementFamily).toBe("squat");
  });

  it("always tags a Tracking card as other", () => {
    const db = setup();
    const seance = startTrackingSeance(db);
    logSetForExercise(db, seance.id, "Squats", "reps", 12);

    const cards = computeTrophies(db).filter((c) => c.module === "tracking");
    expect(cards[0]?.movementFamily).toBe("other");
  });
});

describe("computeTrophies — pyramides liées au catalogue", () => {
  const squatsCatalog = () => findCatalogByName("Squats")!;

  it("adds linked Tracking sets to the catalogue card, alongside Programme sets", () => {
    const db = setup();
    const seance = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });
    const pyramid = startTrackingSeance(db);
    logSetForExercise(db, pyramid.id, "Squats", "reps", 3, 1, 0, squatsCatalog());

    const cards = computeTrophies(db);
    expect(cards.filter((c) => c.id === "squats")).toEqual([expect.objectContaining({ module: "programme", total: 18 })]);
    expect(cards.some((c) => c.module === "tracking")).toBe(false);
  });

  it("creates the catalogue card from linked sets alone", () => {
    const db = setup();
    const pyramid = startTrackingSeance(db);
    logSetForExercise(db, pyramid.id, "squats", "reps", 5, 1, 0, squatsCatalog());

    expect(computeTrophies(db).find((c) => c.id === "squats")).toMatchObject({
      module: "programme",
      name: "Squats",
      movementFamily: "squat",
      unit: "reps",
      total: 5,
    });
  });
});
