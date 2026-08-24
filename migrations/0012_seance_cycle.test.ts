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
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0012-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("0012_seance_cycle migration", () => {
  it("adds cycle to seances, defaulting to 0", () => {
    const db = setup();
    db.prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES (?, ?, ?, ?)`).run(
      "beginner",
      0,
      0,
      "2026-08-24T00:00:00.000Z",
    );
    const row = db.prepare(`SELECT cycle FROM seances`).get() as { cycle: number };
    expect(row.cycle).toBe(0);
  });

  it("adds cycle to current_position, defaulting to 0", () => {
    const db = setup();
    db.prepare(`INSERT INTO current_position (id, parcours, level, day_index, updated_at) VALUES (1, ?, ?, ?, ?)`).run(
      "beginner",
      0,
      0,
      "2026-08-24T00:00:00.000Z",
    );
    const row = db.prepare(`SELECT cycle FROM current_position`).get() as { cycle: number };
    expect(row.cycle).toBe(0);
  });
});
