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

// Les tables modèles/rotation/état créées par cette migration ont depuis été
// supprimées par 0011_tracking_program_days.sql (programme réécrit sur 7
// jours fixes) — seule tracking_skipped_exercises, introduite ici, survit
// inchangée et reste vérifiée.
describe("0010_tracking_program migration", () => {
  it("creates the tracking_skipped_exercises table", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0010_tracking_program.sql");

    const createdAt = "2026-08-15T00:00:00.000Z";
    const seance = db.prepare(`INSERT INTO tracking_seances (started_at) VALUES (?)`).run(createdAt);
    const seanceId = Number(seance.lastInsertRowid);
    db.prepare(`INSERT INTO tracking_skipped_exercises (seance_id, exercise_order, skipped_at) VALUES (?, ?, ?)`).run(
      seanceId,
      0,
      createdAt,
    );

    expect(
      db.prepare(`SELECT COUNT(*) AS n FROM tracking_skipped_exercises WHERE seance_id = ?`).get(seanceId),
    ).toMatchObject({ n: 1 });
  });
});
