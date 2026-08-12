import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import {
  getCurrentPosition,
  setCurrentPosition,
  isDayValidated,
  countValidatedDaysInLevel,
  getLatestCompletedSeanceId,
} from "./db";
import { startSeance, completeSeance, logSet } from "@/lib/player/db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-programme-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

function completedSeance(db: ReturnType<typeof getDb>, parcours: string, level: number, dayIndex: number, reps: number) {
  const seance = startSeance(db, parcours, level, dayIndex);
  logSet(db, {
    seanceId: seance.id,
    exerciseOrder: 0,
    setNumber: 1,
    repsTarget: "10",
    repsActual: reps,
    restSeconds: 90,
  });
  completeSeance(db, seance.id);
  return seance.id;
}

describe("current_position", () => {
  it("returns null before any position is set", () => {
    const db = setup();
    expect(getCurrentPosition(db)).toBeNull();
  });

  it("writes and reads back the position", () => {
    const db = setup();
    const written = setCurrentPosition(db, "beginner", 0, 2);
    expect(written.parcours).toBe("beginner");
    expect(written.level).toBe(0);
    expect(written.dayIndex).toBe(2);
    expect(getCurrentPosition(db)).toEqual(written);
  });

  it("overwrites the single row rather than creating a second one", () => {
    const db = setup();
    setCurrentPosition(db, "beginner", 0, 0);
    setCurrentPosition(db, "intermediate", 3, 4);
    const position = getCurrentPosition(db);
    expect(position?.parcours).toBe("intermediate");
    expect(position?.level).toBe(3);
    expect(position?.dayIndex).toBe(4);
  });
});

describe("validated-day reads (derived from seances)", () => {
  it("isDayValidated is false with no completed seance", () => {
    const db = setup();
    expect(isDayValidated(db, "beginner", 0, 0)).toBe(false);
  });

  it("isDayValidated is true once a seance for that exact day is completed", () => {
    const db = setup();
    completedSeance(db, "beginner", 0, 0, 10);
    expect(isDayValidated(db, "beginner", 0, 0)).toBe(true);
    expect(isDayValidated(db, "beginner", 0, 1)).toBe(false);
  });

  it("countValidatedDaysInLevel counts distinct validated days only", () => {
    const db = setup();
    completedSeance(db, "beginner", 0, 0, 10);
    completedSeance(db, "beginner", 0, 1, 10);
    completedSeance(db, "beginner", 1, 0, 10); // different level, doesn't count
    expect(countValidatedDaysInLevel(db, "beginner", 0)).toBe(2);
  });

  it("getLatestCompletedSeanceId returns the most recently completed seance for that day", () => {
    const db = setup();
    completedSeance(db, "beginner", 0, 0, 10);
    const second = completedSeance(db, "beginner", 0, 0, 12);
    expect(getLatestCompletedSeanceId(db, "beginner", 0, 0)).toBe(second);
  });

  it("getLatestCompletedSeanceId returns null when nothing is completed", () => {
    const db = setup();
    expect(getLatestCompletedSeanceId(db, "beginner", 0, 0)).toBeNull();
  });
});
