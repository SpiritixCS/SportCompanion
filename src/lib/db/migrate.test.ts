import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "./client";
import { runMigrations } from "./migrate";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migrate-"));
  const migrationsDir = path.join(tmpDir, "migrations");
  mkdirSync(migrationsDir);
  const db = getDb(path.join(tmpDir, "test.db"));
  return { migrationsDir, db };
}

describe("runMigrations", () => {
  it("applies migrations in filename order and records them", () => {
    const { migrationsDir, db } = setup();
    writeFileSync(
      path.join(migrationsDir, "0002_second.sql"),
      "CREATE TABLE second (id INTEGER PRIMARY KEY);",
    );
    writeFileSync(
      path.join(migrationsDir, "0001_first.sql"),
      "CREATE TABLE first (id INTEGER PRIMARY KEY);",
    );

    const result = runMigrations(db, migrationsDir);

    expect(result.applied).toEqual(["0001_first.sql", "0002_second.sql"]);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all();
    expect(tables).toEqual([{ name: "_migrations" }, { name: "first" }, { name: "second" }]);
  });

  it("is idempotent — re-running applies nothing new", () => {
    const { migrationsDir, db } = setup();
    writeFileSync(
      path.join(migrationsDir, "0001_first.sql"),
      "CREATE TABLE first (id INTEGER PRIMARY KEY);",
    );

    runMigrations(db, migrationsDir);
    const second = runMigrations(db, migrationsDir);

    expect(second.applied).toEqual([]);
  });

  it("stops on the first failing migration and does not mark it applied", () => {
    const { migrationsDir, db } = setup();
    writeFileSync(
      path.join(migrationsDir, "0001_broken.sql"),
      "NOT VALID SQL AT ALL;",
    );
    writeFileSync(
      path.join(migrationsDir, "0002_after.sql"),
      "CREATE TABLE after_broken (id INTEGER PRIMARY KEY);",
    );

    expect(() => runMigrations(db, migrationsDir)).toThrow(/0001_broken\.sql/);

    const applied = db.prepare("SELECT filename FROM _migrations").all();
    expect(applied).toEqual([]);
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='after_broken'")
      .all();
    expect(tables).toEqual([]);
  });
});
