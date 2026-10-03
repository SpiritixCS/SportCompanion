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

describe("0001_seances migration", () => {
  it("creates seances, sets_logged, and skipped_exercises with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0001_seances.sql");

    const seancesCols = (db.prepare("PRAGMA table_info(seances)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(seancesCols).toEqual([
      "id",
      "parcours",
      "level",
      "day_index",
      "started_at",
      "completed_at",
      "cycle",
      "resumed_at",
    ]);

    const setsCols = (db.prepare("PRAGMA table_info(sets_logged)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(setsCols).toEqual([
      "id",
      "seance_id",
      "exercise_order",
      "set_number",
      "reps_target",
      "reps_actual",
      "rest_seconds",
      "completed_at",
    ]);

    const skippedCols = (
      db.prepare("PRAGMA table_info(skipped_exercises)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(skippedCols).toEqual(["seance_id", "exercise_order", "skipped_at"]);
  });
});
