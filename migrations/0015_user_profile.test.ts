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

describe("0015_user_profile migration", () => {
  it("creates a single profile row with a null prenom", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0015-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(db.prepare(`SELECT id, prenom FROM user_profile`).all()).toEqual([{ id: 1, prenom: null }]);
  });
});
