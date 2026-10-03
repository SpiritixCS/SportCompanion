import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet } from "@/lib/player/db";
import { computeTrophies } from "@/lib/trophies/computeTrophies";
import { addExtraReps, deleteExtraReps, listExtraReps } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-extra-reps-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = getDb(dbPath);
  runMigrations(db, path.join(process.cwd(), "migrations"));
  // beginner[0][0] exerciseOrder 6 = "squats", countsInStats: true
  const seance = startSeance(db, "beginner", 0, 0);
  logSet(db, { seanceId: seance.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 95, restSeconds: 90 });
  return { db, dbPath };
}

const squats = (db: Database.Database) => computeTrophies(db).find((c) => c.id === "squats")!;

describe("reps hors séance", () => {
  it("adds to the exercise total, crossing a palier", () => {
    const { db } = setup();
    expect(squats(db).total).toBe(95);
    addExtraReps(db, "squats", 10);
    expect(squats(db).total).toBe(105);
  });

  it("lists entries newest first and survives a fresh connection (CLAUDE.md §2)", () => {
    const { db, dbPath } = setup();
    addExtraReps(db, "squats", 5);
    addExtraReps(db, "squats", 7);
    db.close();
    const fresh = new Database(dbPath);
    expect(listExtraReps(fresh, "squats").map((e) => e.amount)).toEqual([7, 5]);
    expect(squats(fresh).total).toBe(107);
    fresh.close();
  });

  it("deletes an entry, removing its reps from the total", () => {
    const { db } = setup();
    addExtraReps(db, "squats", 10);
    deleteExtraReps(db, listExtraReps(db, "squats")[0]!.id);
    expect(squats(db).total).toBe(95);
    expect(listExtraReps(db, "squats")).toEqual([]);
  });

  it("refuses an exercise absent from Trophées", () => {
    const { db } = setup();
    expect(() => addExtraReps(db, "inconnu", 10)).toThrow();
    expect(computeTrophies(db).find((c) => c.id === "inconnu")).toBeUndefined();
  });

  it.each([0, -3, 2.5, Number.NaN, 100_001])("refuses amount %s", (amount) => {
    const { db } = setup();
    expect(() => addExtraReps(db, "squats", amount)).toThrow();
    expect(squats(db).total).toBe(95);
  });
});
