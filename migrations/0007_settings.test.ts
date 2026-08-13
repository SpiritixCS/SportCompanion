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

describe("0007_settings migration", () => {
  it("creates app_settings with one default row", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0007_settings.sql");

    const row = db.prepare("SELECT * FROM app_settings").get() as Record<string, number>;
    expect(row).toEqual({
      id: 1,
      rest_between_sets_seconds: 90,
      rest_between_exercises_seconds: 120,
      sound_countdown_enabled: 0,
      start_countdown_enabled: 0,
      keep_screen_awake_enabled: 1,
    });
  });

  it("rejects a second row (single-row table)", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));

    expect(() => db.prepare("INSERT INTO app_settings (id) VALUES (2)").run()).toThrow();
  });
});
