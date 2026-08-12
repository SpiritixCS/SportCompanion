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

describe("0003_backpain migration", () => {
  it("creates dos_start_date and dos_evaluations with the expected columns", () => {
    tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-migration-"));
    const db = getDb(path.join(tmpDir, "test.db"));

    const { applied } = runMigrations(db, path.join(process.cwd(), "migrations"));
    expect(applied).toContain("0003_backpain.sql");

    const startDateCols = (db.prepare("PRAGMA table_info(dos_start_date)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(startDateCols).toEqual(["id", "start_date", "set_at"]);

    const evalCols = (db.prepare("PRAGMA table_info(dos_evaluations)").all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(evalCols).toEqual(["id", "arbre", "semaine", "cran_apres", "resultat", "horodatage"]);
  });
});
