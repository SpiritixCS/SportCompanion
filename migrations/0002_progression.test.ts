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

describe("0002_progression migration", () => {
  it("creates current_position with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0002_progression.sql");

    const cols = (db.prepare("PRAGMA table_info(current_position)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(cols).toEqual(["id", "parcours", "level", "day_index", "updated_at", "cycle"]);
  });
});
