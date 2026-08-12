import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { loadDosPlayerState } from "./loadDosPlayerState";
import { logDosSet, skipDosExercise, completeDosSeance, getOrStartDosSeance } from "./db";
import type { TrainDay } from "@/lib/workout/types";

const DAY: TrainDay = {
  kind: "train",
  label: "lundi",
  exercises: [
    { id: "lundi-hip-hinge-echauffement", name: "Hip hinge au bâton", movementFamily: "dos-fixe", countsInStats: false, videoId: null, sets: 1, target: { unit: "reps", value: 10, maxEffort: false, eachSide: false } },
    { id: "A-1", name: "Hip hinge au bâton", movementFamily: "arbre-A", countsInStats: true, videoId: null, sets: 1, target: { unit: "reps", value: [8, 10], maxEffort: false, eachSide: false } },
  ],
};

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-dos-player-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadDosPlayerState", () => {
  it("starts a seance and returns in-progress at the first exercise", () => {
    const db = setup();
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    expect(state.phase).toBe("in-progress");
    if (state.phase !== "in-progress") throw new Error("unreachable");
    expect(state.next).toEqual({ exerciseOrder: 0, setNumber: 1, isLastSetOfExercise: true, isLastExerciseOfDay: false });
  });

  it("reports pending-validation once every set is logged", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 0, exerciseId: "lundi-hip-hinge-echauffement", setNumber: 1, valeurTarget: "10", valeurActual: 10, restSeconds: 90 });
    logDosSet(db, { seanceId: seance.id, exerciseOrder: 1, exerciseId: "A-1", setNumber: 1, valeurTarget: "8-10", valeurActual: 9, restSeconds: 90 });
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    expect(state.phase).toBe("pending-validation");
  });

  it("reports completed after completeDosSeance", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    completeDosSeance(db, seance.id, 1);
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    expect(state).toEqual({ phase: "completed", seanceId: seance.id });
  });

  it("skips a wholesale-skipped exercise when computing next", () => {
    const db = setup();
    const seance = getOrStartDosSeance(db, "2026-08-17", "lundi", 1);
    skipDosExercise(db, seance.id, 0);
    const state = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    if (state.phase !== "in-progress") throw new Error("unreachable");
    expect(state.next.exerciseOrder).toBe(1);
  });

  // Mandatory persistence check (CLAUDE.md §7): log a set, simulate
  // "navigate away and come back" by reading state fresh from the DB with a
  // brand new call — the state must be read, never reconstructed.
  it("survives a full reload: a logged set is reflected on a fresh loadDosPlayerState call", () => {
    const db = setup();
    const first = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    if (first.phase !== "in-progress") throw new Error("unreachable");

    logDosSet(db, {
      seanceId: first.seanceId, exerciseOrder: 0, exerciseId: "lundi-hip-hinge-echauffement", setNumber: 1,
      valeurTarget: "10", valeurActual: 10, restSeconds: 90,
    });

    // Fresh call, no shared in-memory state — the only way this can see the
    // logged set is by reading it from the DB.
    const second = loadDosPlayerState(db, "2026-08-17", "lundi", 1, DAY);
    if (second.phase !== "in-progress") throw new Error("unreachable");
    expect(second.next.exerciseOrder).toBe(1);
    expect(second.seanceId).toBe(first.seanceId);
  });
});
