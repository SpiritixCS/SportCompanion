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

describe("0005_dos_seances migration", () => {
  it("creates dos_seances, dos_sets_logged, dos_skipped_exercises with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0005_dos_seances.sql");

    const seances = (db.prepare("PRAGMA table_info(dos_seances)").all() as { name: string }[]).map((c) => c.name);
    expect(seances).toEqual(["id", "date", "jour_semaine", "semaine", "started_at", "completed_at", "gene_pendant"]);

    // dos_sets_logged gains exercise_id in migration 0006 — this checks the
    // table as it stands today (all migrations applied), not the schema as
    // it was the moment 0005 alone had run. See 0006_dos_sets_exercise_id.test.ts
    // for the migration that adds this column.
    const sets = (db.prepare("PRAGMA table_info(dos_sets_logged)").all() as { name: string }[]).map((c) => c.name);
    expect(sets).toEqual([
      "id", "seance_id", "exercise_order", "exercise_id", "set_number", "valeur_target", "valeur_actual", "rest_seconds", "completed_at",
    ]);

    const skipped = (db.prepare("PRAGMA table_info(dos_skipped_exercises)").all() as { name: string }[]).map((c) => c.name);
    expect(skipped).toEqual(["seance_id", "exercise_order", "skipped_at"]);
  });

  it("rejects a second dos_seances row for the same date", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    db.prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`).run(
      "2026-08-17", "lundi", 1, "2026-08-17T09:00:00.000Z",
    );
    expect(() =>
      db.prepare(`INSERT INTO dos_seances (date, jour_semaine, semaine, started_at) VALUES (?, ?, ?, ?)`).run(
        "2026-08-17", "lundi", 1, "2026-08-17T09:05:00.000Z",
      ),
    ).toThrow();
  });
});
