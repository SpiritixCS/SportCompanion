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

describe("0014_drop_dos migration", () => {
  it("removes every dos_* table and keeps Programme tables", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-0014-"));
    const db = getDb(path.join(tmpDir, "test.db"));
    runMigrations(db, path.join(process.cwd(), "migrations"));
    const names = (db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name);
    expect(names.filter((n) => n.startsWith("dos_"))).toEqual([]);
    expect(names).toEqual(expect.arrayContaining(["seances", "sets_logged", "current_position", "tracking_seances"]));
  });
});
