// src/lib/tracking/loadTrackingScreenState.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { startSeance, logSetForExercise, completeSeance } from "./db";
import { createTemplate } from "./templates";
import { setRotation } from "./program";
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
  it("reports no active seance, no history and no rotation when nothing was ever set up", () => {
    const db = setup();
    expect(loadTrackingScreenState(db)).toEqual({
      activeSeance: null,
      seances: [],
      todayTemplate: null,
      rotationTemplates: [],
    });
  });

  it("surfaces the active seance's id and template, separately from completed history", () => {
    const db = setup();
    const active = startSeance(db);
    const past = startSeance(db);
    logSetForExercise(db, past.id, "Squats", "reps", 10);
    completeSeance(db, past.id);

    const state = loadTrackingScreenState(db);
    expect(state.activeSeance).toEqual({ id: active.id, templateId: null });
    expect(state.seances).toHaveLength(1);
    expect(state.seances[0]!.id).toBe(past.id);
  });

  it("surfaces today's template and the full rotation when one is active", () => {
    const db = setup();
    const push = createTemplate(db, "Push", [{ name: "Dips", unit: "reps", setsCount: 3, targetValue: 12 }]);
    const pull = createTemplate(db, "Pull", []);
    setRotation(db, [push.id, pull.id]);

    const state = loadTrackingScreenState(db);
    expect(state.todayTemplate).toMatchObject({ templateId: push.id, nom: "Push" });
    expect(state.rotationTemplates).toEqual([
      { templateId: push.id, nom: "Push" },
      { templateId: pull.id, nom: "Pull" },
    ]);
  });
});
