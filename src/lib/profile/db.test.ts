import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getPrenom, setPrenom } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-profile-"));
  const dbPath = path.join(tmpDir, "test.db");
  const db = getDb(dbPath);
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return { db, dbPath };
}

describe("prénom", () => {
  it("is null until set", () => {
    expect(getPrenom(setup().db)).toBeNull();
  });

  it("stores a trimmed prénom, read back from a fresh connection (CLAUDE.md §2)", () => {
    const { db, dbPath } = setup();
    setPrenom(db, "  Léa ");
    db.close();
    const fresh = new Database(dbPath);
    expect(getPrenom(fresh)).toBe("Léa");
    fresh.close();
  });

  it.each(["", "   ", "x".repeat(41)])("rejects %j", (value) => {
    const { db } = setup();
    expect(() => setPrenom(db, value)).toThrow();
    expect(getPrenom(db)).toBeNull();
  });
});
