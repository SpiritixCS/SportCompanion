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

describe("0006_dos_sets_exercise_id migration", () => {
  it("adds exercise_id NOT NULL to dos_sets_logged, keeping the other columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0006_dos_sets_exercise_id.sql");

    const columns = (db.prepare("PRAGMA table_info(dos_sets_logged)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(columns).toEqual([
      "id", "seance_id", "exercise_order", "exercise_id", "set_number",
      "valeur_target", "valeur_actual", "rest_seconds", "completed_at",
    ]);
  });

  it("rejects a row with no exercise_id", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    db.prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`).run(
      "2026-08-17", "lundi", 1, "2026-08-17T09:00:00.000Z",
    );

    expect(() =>
      db
        .prepare(
          `INSERT INTO dos_sets_logged (seance_id, exercise_order, set_number, valeur_target, valeur_actual, rest_seconds, completed_at)
           VALUES (1, 0, 1, '10', 10, 90, '2026-08-17T09:00:00.000Z')`,
        )
        .run(),
    ).toThrow();
  });
});
