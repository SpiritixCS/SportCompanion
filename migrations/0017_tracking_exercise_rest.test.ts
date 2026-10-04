import { describe, it, expect, afterEach } from "vitest";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("0017_tracking_exercise_rest migration", () => {
  it("adds a nullable rest_seconds and leaves existing exercises on the global setting", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0017-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const all = path.join(process.cwd(), "migrations");
    // Base à 0016 avec un exercice déjà composé, puis 0017.
    const before = path.join(tmpDir, "m");
    mkdirSync(before);
    for (const f of readdirSync(all)) {
      if (f.endsWith(".sql") && f < "0017") copyFileSync(path.join(all, f), path.join(before, f));
    }
    runMigrations(db, before);
    db.prepare(
      `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value)
       VALUES (0, 0, 'Dips', 'reps', 3, 12)`,
    ).run();
    runMigrations(db, all);
    expect(db.prepare(`SELECT rest_seconds AS r FROM tracking_program_day_exercises`).get()).toEqual({ r: null });
  });
});
