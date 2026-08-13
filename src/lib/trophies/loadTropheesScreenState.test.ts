import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSet, completeSeance } from "@/lib/player/db";
import { startDosSeance, logDosSet, completeDosSeance } from "@/lib/dos/db";
import { loadTropheesScreenState } from "./loadTropheesScreenState";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-trophees-screen-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTropheesScreenState", () => {
  it("returns zeroed state with no cards when nothing has been logged", () => {
    const db = setup();
    const state = loadTropheesScreenState(db);
    expect(state).toEqual({ cards: [], totalReps: 0, seanceCount: 0, joursActivite: 0 });
  });

  it("sums totalReps across cards and counts completed séances and distinct days across both axes", () => {
    const db = setup();
    // beginner[0][0] exerciseOrder 6 = "squats", countsInStats: true
    const seanceA = startSeance(db, "beginner", 0, 0);
    logSet(db, { seanceId: seanceA.id, exerciseOrder: 6, setNumber: 1, repsTarget: "15", repsActual: 15, restSeconds: 90 });
    completeSeance(db, seanceA.id);

    const dosSeance = startDosSeance(db, "2026-01-05", "lundi", 1);
    logDosSet(db, { seanceId: dosSeance.id, exerciseOrder: 0, exerciseId: "A-1", setNumber: 1, valeurTarget: "8-10", valeurActual: 8, restSeconds: 60 });
    completeDosSeance(db, dosSeance.id, 1);

    const state = loadTropheesScreenState(db);
    expect(state.totalReps).toBe(23);
    expect(state.seanceCount).toBe(2);
    expect(state.joursActivite).toBe(2);
    expect(state.cards).toHaveLength(2);
  });

  it("does not count a started-but-not-completed séance in seanceCount", () => {
    const db = setup();
    startSeance(db, "beginner", 0, 0);
    const state = loadTropheesScreenState(db);
    expect(state.seanceCount).toBe(0);
  });
});
