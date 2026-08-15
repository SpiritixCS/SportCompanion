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

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0011-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("0011_tracking_program_days migration", () => {
  it("applies and seeds the 7 program days as rest by default", () => {
    const db = setup();
    const rows = db
      .prepare(`SELECT day_of_week AS dayOfWeek, is_rest AS isRest FROM tracking_program_days ORDER BY day_of_week`)
      .all();
    expect(rows).toEqual([
      { dayOfWeek: 0, isRest: 1 },
      { dayOfWeek: 1, isRest: 1 },
      { dayOfWeek: 2, isRest: 1 },
      { dayOfWeek: 3, isRest: 1 },
      { dayOfWeek: 4, isRest: 1 },
      { dayOfWeek: 5, isRest: 1 },
      { dayOfWeek: 6, isRest: 1 },
    ]);
  });

  it("initializes the pointer at day 0", () => {
    const db = setup();
    const state = db
      .prepare(`SELECT pointer_day_of_week AS pointerDayOfWeek FROM tracking_program_state WHERE id = 1`)
      .get();
    expect(state).toEqual({ pointerDayOfWeek: 0 });
  });

  it("stores day exercises with a unique (day_of_week, ordre) pair", () => {
    const db = setup();
    db.prepare(
      `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(0, 0, "Dips", "reps", 3, 12);
    expect(() =>
      db
        .prepare(
          `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(0, 0, "Pompes", "reps", 3, 15),
    ).toThrow();
  });

  it("rejects a day exercise unit outside reps/seconds", () => {
    const db = setup();
    expect(() =>
      db
        .prepare(
          `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value) VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(0, 0, "X", "kg", 3, 10),
    ).toThrow();
  });

  it("renames tracking_seances.template_id to program_day_of_week, nullable", () => {
    const db = setup();
    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run("2026-08-15T00:00:00.000Z");
    const row = db.prepare(`SELECT program_day_of_week AS programDayOfWeek FROM tracking_seances`).get();
    expect(row).toEqual({ programDayOfWeek: null });
  });

  it("drops the old template/rotation tables", () => {
    const db = setup();
    expect(() => db.prepare(`SELECT 1 FROM tracking_templates`).get()).toThrow();
    expect(() => db.prepare(`SELECT 1 FROM tracking_program_rotation`).get()).toThrow();
    expect(() => db.prepare(`SELECT 1 FROM tracking_template_exercises`).get()).toThrow();
  });
});
