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

describe("0018_pyramide migration", () => {
  it("adds the pyramid columns and table, leaving existing rows untouched", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0018-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const all = path.join(process.cwd(), "migrations");
    const before = path.join(tmpDir, "m");
    mkdirSync(before);
    for (const f of readdirSync(all)) {
      if (f.endsWith(".sql") && f < "0018") copyFileSync(path.join(all, f), path.join(before, f));
    }
    runMigrations(db, before);
    db.prepare(`INSERT INTO tracking_exercises (name, unit, created_at) VALUES ('Good moraine', 'reps', '2026-10-01')`).run();
    db.prepare(
      `INSERT INTO tracking_program_day_exercises (day_of_week, ordre, exercise_name, unit, sets_count, target_value, rest_seconds)
       VALUES (0, 0, 'Good moraine', 'reps', 3, 10, NULL)`,
    ).run();

    runMigrations(db, all);

    expect(db.prepare(`SELECT name, unit, catalog_id AS c FROM tracking_exercises`).all()).toEqual([
      { name: "Good moraine", unit: "reps", c: null },
    ]);
    expect(
      db.prepare(`SELECT exercise_name AS n, sets_count AS s, target_value AS t, pyramid_shape AS ps, pyramid_peak AS pp FROM tracking_program_day_exercises`).all(),
    ).toEqual([{ n: "Good moraine", s: 3, t: 10, ps: null, pp: null }]);
    expect(db.prepare(`SELECT COUNT(*) AS n FROM tracking_pyramids`).get()).toEqual({ n: 0 });
  });
});
