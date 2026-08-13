import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet } from "@/lib/player/db";
import { startDosSeance, logDosSet } from "@/lib/dos/db";
import { computeTrophies, resolveTrophyCardId, isReplogEligible } from "./computeTrophies";

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

describe("resolveTrophyCardId", () => {
  it("returns the arbre letter for an arbre exercise id", () => {
    expect(resolveTrophyCardId("A-3")).toBe("A");
    expect(resolveTrophyCardId("C-1")).toBe("C");
  });

  it("returns the id unchanged for a non-arbre id", () => {
    expect(resolveTrophyCardId("squats")).toBe("squats");
    expect(resolveTrophyCardId("lundi-hip-hinge-echauffement")).toBe("lundi-hip-hinge-echauffement");
  });
});

describe("isReplogEligible", () => {
  it("falls back to countsInStats for a non-arbre id", () => {
    expect(isReplogEligible("squats", true)).toBe(true);
    expect(isReplogEligible("plank", false)).toBe(false);
  });

  it("checks the arbre's unite for the given bloc, ignoring countsInStats", () => {
    // Arbre A is "reps" in every bloc.
    expect(isReplogEligible("A-1", true, 1)).toBe(true);
    // Arbre C is "reps" in blocs 1-2, "s" in blocs 3-4 (weeks 9-16).
    expect(isReplogEligible("C-1", true, 1)).toBe(true);
    expect(isReplogEligible("C-1", true, 9)).toBe(false);
  });

  it("treats an arbre id with no known bloc context as ineligible, rather than throwing", () => {
    expect(isReplogEligible("A-1", true)).toBe(false);
  });
});

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

describe("computeTrophies — Dos", () => {
  it("counts a reps-bloc set and excludes a seconds-bloc set for the same arbre, grouping crans under one card", () => {
    const db = setup();
    // Arbre C: bloc 1 (weeks 1-4) = reps, bloc 3 (weeks 9-12) = "s".
    const seanceReps1 = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: seanceReps1.id, exerciseOrder: 0, exerciseId: "C-1", setNumber: 1, valeurTarget: "10-12", valeurActual: 10, restSeconds: 60 });
    const seanceReps2 = startDosSeance(db, "2026-01-12", "lundi", 2);
    logDosSet(db, { seanceId: seanceReps2.id, exerciseOrder: 0, exerciseId: "C-2", setNumber: 1, valeurTarget: "12-15", valeurActual: 12, restSeconds: 60 });
    const seanceSeconds = startDosSeance(db, "2026-03-02", "lundi", 9);
    logDosSet(db, { seanceId: seanceSeconds.id, exerciseOrder: 0, exerciseId: "C-1", setNumber: 1, valeurTarget: "30-45", valeurActual: 40, restSeconds: 60 });

    const cards = computeTrophies(db);
    const arbreC = cards.find((c) => c.id === "C");
    expect(arbreC).toMatchObject({ module: "dos", name: "Extenseurs lombaires", total: 22 });
    expect(arbreC?.byCran).toEqual([
      { cran: 1, nom: "Superman au sol, tenue 5 s", total: 10 },
      { cran: 2, nom: "Reverse hyper au bord du lit", total: 12 },
    ]);
  });

  it("never creates a card for a fixed (non-arbre) Dos exercise id", () => {
    const db = setup();
    const seance = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 1, exerciseId: "lundi-hip-hinge-echauffement", setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 60 });

    const cards = computeTrophies(db);
    expect(cards.find((c) => c.id === "lundi-hip-hinge-echauffement")).toBeUndefined();
    expect(cards).toHaveLength(0);
  });
});
