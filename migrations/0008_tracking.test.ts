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

describe("0008_tracking migration", () => {
  it("creates the three tracking tables, empty", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0008_tracking.sql");

    expect(db.prepare("SELECT COUNT(*) AS n FROM tracking_exercises").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM tracking_seances").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM tracking_sets_logged").get()).toEqual({ n: 0 });
  });

  it("rejects a duplicate exercise name", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    db.prepare("INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)").run("Squats", "2026-08-13T00:00:00.000Z");
    expect(() =>
      db.prepare("INSERT INTO tracking_exercises (name, created_at) VALUES (?, ?)").run("Squats", "2026-08-13T00:00:00.000Z"),
    ).toThrow();
  });
});
