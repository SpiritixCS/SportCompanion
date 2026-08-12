import { describe, it, expect, afterEach } from "vitest";
import { existsSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "./client";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("getDb", () => {
  it("creates the database file, including missing parent directories", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-db-"));
    const dbPath = path.join(tmpDir, "nested", "test.db");
    const db = getDb(dbPath);
    expect(existsSync(dbPath)).toBe(true);
    db.close();
  });

  it("enables WAL journal mode", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-db-"));
    const dbPath = path.join(tmpDir, "test.db");
    const db = getDb(dbPath);
    const row = db.pragma("journal_mode", { simple: true });
    expect(row).toBe("wal");
    db.close();
  });
});
