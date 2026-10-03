import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync, readdirSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0013-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("0013_seance_resumed_at migration", () => {
  it("adds a nullable resumed_at to seances", () => {
    const db = setup();
    db.prepare(`INSERT INTO seances (parcours, level, day_index, started_at) VALUES ('beginner', 0, 0, '2026-10-03T00:00:00.000Z')`).run();
    expect((db.prepare(`SELECT resumed_at FROM seances`).get() as { resumed_at: string | null }).resumed_at).toBeNull();
  });

  it("adds a nullable resumed_at to tracking_seances", () => {
    const db = setup();
    db.prepare(`INSERT INTO tracking_seances (started_at) VALUES ('2026-10-03T00:00:00.000Z')`).run();
    expect((db.prepare(`SELECT resumed_at FROM tracking_seances`).get() as { resumed_at: string | null }).resumed_at).toBeNull();
  });

  it("keeps rows that existed before the migration", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0013-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    const all = path.join(process.cwd(), "migrations");
    const before = path.join(tmpDir, "before");
    // rejoue toutes les migrations sauf 0013, insère, puis applique 0013
    mkdirSync(before);
    for (const f of readdirSync(all).filter((f) => f.endsWith(".sql") && !f.startsWith("0013"))) {
      copyFileSync(path.join(all, f), path.join(before, f));
    }
    runMigrations(db, before);
    db.prepare(`INSERT INTO seances (parcours, level, day_index, started_at, completed_at) VALUES ('beginner', 2, 3, '2026-09-01T10:00:00.000Z', '2026-09-01T10:40:00.000Z')`).run();
    runMigrations(db, all);
    expect(db.prepare(`SELECT parcours, level, day_index, completed_at FROM seances`).get()).toEqual({
      parcours: "beginner", level: 2, day_index: 3, completed_at: "2026-09-01T10:40:00.000Z",
    });
  });
});
