import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getSettings, updateSettings } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-settings-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("getSettings", () => {
  it("returns the migration defaults on a fresh database", () => {
    const db = setup();
    expect(getSettings(db)).toEqual({
      restBetweenSetsSeconds: 90,
      restBetweenExercisesSeconds: 120,
      soundCountdownEnabled: false,
      startCountdownEnabled: false,
      keepScreenAwakeEnabled: true,
    });
  });
});

describe("updateSettings", () => {
  it("updates only the given fields, leaving the rest untouched", () => {
    const db = setup();
    const result = updateSettings(db, { restBetweenSetsSeconds: 45 });
    expect(result.restBetweenSetsSeconds).toBe(45);
    expect(result.restBetweenExercisesSeconds).toBe(120);
  });

  it("round-trips a boolean toggle", () => {
    const db = setup();
    updateSettings(db, { keepScreenAwakeEnabled: false });
    expect(getSettings(db).keepScreenAwakeEnabled).toBe(false);
  });

  it("persists across separate reads (survives navigating away and back)", () => {
    const db = setup();
    updateSettings(db, { soundCountdownEnabled: true });
    expect(getSettings(db).soundCountdownEnabled).toBe(true);
    expect(getSettings(db).soundCountdownEnabled).toBe(true);
  });
});
