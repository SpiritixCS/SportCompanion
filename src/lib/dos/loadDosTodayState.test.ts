import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadDosTodayState } from "./loadDosTodayState";
import { setStartDate } from "@/lib/backpain/db";
import { getOrStartDosSeance, logDosSet, completeDosSeance } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
  vi.useRealTimers();
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-today-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

function freezeToMonday() {
  // 2026-08-17 is a Monday.
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-08-17T09:00:00.000Z"));
}

describe("loadDosTodayState", () => {
  it("reports no-start-date before setup", () => {
    const db = setup();
    expect(loadDosTodayState(db)).toEqual({ phase: "no-start-date" });
  });

  it("reports rest on Sunday", () => {
    const db = setup();
    setStartDate(db, "2026-08-10");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T09:00:00.000Z")); // Sunday
    expect(loadDosTodayState(db)).toEqual({ phase: "rest" });
  });

  it("reports normal with the right intitulé and the full exercise list on Monday", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    freezeToMonday();
    const state = loadDosTodayState(db);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.jourLabel).toBe("Lundi");
    expect(state.intitule).toBe("Charnière & chaîne postérieure");
    expect(state.exercises).toHaveLength(4); // 1 fixe (lundi) + arbres A, B, C
    expect(state.done).toBe(false);
    expect(state.resume).toBeNull();
  });

  it("surfaces a resume when a seance is in progress", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    freezeToMonday();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, exerciseId: "lundi-hip-hinge-echauffement", setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    const state = loadDosTodayState(db);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.resume).not.toBeNull();
  });

  it("reports done with total reps once the seance is completed", () => {
    const db = setup();
    setStartDate(db, "2026-08-17");
    freezeToMonday();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, exerciseId: "lundi-hip-hinge-echauffement", setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    completeDosSeance(db, seance.id, 1);
    const state = loadDosTodayState(db);
    if (state.phase !== "normal") throw new Error("unreachable");
    expect(state.done).toBe(true);
    expect(state.doneReps).toBe(10);
  });
});
