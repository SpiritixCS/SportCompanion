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
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
  return { db, applied };
}

describe("0004_backpain_constraints migration", () => {
  it("applies 0003 and 0004 in sequence and keeps the dos_evaluations columns intact", () => {
    const { applied } = setup();
    expect(applied).toContain("0003_backpain.sql");
    expect(applied).toContain("0004_backpain_constraints.sql");
  });

  it("keeps the same columns after rebuilding the table with constraints", () => {
    const { db } = setup();
    const evalCols = (db.prepare("PRAGMA table_info(dos_evaluations)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(evalCols).toEqual(["id", "arbre", "semaine", "cran_apres", "resultat", "horodatage"]);
  });

  it("still accepts a valid row", () => {
    const { db } = setup();
    expect(() =>
      db
        .prepare(
          `INSERT INTO dos_evaluations (arbre, semaine, cran_apres, resultat, horodatage)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("A", 3, 2, "montee", "2026-08-12T10:00:00.000Z"),
    ).not.toThrow();
  });

  it("rejects an invalid resultat", () => {
    const { db } = setup();
    expect(() =>
      db
        .prepare(
          `INSERT INTO dos_evaluations (arbre, semaine, cran_apres, resultat, horodatage)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("A", 3, 2, "bogus", "2026-08-12T10:00:00.000Z"),
    ).toThrow();
  });

  it("rejects an invalid arbre", () => {
    const { db } = setup();
    expect(() =>
      db
        .prepare(
          `INSERT INTO dos_evaluations (arbre, semaine, cran_apres, resultat, horodatage)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run("Z", 3, 2, "montee", "2026-08-12T10:00:00.000Z"),
    ).toThrow();
  });
});
