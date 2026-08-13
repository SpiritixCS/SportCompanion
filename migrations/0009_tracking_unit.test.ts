import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("0009_tracking_unit migration", () => {
  it("adds unit with a default of 'reps' and renames reps_actual to valeur_actual", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0009_tracking_unit.sql");

    db.prepare("INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)").run("Squats", "2026-08-13T00:00:00.000Z");
    const row = db.prepare("SELECT unit FROM tracking_exercises WHERE name = ?").get("Squats") as { unit: string };
    expect(row.unit).toBe("reps");

    expect(() => db.prepare("SELECT valeur_actual FROM tracking_sets_logged").all()).not.toThrow();
    expect(() => db.prepare("SELECT reps_actual FROM tracking_sets_logged").all()).toThrow();
  });

  it("rejects a unit outside reps/seconds", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    expect(() =>
      db.prepare("INSERT INTO tracking_exercises (name, unit, created_at) VALUES (?, ?, ?)").run("X", "kg", "2026-08-13T00:00:00.000Z"),
    ).toThrow();
  });
});
