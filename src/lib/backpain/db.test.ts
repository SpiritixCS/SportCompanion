import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { getDb } from "@/lib/db/client";
import { runMigrations } from "@/lib/db/migrate";
import { getStartDate, setStartDate, recordEvaluation, getEvaluations } from "./db";

let tmpDir: string;

afterEach(() => {
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

function setup() {
  tmpDir = mkdtempSync(path.join(tmpdir(), "sportcompanion-backpain-db-"));
  const db = getDb(path.join(tmpDir, "test.db"));
  runMigrations(db, path.join(process.cwd(), "migrations"));
  return db;
}

describe("dos_start_date", () => {
  it("returns null before it is set", () => {
    const db = setup();
    expect(getStartDate(db)).toBeNull();
  });

  it("writes and reads back the start date", () => {
    const db = setup();
    setStartDate(db, "2026-08-12");
    expect(getStartDate(db)).toBe("2026-08-12");
  });

  it("overwrites the single row rather than creating a second one", () => {
    const db = setup();
    setStartDate(db, "2026-08-12");
    setStartDate(db, "2026-09-01");
    expect(getStartDate(db)).toBe("2026-09-01");
  });
});

describe("dos_evaluations", () => {
  it("returns an empty list before any evaluation is recorded", () => {
    const db = setup();
    expect(getEvaluations(db)).toEqual([]);
  });

  it("records and reads back an evaluation", () => {
    const db = setup();
    recordEvaluation(db, {
      arbre: "A",
      semaine: 3,
      cranApres: 2,
      resultat: "montee",
      horodatage: "2026-08-12T10:00:00.000Z",
    });
    expect(getEvaluations(db)).toEqual([
      { arbre: "A", semaine: 3, cranApres: 2, resultat: "montee", horodatage: "2026-08-12T10:00:00.000Z" },
    ]);
  });

  it("returns rows in ascending (chronological) order", () => {
    const db = setup();
    recordEvaluation(db, { arbre: "A", semaine: 1, cranApres: 1, resultat: "calibrage", horodatage: "2026-08-12T09:00:00.000Z" });
    recordEvaluation(db, { arbre: "A", semaine: 1, cranApres: 2, resultat: "calibrage", horodatage: "2026-08-12T09:05:00.000Z" });
    const rows = getEvaluations(db);
    expect(rows.map((r) => r.cranApres)).toEqual([1, 2]);
  });

  it("filters by arbre when given", () => {
    const db = setup();
    recordEvaluation(db, { arbre: "A", semaine: 1, cranApres: 1, resultat: "calibrage", horodatage: "2026-08-12T09:00:00.000Z" });
    recordEvaluation(db, { arbre: "B", semaine: 1, cranApres: 1, resultat: "calibrage", horodatage: "2026-08-12T09:01:00.000Z" });
    expect(getEvaluations(db, "A")).toHaveLength(1);
    expect(getEvaluations(db, "A")[0]!.arbre).toBe("A");
  });
});
