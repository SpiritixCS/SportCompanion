import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSetForExercise, completeSeance } from "./db";
import { loadTrackingScreenState } from "./loadTrackingScreenState";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-tracking-state-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("loadTrackingScreenState", () => {
  it("reports no active seance and no history when nothing was ever logged", () => {
    const db = setup();
    const state = loadTrackingScreenState(db);
    expect(state).toEqual({ activeSeanceId: null, seances: [] });
  });

  it("surfaces the active seance id separately from completed history", () => {
    const db = setup();
    const active = startSeance(db);
    const past = startSeance(db);
    logSetForExercise(db, past.id, "Squats", "reps", 10);
    completeSeance(db, past.id);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeanceId).toBe(active.id);
    expect(state.seances).toHaveLength(1);
    expect(state.seances[0]!.id).toBe(past.id);
  });
});
